import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  buildCapiEventPayload,
  buildZeydooOfferUrl,
  computeCampaignMetrics,
  formatFbc,
  generateClickId,
  normalizeZeydooStatus,
  shouldDispatchCapi,
  slugify,
  type CampaignConfig,
  type ClickRecord,
  type ConversionRecord,
  type MetaEventName,
} from './src/lib/trackingCore.ts';
import { dispatchToMetaCapi, sha256Lower } from './server/capi.ts';
import { readDb, sanitizePixel, writeDb, type StoredPixelConfig } from './server/store.ts';

const PORT = Number(process.env.PORT || 3000);

function getBaseOrigin(req: Request): string {
  const envUrl = (process.env.APP_URL || '').trim();
  if (envUrl && envUrl !== 'MY_APP_URL' && /^https?:\/\//i.test(envUrl)) {
    return envUrl.replace(/\/+$/, '');
  }
  const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim() || req.protocol || 'http';
  const host = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim() || req.get('host') || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  if (Array.isArray(fwd) && fwd.length > 0) {
    return fwd[0].split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || '';
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPixelBridgeHtml(params: {
  pixelId: string;
  targetUrl: string;
  eventId: string;
  campaignName: string;
}): string {
  const safePixel = escapeHtml(params.pixelId);
  const safeTarget = JSON.stringify(params.targetUrl);
  const safeTargetAttr = escapeHtml(params.targetUrl);
  const safeEventId = JSON.stringify(params.eventId);
  const safeCampaign = escapeHtml(params.campaignName);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Redirecting — ${safeCampaign}</title>
  <meta http-equiv="refresh" content="2;url=${safeTargetAttr}" />
  <script>
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', ${JSON.stringify(params.pixelId)});
    fbq('track', 'PageView', {}, { eventID: ${safeEventId} });
    fbq('track', 'ViewContent', { content_name: ${JSON.stringify(params.campaignName)} }, { eventID: ${safeEventId} });
  </script>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #0f172a; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .box { text-align: center; padding: 24px 32px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; max-width: 360px; }
    .title { font-size: 15px; font-weight: 600; margin-bottom: 6px; }
    .sub { font-size: 13px; color: #64748b; }
    .link { display: inline-block; margin-top: 14px; font-size: 13px; color: #2563eb; text-decoration: none; }
  </style>
</head>
<body>
  <div class="box">
    <div class="title">Connecting you to the offer…</div>
    <div class="sub">Please wait a moment while we redirect.</div>
    <a class="link" href="${safeTargetAttr}">Continue manually</a>
  </div>
  <script>
    setTimeout(function() { window.location.replace(${safeTarget}); }, 350);
  </script>
</body>
</html>`;
}

async function processZeydooPostback(input: {
  clickId: string;
  payoutRaw: unknown;
  statusRaw: string;
  offerIdRaw: string;
  currencyRaw: string;
  goalRaw: string;
  tokenRaw: string;
  baseOrigin: string;
  forceSimulate?: boolean;
}): Promise<{
  httpCode: number;
  body: Record<string, unknown>;
}> {
  const db = readDb();
  const clickId = input.clickId.trim();
  if (!clickId) {
    return {
      httpCode: 400,
      body: { ok: false, error: 'Missing required click identifier (ymid / click_id).' },
    };
  }

  const click = db.clicks.find((c) => c.clickId === clickId);
  if (!click) {
    return {
      httpCode: 404,
      body: { ok: false, error: `Click ID "${clickId}" not found in tracker logs.` },
    };
  }

  const campaign = db.campaigns.find((c) => c.id === click.campaignId);
  if (!campaign) {
    return {
      httpCode: 404,
      body: { ok: false, error: `Campaign for click "${clickId}" no longer exists.` },
    };
  }

  if (campaign.postbackSecret && campaign.postbackSecret.trim() !== '') {
    if (input.tokenRaw.trim() !== campaign.postbackSecret.trim()) {
      return {
        httpCode: 403,
        body: { ok: false, error: 'Invalid postback security token.' },
      };
    }
  }

  const pixel = db.pixels.find((p) => p.id === campaign.pixelConfigId);
  const normalizedStatus = normalizeZeydooStatus(input.statusRaw);
  const goal = (input.goalRaw || 'conversion').trim() || 'conversion';

  // Deduplicate identical conversion postbacks for same clickId + goal + normalizedStatus
  const existing = db.conversions.find(
    (conv) =>
      conv.clickId === clickId &&
      conv.goal.toLowerCase() === goal.toLowerCase() &&
      conv.normalizedStatus === normalizedStatus
  );
  if (existing) {
    return {
      httpCode: 200,
      body: {
        ok: true,
        deduplicated: true,
        conversion: existing,
      },
    };
  }

  const parsedPayout = Number(input.payoutRaw);
  const payout = Number.isFinite(parsedPayout) && parsedPayout >= 0 ? parsedPayout : campaign.defaultPayout;
  const currency = (input.currencyRaw || pixel?.defaultCurrency || 'USD').trim().toUpperCase() || 'USD';
  const offerId = (input.offerIdRaw || campaign.zeydooOfferId || '').trim();
  const eventId = `zb_${clickId}_${campaign.metaEventName}`;
  const eventSourceUrl = `${input.baseOrigin}/c/${campaign.slug}`;

  const payload = buildCapiEventPayload({
    eventName: campaign.metaEventName,
    eventTimeUnix: Math.floor(Date.now() / 1000),
    eventId,
    eventSourceUrl,
    fbc: click.fbc,
    fbp: click.fbp,
    clientIpAddress: click.ipAddress,
    clientUserAgent: click.userAgent,
    countryHash: click.country ? sha256Lower(click.country) : undefined,
    value: payout,
    currency,
    offerId,
    campaignName: campaign.name,
    testEventCode: pixel?.testEventCode || undefined,
  });

  const decision = shouldDispatchCapi(normalizedStatus, campaign.sendOnlyApproved);
  let capiStatus: ConversionRecord['capiStatus'] = 'simulated';
  let capiHttpStatus: number | null = null;
  let capiFbtraceId = '';
  let capiErrorMessage = '';
  let capiResponse: Record<string, unknown> | null = null;

  if (!decision.dispatch && decision.skipReason) {
    capiStatus = decision.skipReason;
    capiErrorMessage =
      decision.skipReason === 'skipped_pending'
        ? 'Skipped CAPI dispatch because campaign is set to Approved conversions only.'
        : 'Skipped CAPI dispatch because Zeydoo conversion status is rejected.';
  } else if (input.forceSimulate || !pixel || !pixel.pixelId || !pixel.accessToken) {
    capiStatus = 'simulated';
    capiErrorMessage = input.forceSimulate
      ? 'Test simulation mode — payload built without live Meta API call.'
      : 'Meta Pixel ID or CAPI Access Token missing — saved as dry-run preview.';
  } else {
    const dispatchResult = await dispatchToMetaCapi({
      pixelId: pixel.pixelId,
      accessToken: pixel.accessToken,
      payload,
    });
    capiStatus = dispatchResult.status;
    capiHttpStatus = dispatchResult.httpStatus;
    capiFbtraceId = dispatchResult.fbtraceId;
    capiErrorMessage = dispatchResult.errorMessage;
    capiResponse = dispatchResult.response;
  }

  const nowIso = new Date().toISOString();
  const conversion: ConversionRecord = {
    id: `conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    clickId,
    campaignId: campaign.id,
    campaignName: campaign.name,
    pixelConfigId: campaign.pixelConfigId,
    pixelId: pixel?.pixelId || '',
    zeydooOfferId: offerId,
    rawStatus: input.statusRaw || 'approved',
    normalizedStatus,
    payout,
    currency,
    goal,
    metaEventName: campaign.metaEventName,
    eventId,
    fbc: click.fbc,
    fbp: click.fbp,
    fbclid: click.fbclid,
    capiStatus,
    capiHttpStatus,
    capiFbtraceId,
    capiErrorMessage,
    capiPayload: payload,
    capiResponse,
    isSimulated: capiStatus === 'simulated',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  db.conversions.unshift(conversion);
  writeDb(db);

  return {
    httpCode: 200,
    body: {
      ok: true,
      deduplicated: false,
      conversion,
    },
  };
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 1. Live Facebook Ads Click Tracker & Zeydoo Redirect Endpoint
  app.get('/c/:slug', async (req: Request, res: Response) => {
    const slug = String(req.params.slug || '').trim();
    const db = readDb();
    const campaign = db.campaigns.find((c) => c.slug === slug);

    if (!campaign) {
      res.status(404).send(`Campaign "${escapeHtml(slug)}" not found.`);
      return;
    }

    if (campaign.status === 'paused') {
      res.status(410).send(`Campaign "${escapeHtml(campaign.name)}" is currently paused.`);
      return;
    }

    const cookies = parseCookies(req.headers.cookie);
    const q = req.query;
    const fbclid = typeof q.fbclid === 'string' ? q.fbclid.trim() : '';
    const fbp = typeof q.fbp === 'string' && q.fbp.trim() ? q.fbp.trim() : cookies._fbp || '';
    const rawFbc = typeof q.fbc === 'string' && q.fbc.trim() ? q.fbc.trim() : cookies._fbc || '';
    const nowMs = Date.now();
    const fbc = rawFbc || formatFbc(fbclid, nowMs);

    const clickId = generateClickId(nowMs);
    const ipAddress = getClientIp(req);
    const userAgent = String(req.headers['user-agent'] || '');
    const countryHeader =
      (req.headers['cf-ipcountry'] as string | undefined) ||
      (req.headers['x-appengine-country'] as string | undefined) ||
      (typeof q.country === 'string' ? q.country : '');

    const utmSource = typeof q.utm_source === 'string' ? q.utm_source : '';
    const utmCampaign = typeof q.utm_campaign === 'string' ? q.utm_campaign : '';
    const utmAdset = typeof q.utm_adset === 'string' ? q.utm_adset : '';
    const utmContent = typeof q.utm_content === 'string' ? q.utm_content : '';
    const adId = typeof q.ad_id === 'string' ? q.ad_id : '';

    const clickRecord: ClickRecord = {
      clickId,
      campaignId: campaign.id,
      campaignSlug: campaign.slug,
      pixelConfigId: campaign.pixelConfigId,
      fbclid,
      fbc,
      fbp,
      utmSource,
      utmCampaign,
      utmAdset,
      utmContent,
      adId,
      ipAddress,
      userAgent,
      country: countryHeader.trim().toUpperCase(),
      referer: String(req.headers.referer || ''),
      createdAt: new Date(nowMs).toISOString(),
    };

    const pixel = db.pixels.find((p) => p.id === campaign.pixelConfigId);
    const baseOrigin = getBaseOrigin(req);

    if (campaign.firePageViewCapi && pixel && pixel.pixelId) {
      const pvPayload = buildCapiEventPayload({
        eventName: 'PageView',
        eventTimeUnix: Math.floor(nowMs / 1000),
        eventId: `pv_${clickId}`,
        eventSourceUrl: `${baseOrigin}/c/${campaign.slug}`,
        fbc,
        fbp,
        clientIpAddress: ipAddress,
        clientUserAgent: userAgent,
        countryHash: clickRecord.country ? sha256Lower(clickRecord.country) : undefined,
        campaignName: campaign.name,
        testEventCode: pixel.testEventCode || undefined,
      });

      if (pixel.accessToken) {
        const pvResult = await dispatchToMetaCapi({
          pixelId: pixel.pixelId,
          accessToken: pixel.accessToken,
          payload: pvPayload,
        });
        clickRecord.pageViewCapiStatus = pvResult.status;
      } else {
        clickRecord.pageViewCapiStatus = 'simulated';
      }
    }

    db.clicks.unshift(clickRecord);
    if (db.clicks.length > 2000) {
      db.clicks = db.clicks.slice(0, 2000);
    }
    writeDb(db);

    const targetUrl = buildZeydooOfferUrl(campaign.zeydooOfferUrl, clickId, {
      utmSource,
      adId,
    });

    if (fbc) {
      res.cookie('_fbc', fbc, { maxAge: 90 * 24 * 3600 * 1000, httpOnly: false, sameSite: 'lax' });
    }

    if (campaign.redirectMode === 'pixel_bridge' && pixel && pixel.pixelId) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(
        renderPixelBridgeHtml({
          pixelId: pixel.pixelId,
          targetUrl,
          eventId: `pv_${clickId}`,
          campaignName: campaign.name,
        })
      );
      return;
    }

    res.redirect(302, targetUrl);
  });

  // 2. Zeydoo S2S Postback Endpoint (supports GET and POST)
  app.all('/api/postback/zeydoo', async (req: Request, res: Response) => {
    const src = { ...req.query, ...(typeof req.body === 'object' && req.body ? req.body : {}) } as Record<string, unknown>;
    const clickId = String(
      src.ymid || src.click_id || src.clickid || src.subid || src.var || src.cid || ''
    );
    const result = await processZeydooPostback({
      clickId,
      payoutRaw: src.payout ?? src.amount ?? src.revenue ?? src.sum,
      statusRaw: String(src.status || src.state || 'approved'),
      offerIdRaw: String(src.offer_id || src.offer || ''),
      currencyRaw: String(src.currency || 'USD'),
      goalRaw: String(src.goal || src.event || 'conversion'),
      tokenRaw: String(src.token || src.secret || ''),
      baseOrigin: getBaseOrigin(req),
    });

    res.status(result.httpCode).json(result.body);
  });

  // 3. Dashboard Overview Data
  app.get('/api/overview', (req: Request, res: Response) => {
    const db = readDb();
    const { byCampaign, summary } = computeCampaignMetrics(db.campaigns, db.clicks, db.conversions);
    res.json({
      baseOrigin: getBaseOrigin(req),
      pixels: db.pixels.map(sanitizePixel),
      campaigns: db.campaigns,
      metricsByCampaign: byCampaign,
      summary,
      clicks: db.clicks.slice(0, 200),
      conversions: db.conversions.slice(0, 200),
    });
  });

  // 4. Meta Pixel Profiles CRUD + Live Test Event
  app.post('/api/pixels', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const name = String(body.name || '').trim();
    const pixelId = String(body.pixelId || '').trim();
    const accessToken = String(body.accessToken || '').trim();
    const testEventCode = String(body.testEventCode || '').trim();
    const defaultCurrency = String(body.defaultCurrency || 'USD').trim().toUpperCase() || 'USD';

    if (!name || !pixelId) {
      res.status(400).json({ error: 'Pixel Profile Name and Meta Pixel ID are required.' });
      return;
    }
    if (!/^\d{6,25}$/.test(pixelId)) {
      res.status(400).json({ error: 'Meta Pixel ID must be a numeric ID (6–25 digits).' });
      return;
    }

    const db = readDb();
    const newPixel: StoredPixelConfig = {
      id: `px_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      name,
      pixelId,
      accessToken,
      testEventCode,
      defaultCurrency,
      createdAt: new Date().toISOString(),
    };
    db.pixels.unshift(newPixel);
    writeDb(db);
    res.status(201).json({ pixel: sanitizePixel(newPixel) });
  });

  app.put('/api/pixels/:id', (req: Request, res: Response) => {
    const id = String(req.params.id);
    const body = req.body as Record<string, unknown>;
    const db = readDb();
    const idx = db.pixels.findIndex((p) => p.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Pixel profile not found.' });
      return;
    }

    const existing = db.pixels[idx];
    const name = body.name !== undefined ? String(body.name).trim() : existing.name;
    const pixelId = body.pixelId !== undefined ? String(body.pixelId).trim() : existing.pixelId;
    if (!name || !pixelId || !/^\d{6,25}$/.test(pixelId)) {
      res.status(400).json({ error: 'Valid Pixel Profile Name and numeric Meta Pixel ID are required.' });
      return;
    }

    const updated: StoredPixelConfig = {
      ...existing,
      name,
      pixelId,
      accessToken:
        typeof body.accessToken === 'string' && body.accessToken.trim() !== ''
          ? body.accessToken.trim()
          : body.clearToken === true
            ? ''
            : existing.accessToken,
      testEventCode:
        body.testEventCode !== undefined ? String(body.testEventCode).trim() : existing.testEventCode,
      defaultCurrency:
        body.defaultCurrency !== undefined
          ? String(body.defaultCurrency).trim().toUpperCase() || 'USD'
          : existing.defaultCurrency,
    };

    db.pixels[idx] = updated;
    writeDb(db);
    res.json({ pixel: sanitizePixel(updated) });
  });

  app.delete('/api/pixels/:id', (req: Request, res: Response) => {
    const id = String(req.params.id);
    const db = readDb();
    const inUse = db.campaigns.some((c) => c.pixelConfigId === id);
    if (inUse) {
      res.status(409).json({ error: 'Cannot delete a Pixel profile currently assigned to a campaign.' });
      return;
    }
    db.pixels = db.pixels.filter((p) => p.id !== id);
    writeDb(db);
    res.json({ ok: true });
  });

  app.post('/api/pixels/:id/test', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const db = readDb();
    const pixel = db.pixels.find((p) => p.id === id);
    if (!pixel) {
      res.status(404).json({ error: 'Pixel profile not found.' });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const eventName = (String(body.eventName || 'Purchase') as MetaEventName) || 'Purchase';
    const baseOrigin = getBaseOrigin(req);

    const payload = buildCapiEventPayload({
      eventName,
      eventTimeUnix: Math.floor(Date.now() / 1000),
      eventId: `test_px_${Date.now()}`,
      eventSourceUrl: baseOrigin,
      fbc: formatFbc('IwAR_ZeyBridge_Diagnostic_Test', Date.now()),
      clientIpAddress: getClientIp(req) || '127.0.0.1',
      clientUserAgent: String(req.headers['user-agent'] || 'ZeyBridge-Diagnostic/1.0'),
      value: 1.0,
      currency: pixel.defaultCurrency || 'USD',
      campaignName: 'ZeyBridge Diagnostic Event',
      testEventCode: pixel.testEventCode || undefined,
    });

    const result = await dispatchToMetaCapi({
      pixelId: pixel.pixelId,
      accessToken: pixel.accessToken,
      payload,
    });

    res.json({
      result,
      payload,
    });
  });

  // 5. Campaigns CRUD
  app.post('/api/campaigns', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const name = String(body.name || '').trim();
    const zeydooOfferUrl = String(body.zeydooOfferUrl || '').trim();
    const pixelConfigId = String(body.pixelConfigId || '').trim();

    if (!name || !zeydooOfferUrl || !pixelConfigId) {
      res.status(400).json({ error: 'Campaign Name, Zeydoo Offer URL, and Meta Pixel are required.' });
      return;
    }

    try {
      new URL(zeydooOfferUrl);
    } catch {
      res.status(400).json({ error: 'Zeydoo Offer URL must be a valid https:// or http:// URL.' });
      return;
    }

    const db = readDb();
    if (!db.pixels.some((p) => p.id === pixelConfigId)) {
      res.status(400).json({ error: 'Selected Meta Pixel profile does not exist.' });
      return;
    }

    let slug = slugify(String(body.slug || name));
    if (db.campaigns.some((c) => c.slug === slug)) {
      slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;
    }

    const parsedPayout = Number(body.defaultPayout ?? 1.0);
    const campaign: CampaignConfig = {
      id: `camp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      name,
      slug,
      pixelConfigId,
      zeydooOfferUrl,
      zeydooOfferId: String(body.zeydooOfferId || '').trim(),
      redirectMode: body.redirectMode === 'pixel_bridge' ? 'pixel_bridge' : 'direct_302',
      metaEventName: (String(body.metaEventName || 'Purchase') as MetaEventName) || 'Purchase',
      sendOnlyApproved: body.sendOnlyApproved !== false,
      firePageViewCapi: Boolean(body.firePageViewCapi),
      defaultPayout: Number.isFinite(parsedPayout) && parsedPayout >= 0 ? parsedPayout : 1.0,
      status: body.status === 'paused' ? 'paused' : 'active',
      postbackSecret: String(body.postbackSecret || '').trim(),
      createdAt: new Date().toISOString(),
    };

    db.campaigns.unshift(campaign);
    writeDb(db);
    res.status(201).json({ campaign });
  });

  app.put('/api/campaigns/:id', (req: Request, res: Response) => {
    const id = String(req.params.id);
    const body = req.body as Record<string, unknown>;
    const db = readDb();
    const idx = db.campaigns.findIndex((c) => c.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Campaign not found.' });
      return;
    }

    const existing = db.campaigns[idx];
    const nextUrl =
      body.zeydooOfferUrl !== undefined ? String(body.zeydooOfferUrl).trim() : existing.zeydooOfferUrl;
    try {
      new URL(nextUrl);
    } catch {
      res.status(400).json({ error: 'Zeydoo Offer URL must be a valid URL.' });
      return;
    }

    const nextSlug = body.slug !== undefined ? slugify(String(body.slug)) : existing.slug;
    if (db.campaigns.some((c) => c.slug === nextSlug && c.id !== id)) {
      res.status(409).json({ error: `Campaign slug "${nextSlug}" is already in use.` });
      return;
    }

    const parsedPayout =
      body.defaultPayout !== undefined ? Number(body.defaultPayout) : existing.defaultPayout;

    const updated: CampaignConfig = {
      ...existing,
      name: body.name !== undefined ? String(body.name).trim() || existing.name : existing.name,
      slug: nextSlug,
      pixelConfigId:
        body.pixelConfigId !== undefined ? String(body.pixelConfigId).trim() : existing.pixelConfigId,
      zeydooOfferUrl: nextUrl,
      zeydooOfferId:
        body.zeydooOfferId !== undefined ? String(body.zeydooOfferId).trim() : existing.zeydooOfferId,
      redirectMode:
        body.redirectMode !== undefined
          ? body.redirectMode === 'pixel_bridge'
            ? 'pixel_bridge'
            : 'direct_302'
          : existing.redirectMode,
      metaEventName:
        body.metaEventName !== undefined
          ? (String(body.metaEventName) as MetaEventName)
          : existing.metaEventName,
      sendOnlyApproved:
        body.sendOnlyApproved !== undefined ? Boolean(body.sendOnlyApproved) : existing.sendOnlyApproved,
      firePageViewCapi:
        body.firePageViewCapi !== undefined ? Boolean(body.firePageViewCapi) : existing.firePageViewCapi,
      defaultPayout: Number.isFinite(parsedPayout) && parsedPayout >= 0 ? parsedPayout : existing.defaultPayout,
      status: body.status !== undefined ? (body.status === 'paused' ? 'paused' : 'active') : existing.status,
      postbackSecret:
        body.postbackSecret !== undefined ? String(body.postbackSecret).trim() : existing.postbackSecret,
    };

    db.campaigns[idx] = updated;
    writeDb(db);
    res.json({ campaign: updated });
  });

  app.delete('/api/campaigns/:id', (req: Request, res: Response) => {
    const id = String(req.params.id);
    const db = readDb();
    db.campaigns = db.campaigns.filter((c) => c.id !== id);
    writeDb(db);
    res.json({ ok: true });
  });

  // 6. Retry CAPI Delivery for an existing Conversion
  app.post('/api/conversions/:id/retry-capi', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const db = readDb();
    const idx = db.conversions.findIndex((c) => c.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Conversion log not found.' });
      return;
    }

    const conv = db.conversions[idx];
    const pixel = db.pixels.find((p) => p.id === conv.pixelConfigId);
    if (!pixel || !pixel.pixelId || !pixel.accessToken) {
      res.status(400).json({
        error: 'Cannot retry live CAPI call: add a Meta CAPI Access Token to the assigned Pixel profile first.',
      });
      return;
    }

    const result = await dispatchToMetaCapi({
      pixelId: pixel.pixelId,
      accessToken: pixel.accessToken,
      payload: conv.capiPayload,
    });

    const updated: ConversionRecord = {
      ...conv,
      capiStatus: result.status,
      capiHttpStatus: result.httpStatus,
      capiFbtraceId: result.fbtraceId,
      capiErrorMessage: result.errorMessage,
      capiResponse: result.response,
      isSimulated: result.status === 'simulated',
      updatedAt: new Date().toISOString(),
    };

    db.conversions[idx] = updated;
    writeDb(db);
    res.json({ conversion: updated });
  });

  // 7. End-to-End Click -> Zeydoo Postback -> CAPI Flow Simulator
  app.post('/api/simulate/flow', async (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const campaignId = String(body.campaignId || '').trim();
    const payout = body.payout !== undefined ? Number(body.payout) : undefined;
    const statusRaw = String(body.status || 'approved');
    const liveMeta = Boolean(body.liveMeta);

    const db = readDb();
    const campaign = campaignId ? db.campaigns.find((c) => c.id === campaignId) : db.campaigns[0];
    if (!campaign) {
      res.status(404).json({ error: 'No campaign found to run simulation.' });
      return;
    }

    const nowMs = Date.now();
    const clickId = generateClickId(nowMs);
    const sampleFbclid = `IwAR_SIM_${Math.random().toString(36).slice(2, 10)}`;
    const fbc = formatFbc(sampleFbclid, nowMs);

    const clickRecord: ClickRecord = {
      clickId,
      campaignId: campaign.id,
      campaignSlug: campaign.slug,
      pixelConfigId: campaign.pixelConfigId,
      fbclid: sampleFbclid,
      fbc,
      fbp: `fb.1.${nowMs}.${Math.floor(100000000 + Math.random() * 900000000)}`,
      utmSource: 'fb',
      utmCampaign: 'SIMULATED_TEST_CAMPAIGN',
      utmAdset: 'SIMULATED_ADSET',
      utmContent: 'SIMULATED_AD_CREATIVE',
      adId: '12021999900001',
      ipAddress: getClientIp(req) || '127.0.0.1',
      userAgent: String(req.headers['user-agent'] || 'Mozilla/5.0 ZeyBridge-Tester'),
      country: 'US',
      referer: 'https://l.facebook.com/',
      createdAt: new Date(nowMs).toISOString(),
    };

    db.clicks.unshift(clickRecord);
    writeDb(db);

    const zeydooRedirectUrl = buildZeydooOfferUrl(campaign.zeydooOfferUrl, clickId, {
      utmSource: clickRecord.utmSource,
      adId: clickRecord.adId,
    });

    const postbackResult = await processZeydooPostback({
      clickId,
      payoutRaw: payout ?? campaign.defaultPayout,
      statusRaw,
      offerIdRaw: campaign.zeydooOfferId,
      currencyRaw: 'USD',
      goalRaw: 'test_conversion',
      tokenRaw: campaign.postbackSecret,
      baseOrigin: getBaseOrigin(req),
      forceSimulate: !liveMeta,
    });

    res.json({
      ok: true,
      click: clickRecord,
      zeydooRedirectUrl,
      postbackResponse: postbackResult.body,
    });
  });

  // 8. Clear Click & Conversion Logs
  app.delete('/api/logs', (_req: Request, res: Response) => {
    const db = readDb();
    db.clicks = [];
    db.conversions = [];
    writeDb(db);
    res.json({ ok: true });
  });

  // Vite / Static Frontend Serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ZeyBridge server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

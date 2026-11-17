import fs from 'node:fs';
import path from 'node:path';
import {
  buildCapiEventPayload,
  maskSecretToken,
  type CampaignConfig,
  type ClickRecord,
  type ConversionRecord,
  type MetaPixelConfig,
} from '../src/lib/trackingCore.ts';

export interface StoredPixelConfig extends MetaPixelConfig {
  accessToken: string;
}

export interface TrackerDatabase {
  pixels: StoredPixelConfig[];
  campaigns: CampaignConfig[];
  clicks: ClickRecord[];
  conversions: ConversionRecord[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'tracker-db.json');

function createSeedDatabase(): TrackerDatabase {
  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000).toISOString();

  const px1: StoredPixelConfig = {
    id: 'px_main_1',
    name: 'Primary Media Buy Pixel',
    pixelId: '104829371920481',
    accessToken: '',
    hasAccessToken: false,
    accessTokenMasked: '',
    testEventCode: 'TEST48291',
    defaultCurrency: 'USD',
    createdAt: hoursAgo(72),
  };

  const camp1: CampaignConfig = {
    id: 'camp_zey_1',
    name: 'Finance Survey — Tier 1',
    slug: 'finance-survey-t1',
    pixelConfigId: px1.id,
    zeydooOfferUrl: 'https://zeydoo.com/offer?offer_id=20481&ymid={ymid}',
    zeydooOfferId: '20481',
    redirectMode: 'direct_302',
    metaEventName: 'Purchase',
    sendOnlyApproved: true,
    firePageViewCapi: false,
    defaultPayout: 1.85,
    status: 'active',
    postbackSecret: '',
    createdAt: hoursAgo(48),
  };

  const camp2: CampaignConfig = {
    id: 'camp_zey_2',
    name: 'Mobile Utility Lead — Android',
    slug: 'mobile-utility-lead',
    pixelConfigId: px1.id,
    zeydooOfferUrl: 'https://zeydoo.com/offer?offer_id=21904&ymid={ymid}',
    zeydooOfferId: '21904',
    redirectMode: 'pixel_bridge',
    metaEventName: 'Lead',
    sendOnlyApproved: false,
    firePageViewCapi: true,
    defaultPayout: 0.95,
    status: 'active',
    postbackSecret: '',
    createdAt: hoursAgo(36),
  };

  const sampleClicks: ClickRecord[] = [
    {
      clickId: 'clk_m8k1a_91x2b',
      campaignId: camp1.id,
      campaignSlug: camp1.slug,
      pixelConfigId: px1.id,
      fbclid: 'IwAR3x9KpL2vQ8mN4zT1aBcDeFgHiJkLmNoPqRsTuVwXyZ01',
      fbc: `fb.1.${now - 14 * 3600 * 1000}.IwAR3x9KpL2vQ8mN4zT1aBcDeFgHiJkLmNoPqRsTuVwXyZ01`,
      fbp: 'fb.1.1763350000000.884920194',
      utmSource: 'fb',
      utmCampaign: 'FIN_SURVEY_BROAD_ABO',
      utmAdset: 'US_CA_25_54',
      utmContent: 'Video_Hook_02',
      adId: '12021488920193',
      ipAddress: '172.56.21.84',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15',
      country: 'US',
      referer: 'https://l.facebook.com/',
      createdAt: hoursAgo(14),
    },
    {
      clickId: 'clk_m8k2c_47p8n',
      campaignId: camp1.id,
      campaignSlug: camp1.slug,
      pixelConfigId: px1.id,
      fbclid: 'IwAR1qW2eR3tY4uI5oP6aS7dF8gH9jK0lZ1xC2vB3nM4',
      fbc: `fb.1.${now - 9 * 3600 * 1000}.IwAR1qW2eR3tY4uI5oP6aS7dF8gH9jK0lZ1xC2vB3nM4`,
      fbp: '',
      utmSource: 'ig',
      utmCampaign: 'FIN_SURVEY_BROAD_ABO',
      utmAdset: 'IG_REELS_OPEN',
      utmContent: 'Static_Card_01',
      adId: '12021488920455',
      ipAddress: '98.114.42.19',
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile',
      country: 'US',
      referer: 'https://l.instagram.com/',
      createdAt: hoursAgo(9),
    },
    {
      clickId: 'clk_m8k3d_22m9q',
      campaignId: camp2.id,
      campaignSlug: camp2.slug,
      pixelConfigId: px1.id,
      fbclid: 'IwAR7nB6vC5xZ4lK3jH2gF1dS0aP9oI8uY7tR6eW5q',
      fbc: `fb.1.${now - 5 * 3600 * 1000}.IwAR7nB6vC5xZ4lK3jH2gF1dS0aP9oI8uY7tR6eW5q`,
      fbp: 'fb.1.1763360000000.194827361',
      utmSource: 'fb',
      utmCampaign: 'UTIL_ANDROID_CBO',
      utmAdset: 'IN_MY_18_44',
      utmContent: 'UGC_Demo_04',
      adId: '12021599301122',
      ipAddress: '103.88.140.22',
      userAgent: 'Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile',
      country: 'IN',
      referer: 'https://m.facebook.com/',
      pageViewCapiStatus: 'simulated',
      createdAt: hoursAgo(5),
    },
    {
      clickId: 'clk_m8k4e_83r5k',
      campaignId: camp1.id,
      campaignSlug: camp1.slug,
      pixelConfigId: px1.id,
      fbclid: 'IwAR2zX3cV4bN5mA6sD7fG8hJ9kL0qW1eR2tY3uI4oP',
      fbc: `fb.1.${now - 2 * 3600 * 1000}.IwAR2zX3cV4bN5mA6sD7fG8hJ9kL0qW1eR2tY3uI4oP`,
      fbp: '',
      utmSource: 'fb',
      utmCampaign: 'FIN_SURVEY_BROAD_ABO',
      utmAdset: 'US_CA_25_54',
      utmContent: 'Video_Hook_02',
      adId: '12021488920193',
      ipAddress: '174.92.11.63',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15',
      country: 'CA',
      referer: 'https://l.facebook.com/',
      createdAt: hoursAgo(2),
    },
    {
      clickId: 'clk_m8k5f_11w4t',
      campaignId: camp2.id,
      campaignSlug: camp2.slug,
      pixelConfigId: px1.id,
      fbclid: '',
      fbc: '',
      fbp: '',
      utmSource: 'an',
      utmCampaign: 'UTIL_ANDROID_CBO',
      utmAdset: 'IN_MY_18_44',
      utmContent: 'Banner_01',
      adId: '12021599301199',
      ipAddress: '49.36.112.14',
      userAgent: 'Mozilla/5.0 (Linux; Android 13; Redmi Note 12) AppleWebKit/537.36 Chrome/129.0.0.0 Mobile',
      country: 'IN',
      referer: '',
      createdAt: hoursAgo(1),
    },
  ];

  const makePayload = (click: ClickRecord, camp: CampaignConfig, payout: number, tsIso: string) =>
    buildCapiEventPayload({
      eventName: camp.metaEventName,
      eventTimeUnix: Math.floor(new Date(tsIso).getTime() / 1000),
      eventId: `zb_${click.clickId}_${camp.metaEventName}`,
      eventSourceUrl: `https://zeybridge.local/c/${camp.slug}`,
      fbc: click.fbc,
      fbp: click.fbp,
      clientIpAddress: click.ipAddress,
      clientUserAgent: click.userAgent,
      value: payout,
      currency: 'USD',
      offerId: camp.zeydooOfferId,
      campaignName: camp.name,
      testEventCode: px1.testEventCode,
    });

  const sampleConversions: ConversionRecord[] = [
    {
      id: 'conv_seed_1',
      clickId: sampleClicks[0].clickId,
      campaignId: camp1.id,
      campaignName: camp1.name,
      pixelConfigId: px1.id,
      pixelId: px1.pixelId,
      zeydooOfferId: camp1.zeydooOfferId,
      rawStatus: 'approved',
      normalizedStatus: 'approved',
      payout: 1.85,
      currency: 'USD',
      goal: 'sale',
      metaEventName: camp1.metaEventName,
      eventId: `zb_${sampleClicks[0].clickId}_${camp1.metaEventName}`,
      fbc: sampleClicks[0].fbc,
      fbp: sampleClicks[0].fbp,
      fbclid: sampleClicks[0].fbclid,
      capiStatus: 'simulated',
      capiHttpStatus: null,
      capiFbtraceId: '',
      capiErrorMessage: 'Sample seeded record — add your Meta CAPI Token to dispatch live events.',
      capiPayload: makePayload(sampleClicks[0], camp1, 1.85, hoursAgo(13)),
      capiResponse: null,
      isSimulated: true,
      createdAt: hoursAgo(13),
      updatedAt: hoursAgo(13),
    },
    {
      id: 'conv_seed_2',
      clickId: sampleClicks[2].clickId,
      campaignId: camp2.id,
      campaignName: camp2.name,
      pixelConfigId: px1.id,
      pixelId: px1.pixelId,
      zeydooOfferId: camp2.zeydooOfferId,
      rawStatus: 'approved',
      normalizedStatus: 'approved',
      payout: 0.95,
      currency: 'USD',
      goal: 'lead',
      metaEventName: camp2.metaEventName,
      eventId: `zb_${sampleClicks[2].clickId}_${camp2.metaEventName}`,
      fbc: sampleClicks[2].fbc,
      fbp: sampleClicks[2].fbp,
      fbclid: sampleClicks[2].fbclid,
      capiStatus: 'simulated',
      capiHttpStatus: null,
      capiFbtraceId: '',
      capiErrorMessage: 'Sample seeded record — add your Meta CAPI Token to dispatch live events.',
      capiPayload: makePayload(sampleClicks[2], camp2, 0.95, hoursAgo(4)),
      capiResponse: null,
      isSimulated: true,
      createdAt: hoursAgo(4),
      updatedAt: hoursAgo(4),
    },
  ];

  return {
    pixels: [px1],
    campaigns: [camp1, camp2],
    clicks: sampleClicks,
    conversions: sampleConversions,
  };
}

function ensureDbFile(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const seed = createSeedDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf-8');
  }
}

export function readDb(): TrackerDatabase {
  ensureDbFile();
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  const parsed = JSON.parse(raw) as Partial<TrackerDatabase>;
  return {
    pixels: Array.isArray(parsed.pixels) ? parsed.pixels : [],
    campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [],
    clicks: Array.isArray(parsed.clicks) ? parsed.clicks : [],
    conversions: Array.isArray(parsed.conversions) ? parsed.conversions : [],
  };
}

export function writeDb(db: TrackerDatabase): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
}

export function sanitizePixel(pixel: StoredPixelConfig): MetaPixelConfig {
  return {
    id: pixel.id,
    name: pixel.name,
    pixelId: pixel.pixelId,
    hasAccessToken: Boolean(pixel.accessToken && pixel.accessToken.trim().length > 0),
    accessTokenMasked: maskSecretToken(pixel.accessToken || ''),
    testEventCode: pixel.testEventCode || '',
    defaultCurrency: pixel.defaultCurrency || 'USD',
    createdAt: pixel.createdAt,
  };
}

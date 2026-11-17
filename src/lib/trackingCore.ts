export type RedirectMode = 'direct_302' | 'pixel_bridge';
export type MetaEventName = 'Purchase' | 'Lead' | 'CompleteRegistration' | 'Subscribe' | 'InitiateCheckout' | 'ViewContent' | 'PageView';
export type ZeydooStatus = 'approved' | 'pending' | 'rejected' | 'unknown';
export type CapiDeliveryStatus = 'delivered' | 'failed' | 'simulated' | 'skipped_pending' | 'skipped_rejected';

export interface MetaPixelConfig {
  id: string;
  name: string;
  pixelId: string;
  hasAccessToken?: boolean;
  accessTokenMasked?: string;
  testEventCode: string;
  defaultCurrency: string;
  createdAt: string;
}

export interface CampaignConfig {
  id: string;
  name: string;
  slug: string;
  pixelConfigId: string;
  zeydooOfferUrl: string;
  zeydooOfferId: string;
  redirectMode: RedirectMode;
  metaEventName: MetaEventName;
  sendOnlyApproved: boolean;
  firePageViewCapi: boolean;
  defaultPayout: number;
  status: 'active' | 'paused';
  postbackSecret: string;
  createdAt: string;
}

export interface ClickRecord {
  clickId: string;
  campaignId: string;
  campaignSlug: string;
  pixelConfigId: string;
  fbclid: string;
  fbc: string;
  fbp: string;
  utmSource: string;
  utmCampaign: string;
  utmAdset: string;
  utmContent: string;
  adId: string;
  ipAddress: string;
  userAgent: string;
  country: string;
  referer: string;
  pageViewCapiStatus?: CapiDeliveryStatus;
  createdAt: string;
}

export interface ConversionRecord {
  id: string;
  clickId: string;
  campaignId: string;
  campaignName: string;
  pixelConfigId: string;
  pixelId: string;
  zeydooOfferId: string;
  rawStatus: string;
  normalizedStatus: ZeydooStatus;
  payout: number;
  currency: string;
  goal: string;
  metaEventName: MetaEventName;
  eventId: string;
  fbc: string;
  fbp: string;
  fbclid: string;
  capiStatus: CapiDeliveryStatus;
  capiHttpStatus: number | null;
  capiFbtraceId: string;
  capiErrorMessage: string;
  capiPayload: Record<string, unknown>;
  capiResponse: Record<string, unknown> | null;
  isSimulated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignMetrics {
  campaignId: string;
  clicks: number;
  fbclidClicks: number;
  conversions: number;
  approvedConversions: number;
  pendingConversions: number;
  rejectedConversions: number;
  revenue: number;
  epc: number;
  cvr: number;
  capiDelivered: number;
  capiFailed: number;
  capiSimulated: number;
  capiMatchRate: number;
}

export interface OverviewSummary {
  totalClicks: number;
  fbclidClicks: number;
  totalConversions: number;
  approvedConversions: number;
  totalRevenue: number;
  avgEpc: number;
  avgCvr: number;
  capiDelivered: number;
  capiFailed: number;
  capiSimulated: number;
  capiDeliveryRate: number;
}

export function generateClickId(nowMs: number = Date.now()): string {
  const timePart = nowMs.toString(36);
  const randPart = Math.random().toString(36).slice(2, 8);
  return `clk_${timePart}_${randPart}`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'offer-campaign';
}

export function formatFbc(fbclid: string | undefined | null, timestampMs: number = Date.now()): string {
  const clean = (fbclid || '').trim();
  if (!clean) return '';
  if (clean.startsWith('fb.1.') || clean.startsWith('fb.2.')) {
    return clean;
  }
  return `fb.1.${Math.floor(timestampMs)}.${clean}`;
}

export function normalizeZeydooStatus(rawStatus: string | undefined | null): ZeydooStatus {
  const val = (rawStatus || '').trim().toLowerCase();
  if (!val) return 'approved';
  if (['approved', 'confirm', 'confirmed', 'valid', 'paid', 'sale', 'completed', 'approve', '1'].includes(val)) {
    return 'approved';
  }
  if (['pending', 'hold', 'waiting', 'in_progress', 'processing', '0'].includes(val)) {
    return 'pending';
  }
  if (['rejected', 'reject', 'declined', 'decline', 'trash', 'cancel', 'cancelled', 'canceled', 'fraud', '-1', '2'].includes(val)) {
    return 'rejected';
  }
  return 'unknown';
}

export function shouldDispatchCapi(
  normalizedStatus: ZeydooStatus,
  sendOnlyApproved: boolean
): { dispatch: boolean; skipReason?: 'skipped_pending' | 'skipped_rejected' } {
  if (normalizedStatus === 'rejected') {
    return { dispatch: false, skipReason: 'skipped_rejected' };
  }
  if (sendOnlyApproved && normalizedStatus === 'pending') {
    return { dispatch: false, skipReason: 'skipped_pending' };
  }
  return { dispatch: true };
}

export function buildZeydooOfferUrl(
  offerUrl: string,
  clickId: string,
  extras?: { utmSource?: string; adId?: string; subParamName?: string }
): string {
  const raw = (offerUrl || '').trim();
  if (!raw) return '';

  const subParam = extras?.subParamName || 'ymid';
  let replaced = raw
    .replace(/\{ymid\}/gi, encodeURIComponent(clickId))
    .replace(/\{click_id\}/gi, encodeURIComponent(clickId))
    .replace(/\{subid\}/gi, encodeURIComponent(clickId))
    .replace(/\{cid\}/gi, encodeURIComponent(clickId));

  try {
    const parsed = new URL(replaced);
    const hadPlaceholder = replaced !== raw;
    if (!hadPlaceholder && !parsed.searchParams.has(subParam)) {
      parsed.searchParams.set(subParam, clickId);
    }
    if (extras?.utmSource && !parsed.searchParams.has('var')) {
      parsed.searchParams.set('var', extras.utmSource);
    }
    if (extras?.adId && !parsed.searchParams.has('var_2')) {
      parsed.searchParams.set('var_2', extras.adId);
    }
    return parsed.toString();
  } catch {
    const sep = replaced.includes('?') ? '&' : '?';
    if (replaced !== raw) {
      return replaced;
    }
    return `${replaced}${sep}${encodeURIComponent(subParam)}=${encodeURIComponent(clickId)}`;
  }
}

export function buildMetaAdsTrackingUrls(baseOrigin: string, slug: string): {
  websiteUrl: string;
  urlParameters: string;
  fullTestUrl: string;
} {
  const origin = baseOrigin.replace(/\/+$/, '');
  const cleanSlug = encodeURIComponent(slug);
  const websiteUrl = `${origin}/c/${cleanSlug}`;
  const urlParameters =
    'fbclid={fbclid}&utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_adset={{adset.name}}&utm_content={{ad.name}}&ad_id={{ad.id}}';
  const fullTestUrl = `${websiteUrl}?fbclid=IwAR_test_fbclid_example&utm_source=fb&utm_campaign=zeydoo_test`;
  return { websiteUrl, urlParameters, fullTestUrl };
}

export function buildZeydooPostbackUrl(baseOrigin: string, postbackSecret?: string): string {
  const origin = baseOrigin.replace(/\/+$/, '');
  const base = `${origin}/api/postback/zeydoo?ymid={ymid}&payout={payout}&status={status}&offer_id={offer_id}&currency={currency}&goal={goal}`;
  if (postbackSecret && postbackSecret.trim()) {
    return `${base}&token=${encodeURIComponent(postbackSecret.trim())}`;
  }
  return base;
}

export interface CapiPayloadInput {
  eventName: MetaEventName;
  eventTimeUnix?: number;
  eventId: string;
  eventSourceUrl: string;
  fbc?: string;
  fbp?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
  countryHash?: string;
  value?: number;
  currency?: string;
  offerId?: string;
  campaignName?: string;
  testEventCode?: string;
}

export function buildCapiEventPayload(input: CapiPayloadInput): Record<string, unknown> {
  const eventTime = input.eventTimeUnix ?? Math.floor(Date.now() / 1000);

  const userData: Record<string, unknown> = {};
  if (input.fbc) userData.fbc = input.fbc;
  if (input.fbp) userData.fbp = input.fbp;
  if (input.clientIpAddress) userData.client_ip_address = input.clientIpAddress;
  if (input.clientUserAgent) userData.client_user_agent = input.clientUserAgent;
  if (input.countryHash) userData.country = [input.countryHash];

  const customData: Record<string, unknown> = {};
  if (typeof input.value === 'number' && Number.isFinite(input.value)) {
    customData.value = Number(input.value.toFixed(4));
    customData.currency = (input.currency || 'USD').toUpperCase();
  }
  if (input.offerId) {
    customData.content_ids = [input.offerId];
    customData.content_type = 'product';
  }
  if (input.campaignName) {
    customData.content_name = input.campaignName;
  }

  const eventEntry: Record<string, unknown> = {
    event_name: input.eventName,
    event_time: eventTime,
    event_id: input.eventId,
    action_source: 'website',
    event_source_url: input.eventSourceUrl,
    user_data: userData,
  };

  if (Object.keys(customData).length > 0) {
    eventEntry.custom_data = customData;
  }

  const payload: Record<string, unknown> = {
    data: [eventEntry],
  };

  if (input.testEventCode && input.testEventCode.trim()) {
    payload.test_event_code = input.testEventCode.trim();
  }

  return payload;
}

export function maskSecretToken(token: string): string {
  const trimmed = (token || '').trim();
  if (!trimmed) return '';
  if (trimmed.length <= 10) return '••••••••';
  return `${trimmed.slice(0, 6)}••••••${trimmed.slice(-4)}`;
}

export function computeCampaignMetrics(
  campaigns: CampaignConfig[],
  clicks: ClickRecord[],
  conversions: ConversionRecord[]
): { byCampaign: Record<string, CampaignMetrics>; summary: OverviewSummary } {
  const byCampaign: Record<string, CampaignMetrics> = {};

  for (const c of campaigns) {
    byCampaign[c.id] = {
      campaignId: c.id,
      clicks: 0,
      fbclidClicks: 0,
      conversions: 0,
      approvedConversions: 0,
      pendingConversions: 0,
      rejectedConversions: 0,
      revenue: 0,
      epc: 0,
      cvr: 0,
      capiDelivered: 0,
      capiFailed: 0,
      capiSimulated: 0,
      capiMatchRate: 0,
    };
  }

  for (const click of clicks) {
    const bucket = byCampaign[click.campaignId];
    if (!bucket) continue;
    bucket.clicks += 1;
    if (click.fbclid || click.fbc) {
      bucket.fbclidClicks += 1;
    }
  }

  for (const conv of conversions) {
    const bucket = byCampaign[conv.campaignId];
    if (!bucket) continue;
    bucket.conversions += 1;
    if (conv.normalizedStatus === 'approved') {
      bucket.approvedConversions += 1;
      bucket.revenue += conv.payout;
    } else if (conv.normalizedStatus === 'pending') {
      bucket.pendingConversions += 1;
    } else if (conv.normalizedStatus === 'rejected') {
      bucket.rejectedConversions += 1;
    } else {
      bucket.revenue += conv.payout;
    }

    if (conv.capiStatus === 'delivered') bucket.capiDelivered += 1;
    else if (conv.capiStatus === 'failed') bucket.capiFailed += 1;
    else if (conv.capiStatus === 'simulated') bucket.capiSimulated += 1;
  }

  let totalClicks = 0;
  let fbclidClicks = 0;
  let totalConversions = 0;
  let approvedConversions = 0;
  let totalRevenue = 0;
  let capiDelivered = 0;
  let capiFailed = 0;
  let capiSimulated = 0;

  for (const bucket of Object.values(byCampaign)) {
    bucket.revenue = Number(bucket.revenue.toFixed(4));
    bucket.epc = bucket.clicks > 0 ? Number((bucket.revenue / bucket.clicks).toFixed(4)) : 0;
    bucket.cvr = bucket.clicks > 0 ? Number(((bucket.conversions / bucket.clicks) * 100).toFixed(2)) : 0;
    const totalAttempts = bucket.capiDelivered + bucket.capiFailed;
    bucket.capiMatchRate =
      totalAttempts > 0 ? Number(((bucket.capiDelivered / totalAttempts) * 100).toFixed(1)) : 0;

    totalClicks += bucket.clicks;
    fbclidClicks += bucket.fbclidClicks;
    totalConversions += bucket.conversions;
    approvedConversions += bucket.approvedConversions;
    totalRevenue += bucket.revenue;
    capiDelivered += bucket.capiDelivered;
    capiFailed += bucket.capiFailed;
    capiSimulated += bucket.capiSimulated;
  }

  const totalAttempts = capiDelivered + capiFailed;

  return {
    byCampaign,
    summary: {
      totalClicks,
      fbclidClicks,
      totalConversions,
      approvedConversions,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      avgEpc: totalClicks > 0 ? Number((totalRevenue / totalClicks).toFixed(3)) : 0,
      avgCvr: totalClicks > 0 ? Number(((totalConversions / totalClicks) * 100).toFixed(2)) : 0,
      capiDelivered,
      capiFailed,
      capiSimulated,
      capiDeliveryRate:
        totalAttempts > 0 ? Number(((capiDelivered / totalAttempts) * 100).toFixed(1)) : 0,
    },
  };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCapiEventPayload,
  buildMetaAdsTrackingUrls,
  buildZeydooOfferUrl,
  buildZeydooPostbackUrl,
  computeCampaignMetrics,
  formatFbc,
  generateClickId,
  maskSecretToken,
  normalizeZeydooStatus,
  shouldDispatchCapi,
  slugify,
  type CampaignConfig,
  type ClickRecord,
  type ConversionRecord,
} from './trackingCore';

test('generateClickId creates unique URL-safe clk_ identifiers', () => {
  const id1 = generateClickId(1700000000000);
  const id2 = generateClickId(1700000000000);
  assert.match(id1, /^clk_[a-z0-9]+_[a-z0-9]+$/);
  assert.notEqual(id1, id2);
});

test('slugify formats campaign names into clean URL slugs', () => {
  assert.equal(slugify('US Survey Sweepstakes #1'), 'us-survey-sweepstakes-1');
  assert.equal(slugify('   '), 'offer-campaign');
});

test('formatFbc constructs valid Meta fbc cookie strings', () => {
  assert.equal(formatFbc('', 1700000000000), '');
  assert.equal(formatFbc('IwAR123xyz', 1700000000123), 'fb.1.1700000000123.IwAR123xyz');
  assert.equal(formatFbc('fb.1.1700000000000.IwAR123xyz', 1700000005000), 'fb.1.1700000000000.IwAR123xyz');
});

test('buildZeydooOfferUrl replaces {ymid} macro or appends ymid query parameter', () => {
  const withMacro = buildZeydooOfferUrl('https://zeydoo.com/offer?id=8812&ymid={ymid}', 'clk_abc_123');
  assert.equal(withMacro, 'https://zeydoo.com/offer?id=8812&ymid=clk_abc_123');

  const withoutMacro = buildZeydooOfferUrl('https://zeydoo.com/offer?id=8812', 'clk_abc_123', {
    utmSource: 'fb',
    adId: '998877',
  });
  const parsed = new URL(withoutMacro);
  assert.equal(parsed.searchParams.get('id'), '8812');
  assert.equal(parsed.searchParams.get('ymid'), 'clk_abc_123');
  assert.equal(parsed.searchParams.get('var'), 'fb');
  assert.equal(parsed.searchParams.get('var_2'), '998877');
});

test('buildMetaAdsTrackingUrls and buildZeydooPostbackUrl produce valid templates', () => {
  const meta = buildMetaAdsTrackingUrls('https://tracker.example.com/', 'sweep-in');
  assert.equal(meta.websiteUrl, 'https://tracker.example.com/c/sweep-in');
  assert.ok(meta.urlParameters.includes('fbclid={fbclid}'));
  assert.ok(meta.urlParameters.includes('{{campaign.name}}'));

  const postback = buildZeydooPostbackUrl('https://tracker.example.com/', 'sec_99');
  assert.equal(
    postback,
    'https://tracker.example.com/api/postback/zeydoo?ymid={ymid}&payout={payout}&status={status}&offer_id={offer_id}&currency={currency}&goal={goal}&token=sec_99'
  );
});

test('normalizeZeydooStatus and shouldDispatchCapi respect approved-only filtering', () => {
  assert.equal(normalizeZeydooStatus('Confirmed'), 'approved');
  assert.equal(normalizeZeydooStatus('hold'), 'pending');
  assert.equal(normalizeZeydooStatus('trash'), 'rejected');

  assert.deepEqual(shouldDispatchCapi('approved', true), { dispatch: true });
  assert.deepEqual(shouldDispatchCapi('pending', true), {
    dispatch: false,
    skipReason: 'skipped_pending',
  });
  assert.deepEqual(shouldDispatchCapi('pending', false), { dispatch: true });
  assert.deepEqual(shouldDispatchCapi('rejected', false), {
    dispatch: false,
    skipReason: 'skipped_rejected',
  });
});

test('buildCapiEventPayload structures Meta Graph API v21 event payload cleanly', () => {
  const payload = buildCapiEventPayload({
    eventName: 'Purchase',
    eventTimeUnix: 1700000100,
    eventId: 'zb_clk_1_Purchase',
    eventSourceUrl: 'https://tracker.example.com/c/demo',
    fbc: 'fb.1.1700000000000.IwAR99',
    clientIpAddress: '1.2.3.4',
    clientUserAgent: 'Mozilla/5.0',
    value: 2.45,
    currency: 'usd',
    offerId: '4451',
    campaignName: 'Finance Survey',
    testEventCode: 'TEST1234',
  });

  assert.equal(payload.test_event_code, 'TEST1234');
  const events = payload.data as Array<Record<string, unknown>>;
  assert.equal(events.length, 1);
  assert.equal(events[0].event_name, 'Purchase');
  assert.equal(events[0].event_id, 'zb_clk_1_Purchase');
  assert.equal(events[0].action_source, 'website');
  const userData = events[0].user_data as Record<string, unknown>;
  assert.equal(userData.fbc, 'fb.1.1700000000000.IwAR99');
  const customData = events[0].custom_data as Record<string, unknown>;
  assert.equal(customData.value, 2.45);
  assert.equal(customData.currency, 'USD');
});

test('maskSecretToken masks Meta access tokens safely', () => {
  assert.equal(maskSecretToken(''), '');
  assert.equal(maskSecretToken('short'), '••••••••');
  assert.equal(maskSecretToken('EAAGm0PX4ZCpsBA1234567890WXYZ'), 'EAAGm0••••••WXYZ');
});

test('computeCampaignMetrics aggregates clicks, conversions, revenue, EPC, CVR, and CAPI delivery rate', () => {
  const campaigns: CampaignConfig[] = [
    {
      id: 'camp_1',
      name: 'Survey Offer',
      slug: 'survey-offer',
      pixelConfigId: 'px_1',
      zeydooOfferUrl: 'https://zeydoo.com/o?ymid={ymid}',
      zeydooOfferId: '101',
      redirectMode: 'direct_302',
      metaEventName: 'Purchase',
      sendOnlyApproved: true,
      firePageViewCapi: false,
      defaultPayout: 1.5,
      status: 'active',
      postbackSecret: '',
      createdAt: '2026-01-01T00:00:00Z',
    },
  ];

  const clicks: ClickRecord[] = [
    {
      clickId: 'clk_1',
      campaignId: 'camp_1',
      campaignSlug: 'survey-offer',
      pixelConfigId: 'px_1',
      fbclid: 'IwAR1',
      fbc: 'fb.1.1.IwAR1',
      fbp: '',
      utmSource: 'fb',
      utmCampaign: 'C1',
      utmAdset: 'A1',
      utmContent: 'Ad1',
      adId: '1',
      ipAddress: '1.1.1.1',
      userAgent: 'UA',
      country: 'US',
      referer: '',
      createdAt: '2026-01-01T00:01:00Z',
    },
    {
      clickId: 'clk_2',
      campaignId: 'camp_1',
      campaignSlug: 'survey-offer',
      pixelConfigId: 'px_1',
      fbclid: '',
      fbc: '',
      fbp: '',
      utmSource: 'ig',
      utmCampaign: 'C1',
      utmAdset: 'A1',
      utmContent: 'Ad2',
      adId: '2',
      ipAddress: '1.1.1.2',
      userAgent: 'UA',
      country: 'US',
      referer: '',
      createdAt: '2026-01-01T00:02:00Z',
    },
  ];

  const conversions: ConversionRecord[] = [
    {
      id: 'conv_1',
      clickId: 'clk_1',
      campaignId: 'camp_1',
      campaignName: 'Survey Offer',
      pixelConfigId: 'px_1',
      pixelId: '123456',
      zeydooOfferId: '101',
      rawStatus: 'approved',
      normalizedStatus: 'approved',
      payout: 2.5,
      currency: 'USD',
      goal: 'lead',
      metaEventName: 'Purchase',
      eventId: 'zb_clk_1_Purchase',
      fbc: 'fb.1.1.IwAR1',
      fbp: '',
      fbclid: 'IwAR1',
      capiStatus: 'delivered',
      capiHttpStatus: 200,
      capiFbtraceId: 'trace1',
      capiErrorMessage: '',
      capiPayload: {},
      capiResponse: null,
      isSimulated: false,
      createdAt: '2026-01-01T00:03:00Z',
      updatedAt: '2026-01-01T00:03:00Z',
    },
  ];

  const { byCampaign, summary } = computeCampaignMetrics(campaigns, clicks, conversions);
  assert.equal(byCampaign['camp_1'].clicks, 2);
  assert.equal(byCampaign['camp_1'].fbclidClicks, 1);
  assert.equal(byCampaign['camp_1'].conversions, 1);
  assert.equal(byCampaign['camp_1'].revenue, 2.5);
  assert.equal(byCampaign['camp_1'].epc, 1.25);
  assert.equal(byCampaign['camp_1'].cvr, 50);
  assert.equal(byCampaign['camp_1'].capiMatchRate, 100);
  assert.equal(summary.totalRevenue, 2.5);
  assert.equal(summary.capiDeliveryRate, 100);
});

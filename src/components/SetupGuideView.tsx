import { useState } from 'react';
import {
  buildMetaAdsTrackingUrls,
  buildZeydooPostbackUrl,
} from '../lib/trackingCore';
import type { OverviewResponse } from '../types/api';
import { CopyButton } from './CopyButton';

interface SetupGuideViewProps {
  data: OverviewResponse;
}

export function SetupGuideView({ data }: SetupGuideViewProps) {
  const [selectedCampId, setSelectedCampId] = useState(data.campaigns[0]?.id || '');
  const selectedCampaign =
    data.campaigns.find((c) => c.id === selectedCampId) || data.campaigns[0] || null;

  const metaUrls = selectedCampaign
    ? buildMetaAdsTrackingUrls(data.baseOrigin, selectedCampaign.slug)
    : buildMetaAdsTrackingUrls(data.baseOrigin, 'your-campaign-slug');

  const postbackUrl = buildZeydooPostbackUrl(
    data.baseOrigin,
    selectedCampaign?.postbackSecret
  );

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Step-by-Step Facebook Ads &amp; Zeydoo S2S Integration
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Follow these 4 steps to automatically sync every Zeydoo conversion back to your Meta Pixel.
          </p>
        </div>

        {data.campaigns.length > 0 && (
          <div>
            <label htmlFor="guide-camp-select" className="sr-only">
              Select campaign for URLs
            </label>
            <select
              id="guide-camp-select"
              value={selectedCampaign?.id || ''}
              onChange={(e) => setSelectedCampId(e.target.value)}
              className="h-9 px-3 text-xs bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-600"
            >
              {data.campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Step 1 */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-2">
          <div className="text-xs font-semibold text-blue-600">01. Meta Events Manager Setup</div>
          <h3 className="text-sm font-semibold text-slate-900">
            Generate your Conversions API (CAPI) Access Token
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Open Meta Events Manager → select your Data Source (Pixel) → go to <strong>Settings</strong> → scroll to <strong>Conversions API</strong> → click <strong>Generate access token</strong>. Paste your Pixel ID and Access Token inside the <strong>Meta Pixels &amp; CAPI</strong> tab.
          </p>
        </div>

        {/* Step 2 */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
          <div className="text-xs font-semibold text-blue-600">02. Facebook Ads Manager Setup</div>
          <h3 className="text-sm font-semibold text-slate-900">
            Paste your Tracking Link &amp; Dynamic URL Parameters in Meta Ads
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            When creating an ad in Meta Ads Manager, use your ZeyBridge tracking link as the <strong>Website URL</strong>, and paste the parameters below into the <strong>URL Parameters</strong> box so Facebook passes <code className="font-mono">fbclid</code> and ad details automatically.
          </p>

          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">Website URL</span>
              <CopyButton text={metaUrls.websiteUrl} label="Copy Website URL" />
            </div>
            <div className="font-mono text-[11px] bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-slate-800 break-all">
              {metaUrls.websiteUrl}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">URL Parameters</span>
              <CopyButton text={metaUrls.urlParameters} label="Copy Parameters" />
            </div>
            <div className="font-mono text-[11px] bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-slate-800 break-all">
              {metaUrls.urlParameters}
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
          <div className="text-xs font-semibold text-blue-600">03. Zeydoo S2S Postback Setup</div>
          <h3 className="text-sm font-semibold text-slate-900">
            Add your Postback URL inside Zeydoo Dashboard
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            In Zeydoo, open <strong>Postback</strong> (Global or Offer-level) and paste the S2S URL below. Whenever a user converts on Zeydoo, Zeydoo calls this endpoint with the exact <code className="font-mono">{'{ymid}'}</code> click ID, payout, and status, and ZeyBridge immediately updates your Facebook Pixel via CAPI.
          </p>

          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">Zeydoo Postback URL</span>
              <CopyButton text={postbackUrl} label="Copy Postback URL" />
            </div>
            <div className="font-mono text-[11px] bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-slate-800 break-all">
              {postbackUrl}
            </div>
          </div>
        </div>

        {/* Step 4: Macro Reference */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">Zeydoo &amp; Meta Parameter Mapping</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-medium text-slate-600">
                  <th className="py-2.5 px-6">Zeydoo Macro</th>
                  <th className="py-2.5 px-4">Captured By Tracker</th>
                  <th className="py-2.5 px-6">Sent to Meta CAPI Field</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="py-2.5 px-6 font-mono text-slate-900">{'{ymid}'}</td>
                  <td className="py-2.5 px-4 text-slate-700">Unique Click ID (<code className="font-mono">clk_...</code>) linked to <code className="font-mono">fbclid</code></td>
                  <td className="py-2.5 px-6 font-mono text-slate-700">user_data.fbc + event_id</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-6 font-mono text-slate-900">{'{payout}'}</td>
                  <td className="py-2.5 px-4 text-slate-700">Commission amount earned on Zeydoo</td>
                  <td className="py-2.5 px-6 font-mono text-slate-700">custom_data.value</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-6 font-mono text-slate-900">{'{currency}'}</td>
                  <td className="py-2.5 px-4 text-slate-700">Offer payout currency (defaults to USD)</td>
                  <td className="py-2.5 px-6 font-mono text-slate-700">custom_data.currency</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-6 font-mono text-slate-900">{'{status}'}</td>
                  <td className="py-2.5 px-4 text-slate-700">approved / pending / rejected filter</td>
                  <td className="py-2.5 px-6 font-mono text-slate-700">Dispatch gate (Approved-only option)</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-6 font-mono text-slate-900">{'{offer_id}'}</td>
                  <td className="py-2.5 px-4 text-slate-700">Zeydoo offer ID</td>
                  <td className="py-2.5 px-6 font-mono text-slate-700">custom_data.content_ids</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

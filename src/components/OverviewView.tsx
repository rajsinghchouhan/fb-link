import { useState } from 'react';
import { ArrowRight, Play, Plus } from 'lucide-react';
import {
  buildMetaAdsTrackingUrls,
  buildZeydooPostbackUrl,
  type CampaignConfig,
  type ConversionRecord,
} from '../lib/trackingCore';
import type { OverviewResponse } from '../types/api';
import { CopyButton } from './CopyButton';
import { CapiStatusLabel, ZeydooStatusLabel } from './StatusLabel';

interface OverviewViewProps {
  data: OverviewResponse;
  onSimulateFlow: (params: {
    campaignId: string;
    payout: number;
    status: string;
    liveMeta: boolean;
  }) => Promise<ConversionRecord | null>;
  onInspectConversion: (conv: ConversionRecord) => void;
  onOpenNewCampaign: () => void;
  onNavigateTab: (tab: 'overview' | 'campaigns' | 'pixels' | 'logs' | 'guide') => void;
}

export function OverviewView({
  data,
  onSimulateFlow,
  onInspectConversion,
  onOpenNewCampaign,
  onNavigateTab,
}: OverviewViewProps) {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(
    data.campaigns[0]?.id || ''
  );
  const [testPayout, setTestPayout] = useState<string>(
    String(data.campaigns[0]?.defaultPayout ?? 1.85)
  );
  const [testStatus, setTestStatus] = useState<string>('approved');
  const [liveMeta, setLiveMeta] = useState<boolean>(false);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<{
    clickId: string;
    eventName: string;
    capiStatus: string;
    payout: number;
    errorMessage?: string;
  } | null>(null);
  const [simError, setSimError] = useState<string>('');

  const effectiveCampaign =
    data.campaigns.find((c) => c.id === selectedCampaignId) || data.campaigns[0] || null;
  const effectiveCampaignId = effectiveCampaign?.id || '';

  const activePixel = data.pixels.find((p) =>
    effectiveCampaign ? p.id === effectiveCampaign.pixelConfigId : false
  );

  const activeMetaUrls = effectiveCampaign
    ? buildMetaAdsTrackingUrls(data.baseOrigin, effectiveCampaign.slug)
    : null;
  const activePostbackUrl = buildZeydooPostbackUrl(
    data.baseOrigin,
    effectiveCampaign?.postbackSecret
  );

  const handleCampaignChange = (nextId: string) => {
    setSelectedCampaignId(nextId);
    const camp = data.campaigns.find((c) => c.id === nextId);
    if (camp) {
      setTestPayout(String(camp.defaultPayout));
    }
  };

  const handleRunTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveCampaignId) return;
    setSimError('');
    setSimulating(true);
    try {
      const conv = await onSimulateFlow({
        campaignId: effectiveCampaignId,
        payout: Number(testPayout) || 0,
        status: testStatus,
        liveMeta,
      });
      if (conv) {
        setLastResult({
          clickId: conv.clickId,
          eventName: conv.metaEventName,
          capiStatus: conv.capiStatus,
          payout: conv.payout,
          errorMessage: conv.capiErrorMessage,
        });
      }
    } catch (err) {
      setSimError(err instanceof Error ? err.message : 'Simulation failed.');
    } finally {
      setSimulating(false);
    }
  };

  const { summary } = data;
  const fbclidRate =
    summary.totalClicks > 0
      ? ((summary.fbclidClicks / summary.totalClicks) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-8">
      {/* 4-Column KPI Strip */}
      <section aria-label="Key performance metrics">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="text-xs font-medium text-slate-500">Tracked FB Clicks</div>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
                {summary.totalClicks}
              </span>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {fbclidRate}% with fbclid
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="text-xs font-medium text-slate-500">Zeydoo Conversions</div>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
                {summary.totalConversions}
              </span>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {summary.avgCvr}% CVR
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="text-xs font-medium text-slate-500">Approved Revenue</div>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
                ${summary.totalRevenue.toFixed(2)}
              </span>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                ${summary.avgEpc.toFixed(3)} EPC
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="text-xs font-medium text-slate-500">Meta CAPI Events</div>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
                {summary.capiDelivered}
              </span>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {summary.capiSimulated} dry-run · {summary.capiFailed} failed
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Attribution Chain + Interactive Flow Tester */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between gap-5">
          <div>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-slate-900">
                Facebook Ads to Zeydoo Attribution Bridge
              </h2>
              <button
                type="button"
                onClick={() => onNavigateTab('guide')}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline whitespace-nowrap cursor-pointer"
              >
                View Setup Guide
              </button>
            </div>
            <p className="mt-1.5 text-sm text-slate-600">
              Every ad click captures Meta&apos;s <code className="font-mono text-xs text-slate-800">fbclid</code>, generates a unique <code className="font-mono text-xs text-slate-800">ymid</code> click token for Zeydoo, and automatically posts conversions back to Meta Conversions API.
            </p>
          </div>

          {activeMetaUrls && (
            <div className="space-y-2.5 bg-slate-50 border border-slate-200 rounded-md p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-slate-500">
                    Active Facebook Tracking Link ({effectiveCampaign?.name})
                  </div>
                  <div className="font-mono text-xs text-slate-800 truncate">
                    {activeMetaUrls.websiteUrl}
                  </div>
                </div>
                <CopyButton text={activeMetaUrls.websiteUrl} label="Copy URL" />
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-slate-500">
                    Zeydoo S2S Postback URL
                  </div>
                  <div className="font-mono text-xs text-slate-800 truncate">
                    {activePostbackUrl}
                  </div>
                </div>
                <CopyButton text={activePostbackUrl} label="Copy Postback" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-200">
            <div>
              <div className="text-xs text-slate-500">1. Meta Ad Click</div>
              <div className="mt-1 text-sm font-semibold text-slate-900 font-mono tabular-nums">
                {summary.fbclidClicks} fbclid
              </div>
              <div className="mt-0.5 text-xs text-slate-500">Converted to _fbc</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">2. Zeydoo Redirect</div>
              <div className="mt-1 text-sm font-semibold text-slate-900 font-mono tabular-nums">
                {summary.totalClicks} ymid
              </div>
              <div className="mt-0.5 text-xs text-slate-500">Passed in offer URL</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">3. S2S Postback</div>
              <div className="mt-1 text-sm font-semibold text-slate-900 font-mono tabular-nums">
                {summary.approvedConversions} approved
              </div>
              <div className="mt-0.5 text-xs text-slate-500">Matched by click ID</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">4. Meta CAPI</div>
              <div className="mt-1 text-sm font-semibold text-slate-900 font-mono tabular-nums">
                {summary.capiDelivered + summary.capiSimulated} events
              </div>
              <div className="mt-0.5 text-xs text-slate-500">Graph API v21.0</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-base font-semibold text-slate-900">Test End-to-End Postback Flow</h2>
          <p className="mt-1 text-xs text-slate-500">
            Simulate an ad click, Zeydoo conversion postback, and Meta CAPI dispatch.
          </p>

          {data.campaigns.length === 0 ? (
            <div className="mt-5 py-6 text-center border border-dashed border-slate-200 rounded-md">
              <p className="text-xs text-slate-600 mb-3">
                Create your first Facebook-to-Zeydoo campaign to test the flow.
              </p>
              <button
                type="button"
                onClick={onOpenNewCampaign}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Create Campaign</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleRunTest} className="mt-4 space-y-3.5">
              <div>
                <label htmlFor="sim-campaign" className="block text-xs font-medium text-slate-700 mb-1">
                  Campaign
                </label>
                <select
                  id="sim-campaign"
                  value={effectiveCampaignId}
                  onChange={(e) => handleCampaignChange(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  {data.campaigns.map((camp: CampaignConfig) => (
                    <option key={camp.id} value={camp.id}>
                      {camp.name} ({camp.metaEventName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sim-payout" className="block text-xs font-medium text-slate-700 mb-1">
                    Payout (USD)
                  </label>
                  <input
                    id="sim-payout"
                    type="number"
                    step="0.01"
                    min="0"
                    value={testPayout}
                    onChange={(e) => setTestPayout(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs font-mono bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-600 tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="sim-status" className="block text-xs font-medium text-slate-700 mb-1">
                    Zeydoo Status
                  </label>
                  <select
                    id="sim-status"
                    value={testStatus}
                    onChange={(e) => setTestStatus(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={liveMeta}
                  onChange={(e) => setLiveMeta(e.target.checked)}
                  disabled={!activePixel?.hasAccessToken}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
                <span>
                  Send live request to Meta CAPI
                  {!activePixel?.hasAccessToken ? ' (add Pixel token first)' : ''}
                </span>
              </label>

              {simError && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {simError}
                </div>
              )}

              <button
                type="submit"
                disabled={simulating}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{simulating ? 'Running Click + Postback…' : 'Run Test Flow'}</span>
              </button>

              {lastResult && (
                <div className="text-xs bg-slate-50 border border-slate-200 rounded-md p-3 space-y-1">
                  <div className="flex items-center justify-between font-medium text-slate-900">
                    <span>Recorded {lastResult.eventName}</span>
                    <span className="font-mono tabular-nums">${lastResult.payout.toFixed(2)}</span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-600">
                    ymid: {lastResult.clickId} · status: {lastResult.capiStatus}
                  </div>
                  {lastResult.errorMessage && (
                    <div className="text-[11px] text-slate-600">{lastResult.errorMessage}</div>
                  )}
                </div>
              )}
            </form>
          )}
        </div>
      </section>

      {/* Recent Conversions Table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recent Conversions &amp; Meta Updates</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Latest Zeydoo S2S postbacks matched to Facebook click IDs.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('logs')}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline whitespace-nowrap cursor-pointer"
          >
            <span>All Logs</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        {data.conversions.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-slate-600">No conversions recorded yet.</p>
            <p className="text-xs text-slate-500 mt-1">
              Run a test flow above or send a Zeydoo postback to <code className="font-mono">/api/postback/zeydoo</code>.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                  <th className="py-2.5 px-6">Click ID (ymid)</th>
                  <th className="py-2.5 px-4">Campaign</th>
                  <th className="py-2.5 px-4">Zeydoo</th>
                  <th className="py-2.5 px-4 text-right">Payout</th>
                  <th className="py-2.5 px-4">Meta Event</th>
                  <th className="py-2.5 px-4">CAPI Status</th>
                  <th className="py-2.5 px-6 text-right">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {data.conversions.slice(0, 8).map((conv) => (
                  <tr key={conv.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-6 font-mono text-slate-900 tabular-nums whitespace-nowrap">
                      {conv.clickId}
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-medium whitespace-nowrap">
                      {conv.campaignName}
                    </td>
                    <td className="py-3 px-4">
                      <ZeydooStatusLabel status={conv.normalizedStatus} />
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-slate-900 tabular-nums whitespace-nowrap">
                      ${conv.payout.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                      {conv.metaEventName}
                    </td>
                    <td className="py-3 px-4">
                      <CapiStatusLabel status={conv.capiStatus} />
                    </td>
                    <td className="py-3 px-6 text-right">
                      <button
                        type="button"
                        onClick={() => onInspectConversion(conv)}
                        aria-label={`Inspect CAPI payload for ${conv.clickId}`}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline whitespace-nowrap cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

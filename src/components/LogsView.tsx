import { useMemo, useState } from 'react';
import { RefreshCw, Search, Trash2 } from 'lucide-react';
import type { CapiDeliveryStatus, ConversionRecord } from '../lib/trackingCore';
import type { OverviewResponse } from '../types/api';
import { CapiStatusLabel, ZeydooStatusLabel } from './StatusLabel';

interface LogsViewProps {
  data: OverviewResponse;
  onInspectConversion: (conv: ConversionRecord) => void;
  onRetryCapi: (conversionId: string) => Promise<void>;
  onClearLogs: () => Promise<void>;
  retryingId: string | null;
}

export function LogsView({
  data,
  onInspectConversion,
  onRetryCapi,
  onClearLogs,
  retryingId,
}: LogsViewProps) {
  const [subTab, setSubTab] = useState<'conversions' | 'clicks'>('conversions');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CapiDeliveryStatus>('all');
  const [confirmClear, setConfirmClear] = useState(false);

  const filteredConversions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.conversions.filter((conv) => {
      if (statusFilter !== 'all' && conv.capiStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        conv.clickId.toLowerCase().includes(q) ||
        conv.campaignName.toLowerCase().includes(q) ||
        conv.fbclid.toLowerCase().includes(q) ||
        conv.capiFbtraceId.toLowerCase().includes(q)
      );
    });
  }, [data.conversions, search, statusFilter]);

  const filteredClicks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.clicks.filter((click) => {
      if (!q) return true;
      return (
        click.clickId.toLowerCase().includes(q) ||
        click.campaignSlug.toLowerCase().includes(q) ||
        click.fbclid.toLowerCase().includes(q) ||
        click.utmCampaign.toLowerCase().includes(q)
      );
    });
  }, [data.clicks, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Postback &amp; Click Logs</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Inspect every Facebook click, Zeydoo S2S postback, and Meta Conversions API response.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {confirmClear ? (
            <>
              <button
                type="button"
                onClick={async () => {
                  await onClearLogs();
                  setConfirmClear(false);
                }}
                className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-md hover:bg-red-700 cursor-pointer whitespace-nowrap"
              >
                Confirm Clear All
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-md bg-white text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              <span>Clear Logs</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setSubTab('conversions')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'conversions'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Conversions &amp; CAPI ({data.conversions.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('clicks')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'clicks'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Raw Clicks ({data.clicks.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {subTab === 'conversions' && (
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(['all', 'delivered', 'simulated', 'failed'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors capitalize whitespace-nowrap cursor-pointer ${
                    statusFilter === status
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {status === 'simulated' ? 'Dry-Run' : status}
                </button>
              ))}
            </div>
          )}

          <div className="relative">
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search logs by click ID, campaign, or fbclid"
              placeholder="Search click ID or fbclid…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-8 pr-3 w-56 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {subTab === 'conversions' ? (
          filteredConversions.length === 0 ? (
            <div className="px-6 py-12 text-center text-xs text-slate-500">
              No conversion postbacks match your current filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                    <th className="py-2.5 px-5">Time</th>
                    <th className="py-2.5 px-4">Click ID (ymid)</th>
                    <th className="py-2.5 px-4">Campaign</th>
                    <th className="py-2.5 px-4">Zeydoo</th>
                    <th className="py-2.5 px-4 text-right">Payout</th>
                    <th className="py-2.5 px-4">Meta Event</th>
                    <th className="py-2.5 px-4">CAPI Status</th>
                    <th className="py-2.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {filteredConversions.map((conv) => (
                    <tr key={conv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-5 text-slate-500 font-mono tabular-nums whitespace-nowrap">
                        {new Date(conv.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-900 tabular-nums whitespace-nowrap">
                        {conv.clickId}
                      </td>
                      <td className="py-2.5 px-4 text-slate-800 font-medium whitespace-nowrap">
                        {conv.campaignName}
                      </td>
                      <td className="py-2.5 px-4">
                        <ZeydooStatusLabel status={conv.normalizedStatus} />
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-medium text-slate-900 tabular-nums whitespace-nowrap">
                        ${conv.payout.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">
                        {conv.metaEventName}
                      </td>
                      <td className="py-2.5 px-4">
                        <CapiStatusLabel status={conv.capiStatus} />
                      </td>
                      <td className="py-2.5 px-5 text-right whitespace-nowrap space-x-3">
                        <button
                          type="button"
                          onClick={() => onInspectConversion(conv)}
                          aria-label={`Inspect payload for ${conv.clickId}`}
                          className="text-xs font-medium text-blue-600 hover:underline cursor-pointer"
                        >
                          Inspect Payload
                        </button>
                        {(conv.capiStatus === 'failed' || conv.capiStatus === 'simulated') && (
                          <button
                            type="button"
                            onClick={() => onRetryCapi(conv.id)}
                            disabled={retryingId === conv.id}
                            aria-label={`Retry CAPI for ${conv.clickId}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 disabled:opacity-50 cursor-pointer"
                          >
                            <RefreshCw
                              className={`w-3 h-3 ${retryingId === conv.id ? 'animate-spin' : ''}`}
                              aria-hidden="true"
                            />
                            <span>Retry</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : filteredClicks.length === 0 ? (
          <div className="px-6 py-12 text-center text-xs text-slate-500">
            No ad clicks match your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                  <th className="py-2.5 px-5">Time</th>
                  <th className="py-2.5 px-4">Click ID (ymid)</th>
                  <th className="py-2.5 px-4">Campaign Slug</th>
                  <th className="py-2.5 px-4">fbclid</th>
                  <th className="py-2.5 px-4">UTM Source / Campaign</th>
                  <th className="py-2.5 px-5 text-right">Country / IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredClicks.map((click) => (
                  <tr key={click.clickId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-5 text-slate-500 font-mono tabular-nums whitespace-nowrap">
                      {new Date(click.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-900 tabular-nums whitespace-nowrap">
                      {click.clickId}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                      /c/{click.campaignSlug}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-600 max-w-[200px] truncate">
                      {click.fbclid || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">
                      {click.utmSource || 'direct'} · {click.utmCampaign || '—'}
                    </td>
                    <td className="py-2.5 px-5 text-right font-mono text-slate-600 tabular-nums whitespace-nowrap">
                      {click.country || '—'} · {click.ipAddress || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

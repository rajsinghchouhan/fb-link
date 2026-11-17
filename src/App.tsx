/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BookOpen,
  LayoutDashboard,
  Link2,
  Menu,
  Plus,
  Radio,
  X,
} from 'lucide-react';
import type { CampaignConfig, ConversionRecord } from './lib/trackingCore';
import type { OverviewResponse } from './types/api';
import { OverviewView } from './components/OverviewView';
import { CampaignsView } from './components/CampaignsView';
import { PixelsView } from './components/PixelsView';
import { LogsView } from './components/LogsView';
import { SetupGuideView } from './components/SetupGuideView';
import { PayloadInspectorModal } from './components/PayloadInspectorModal';
import { CopyButton } from './components/CopyButton';

type ActiveTab = 'overview' | 'campaigns' | 'pixels' | 'logs' | 'guide';

const NAV_ITEMS: Array<{ id: ActiveTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'campaigns', label: 'Campaigns & Links', icon: Link2 },
  { id: 'pixels', label: 'Meta Pixels & CAPI', icon: Radio },
  { id: 'logs', label: 'Postback & Click Logs', icon: Activity },
  { id: 'guide', label: 'Setup Guide', icon: BookOpen },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<CampaignConfig | null>(null);
  const [inspectedConversion, setInspectedConversion] = useState<ConversionRecord | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/overview');
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const json = (await res.json()) as OverviewResponse;
      setData(json);
      setFetchError('');
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Unable to load tracker data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const handleOpenNewCampaign = (campaign?: CampaignConfig) => {
    setEditingCampaign(campaign || null);
    setActiveTab('campaigns');
    setCampaignModalOpen(true);
  };

  const handleSaveCampaign = async (
    payload: Record<string, unknown>,
    editingId?: string
  ) => {
    const url = editingId ? `/api/campaigns/${encodeURIComponent(editingId)}` : '/api/campaigns';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      throw new Error(json.error || 'Failed to save campaign.');
    }
    await loadOverview();
  };

  const handleToggleCampaignStatus = async (camp: CampaignConfig) => {
    const nextStatus = camp.status === 'active' ? 'paused' : 'active';
    const res = await fetch(`/api/campaigns/${encodeURIComponent(camp.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) {
      await loadOverview();
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    const res = await fetch(`/api/campaigns/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      await loadOverview();
    }
  };

  const handleSavePixel = async (
    payload: Record<string, unknown>,
    editingId?: string
  ) => {
    const url = editingId ? `/api/pixels/${encodeURIComponent(editingId)}` : '/api/pixels';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      throw new Error(json.error || 'Failed to save Meta Pixel.');
    }
    await loadOverview();
  };

  const handleDeletePixel = async (id: string) => {
    const res = await fetch(`/api/pixels/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      throw new Error(json.error || 'Failed to delete Meta Pixel.');
    }
    await loadOverview();
  };

  const handleTestPixel = async (id: string) => {
    const res = await fetch(`/api/pixels/${encodeURIComponent(id)}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName: 'Purchase' }),
    });
    const json = (await res.json()) as {
      error?: string;
      result: {
        status: string;
        httpStatus: number | null;
        fbtraceId: string;
        errorMessage: string;
        response: Record<string, unknown> | null;
      };
      payload: Record<string, unknown>;
    };
    if (!res.ok) {
      throw new Error(json.error || 'Failed to send test event.');
    }
    return json;
  };

  const handleSimulateFlow = async (params: {
    campaignId: string;
    payout: number;
    status: string;
    liveMeta: boolean;
  }): Promise<ConversionRecord | null> => {
    const res = await fetch('/api/simulate/flow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const json = (await res.json()) as {
      error?: string;
      postbackResponse?: { conversion?: ConversionRecord };
    };
    if (!res.ok) {
      throw new Error(json.error || 'Flow simulation failed.');
    }
    await loadOverview();
    return json.postbackResponse?.conversion || null;
  };

  const handleRetryCapi = async (conversionId: string) => {
    setRetryingId(conversionId);
    try {
      const res = await fetch(`/api/conversions/${encodeURIComponent(conversionId)}/retry-capi`, {
        method: 'POST',
      });
      const json = (await res.json()) as {
        error?: string;
        conversion?: ConversionRecord;
      };
      if (!res.ok) {
        setFetchError(json.error || 'Unable to retry Meta CAPI request.');
        return;
      }
      if (json.conversion && inspectedConversion?.id === conversionId) {
        setInspectedConversion(json.conversion);
      }
      await loadOverview();
    } finally {
      setRetryingId(null);
    }
  };

  const handleClearLogs = async () => {
    const res = await fetch('/api/logs', { method: 'DELETE' });
    if (res.ok) {
      await loadOverview();
    }
  };

  const activeNavLabel = NAV_ITEMS.find((n) => n.id === activeTab)?.label || 'Overview';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Left Sidebar (256px) */}
      <aside
        aria-label="Primary workspace navigation"
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="h-16 px-6 flex items-center justify-between border-b border-slate-200">
            <a
              href="/"
              className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
            >
              ZeyBridge
            </a>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="p-1.5 text-slate-500 hover:text-slate-900 lg:hidden cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <nav className="p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200 space-y-2">
          <div className="text-[11px] font-medium text-slate-500">Postback Receiver Endpoint</div>
          <div className="font-mono text-[11px] text-slate-700 truncate">
            {data ? `${data.baseOrigin}/api/postback/zeydoo` : '/api/postback/zeydoo'}
          </div>
          {data && (
            <CopyButton
              text={`${data.baseOrigin}/api/postback/zeydoo?ymid={ymid}&payout={payout}&status={status}&offer_id={offer_id}&currency={currency}`}
              label="Copy Zeydoo Postback"
              className="w-full justify-center"
            />
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar (3-Zone Contract) */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-8 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="p-2 -ml-2 text-slate-600 hover:text-slate-900 lg:hidden cursor-pointer"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="hidden sm:inline text-slate-500 whitespace-nowrap">ZeyBridge</span>
              <span className="hidden sm:inline text-slate-400" aria-hidden="true">/</span>
              <h1 className="font-semibold text-slate-900 truncate">{activeNavLabel}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleOpenNewCampaign()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>New Campaign</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {fetchError && (
            <div className="mb-6 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3 flex items-center justify-between">
              <span>{fetchError}</span>
              <button
                type="button"
                onClick={() => setFetchError('')}
                aria-label="Dismiss error"
                className="p-1 hover:opacity-75 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          {loading || !data ? (
            <div className="space-y-6" aria-label="Loading tracker data">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-24 bg-white border border-slate-200 rounded-lg animate-pulse"
                  />
                ))}
              </div>
              <div className="h-64 bg-white border border-slate-200 rounded-lg animate-pulse" />
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewView
                  data={data}
                  onSimulateFlow={handleSimulateFlow}
                  onInspectConversion={setInspectedConversion}
                  onOpenNewCampaign={() => handleOpenNewCampaign()}
                  onNavigateTab={setActiveTab}
                />
              )}

              {activeTab === 'campaigns' && (
                <CampaignsView
                  data={data}
                  isModalOpen={campaignModalOpen}
                  onOpenModal={(camp) => {
                    setEditingCampaign(camp || null);
                    setCampaignModalOpen(true);
                  }}
                  onCloseModal={() => {
                    setCampaignModalOpen(false);
                    setEditingCampaign(null);
                  }}
                  editingCampaign={editingCampaign}
                  onSaveCampaign={handleSaveCampaign}
                  onToggleStatus={handleToggleCampaignStatus}
                  onDeleteCampaign={handleDeleteCampaign}
                  onTestCampaign={async (camp) => {
                    await handleSimulateFlow({
                      campaignId: camp.id,
                      payout: camp.defaultPayout,
                      status: 'approved',
                      liveMeta: false,
                    });
                  }}
                />
              )}

              {activeTab === 'pixels' && (
                <PixelsView
                  data={data}
                  onSavePixel={handleSavePixel}
                  onDeletePixel={handleDeletePixel}
                  onTestPixel={handleTestPixel}
                />
              )}

              {activeTab === 'logs' && (
                <LogsView
                  data={data}
                  onInspectConversion={setInspectedConversion}
                  onRetryCapi={handleRetryCapi}
                  onClearLogs={handleClearLogs}
                  retryingId={retryingId}
                />
              )}

              {activeTab === 'guide' && <SetupGuideView data={data} />}
            </>
          )}
        </main>
      </div>

      <PayloadInspectorModal
        conversion={inspectedConversion}
        onClose={() => setInspectedConversion(null)}
        onRetryCapi={handleRetryCapi}
        retryingId={retryingId}
      />
    </div>
  );
}

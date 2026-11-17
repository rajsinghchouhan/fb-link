import { useState } from 'react';
import { CheckCircle2, KeyRound, Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import type { MetaPixelConfig } from '../lib/trackingCore';
import type { OverviewResponse } from '../types/api';

interface PixelsViewProps {
  data: OverviewResponse;
  onSavePixel: (payload: Record<string, unknown>, editingId?: string) => Promise<void>;
  onDeletePixel: (id: string) => Promise<void>;
  onTestPixel: (id: string) => Promise<{
    result: { status: string; httpStatus: number | null; fbtraceId: string; errorMessage: string; response: Record<string, unknown> | null };
    payload: Record<string, unknown>;
  }>;
}

export function PixelsView({
  data,
  onSavePixel,
  onDeletePixel,
  onTestPixel,
}: PixelsViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPixel, setEditingPixel] = useState<MetaPixelConfig | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testOutcome, setTestOutcome] = useState<{
    pixelId: string;
    status: string;
    message: string;
    fbtraceId?: string;
  } | null>(null);
  const [errorBanner, setErrorBanner] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleOpenAdd = () => {
    setEditingPixel(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (px: MetaPixelConfig) => {
    setEditingPixel(px);
    setModalOpen(true);
  };

  const handleRunPixelTest = async (px: MetaPixelConfig) => {
    setTestingId(px.id);
    setErrorBanner('');
    setTestOutcome(null);
    try {
      const res = await onTestPixel(px.id);
      setTestOutcome({
        pixelId: px.pixelId,
        status: res.result.status,
        fbtraceId: res.result.fbtraceId,
        message:
          res.result.status === 'delivered'
            ? `Meta accepted test event (HTTP ${res.result.httpStatus}).`
            : res.result.errorMessage || `Status: ${res.result.status}`,
      });
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to test pixel.');
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setErrorBanner('');
    try {
      await onDeletePixel(id);
      setConfirmDeleteId(null);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to delete pixel.');
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Meta Pixels &amp; Conversions API</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure your Meta Pixel ID and CAPI Access Token so Zeydoo conversions automatically update Facebook Ads.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Add Meta Pixel</span>
        </button>
      </div>

      {errorBanner && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-2.5">
          {errorBanner}
        </div>
      )}

      {testOutcome && (
        <div
          className={`text-xs border rounded-md px-4 py-3 flex items-center justify-between gap-4 ${
            testOutcome.status === 'delivered'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : testOutcome.status === 'failed'
                ? 'bg-red-50 border-red-200 text-red-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <div>
            <span className="font-semibold">Pixel {testOutcome.pixelId}: </span>
            <span>{testOutcome.message}</span>
            {testOutcome.fbtraceId && (
              <span className="font-mono ml-2">fbtrace_id: {testOutcome.fbtraceId}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setTestOutcome(null)}
            aria-label="Close test notification"
            className="p-1 hover:opacity-75 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {data.pixels.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <p className="text-sm font-medium text-slate-900">No Meta Pixels added yet</p>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Add your Meta Pixel ID and Conversions API token from Facebook Events Manager.
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Add Meta Pixel</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.pixels.map((px) => {
            const linkedCampaigns = data.campaigns.filter((c) => c.pixelConfigId === px.id).length;

            return (
              <div
                key={px.id}
                className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{px.name}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                        <span>Pixel ID: {px.pixelId}</span>
                        <span aria-hidden="true">·</span>
                        <span>{px.defaultCurrency}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(px)}
                        aria-label={`Edit pixel ${px.name}`}
                        className="p-1.5 border border-slate-200 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>

                      {confirmDeleteId === px.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDelete(px.id)}
                            className="px-2 py-1 text-xs font-medium bg-red-600 text-white rounded-md hover:bg-red-700 cursor-pointer"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(px.id)}
                          aria-label={`Delete pixel ${px.name}`}
                          className="p-1.5 border border-slate-200 rounded-md text-slate-500 hover:text-red-600 hover:border-red-200 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">CAPI Access Token</span>
                      {px.hasAccessToken ? (
                        <span className="inline-flex items-center gap-1 font-mono text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{px.accessTokenMasked}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                          <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Not configured (Dry-Run Mode)</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Test Event Code</span>
                      <span className="font-mono text-slate-800">
                        {px.testEventCode || 'None (Production)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Assigned Campaigns</span>
                      <span className="font-mono text-slate-800 tabular-nums">
                        {linkedCampaigns}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleRunPixelTest(px)}
                    disabled={testingId === px.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-md bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                  >
                    <Send className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                    <span>{testingId === px.id ? 'Sending…' : 'Send Test Event to Meta'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(px)}
                    className="text-xs font-medium text-blue-600 hover:underline cursor-pointer whitespace-nowrap"
                  >
                    {px.hasAccessToken ? 'Update Token' : 'Add CAPI Token'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <PixelFormModal
          editingPixel={editingPixel}
          onClose={() => setModalOpen(false)}
          onSave={onSavePixel}
        />
      )}
    </div>
  );
}

interface PixelFormModalProps {
  editingPixel: MetaPixelConfig | null;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>, editingId?: string) => Promise<void>;
}

function PixelFormModal({ editingPixel, onClose, onSave }: PixelFormModalProps) {
  const [name, setName] = useState(editingPixel?.name || '');
  const [pixelId, setPixelId] = useState(editingPixel?.pixelId || '');
  const [accessToken, setAccessToken] = useState('');
  const [clearToken, setClearToken] = useState(false);
  const [testEventCode, setTestEventCode] = useState(editingPixel?.testEventCode || '');
  const [defaultCurrency, setDefaultCurrency] = useState(editingPixel?.defaultCurrency || 'USD');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Profile name is required.');
      return;
    }
    if (!/^\d{6,25}$/.test(pixelId.trim())) {
      setError('Meta Pixel ID must be a 6–25 digit number.');
      return;
    }

    setSaving(true);
    try {
      await onSave(
        {
          name: name.trim(),
          pixelId: pixelId.trim(),
          accessToken: accessToken.trim(),
          clearToken,
          testEventCode: testEventCode.trim(),
          defaultCurrency: defaultCurrency.trim().toUpperCase() || 'USD',
        },
        editingPixel?.id
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pixel.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pixel-modal-title"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 id="pixel-modal-title" className="text-base font-semibold text-slate-900">
            {editingPixel ? 'Edit Meta Pixel & CAPI' : 'Add Meta Pixel & CAPI'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close pixel dialog"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="px-name" className="block text-xs font-medium text-slate-700 mb-1">
              Profile Name
            </label>
            <input
              id="px-name"
              type="text"
              required
              placeholder="e.g. Zeydoo Ad Account Pixel #1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-9 px-3 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="px-id" className="block text-xs font-medium text-slate-700 mb-1">
                Meta Pixel / Dataset ID
              </label>
              <input
                id="px-id"
                type="text"
                required
                placeholder="104829371920481"
                value={pixelId}
                onChange={(e) => setPixelId(e.target.value)}
                className="w-full h-9 px-3 text-xs font-mono border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label htmlFor="px-currency" className="block text-xs font-medium text-slate-700 mb-1">
                Default Currency
              </label>
              <input
                id="px-currency"
                type="text"
                maxLength={3}
                placeholder="USD"
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value)}
                className="w-full h-9 px-3 text-xs font-mono uppercase border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <label htmlFor="px-token" className="block text-xs font-medium text-slate-700 mb-1">
              Conversions API Access Token
            </label>
            <textarea
              id="px-token"
              rows={3}
              placeholder={
                editingPixel?.hasAccessToken
                  ? 'Leave blank to keep existing saved token, or paste a new EAA... token'
                  : 'Paste Meta CAPI Access Token (optional for dry-run testing)'
              }
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
            />
            {editingPixel?.hasAccessToken && (
              <label className="mt-1.5 flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearToken}
                  onChange={(e) => setClearToken(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Remove saved access token (switch back to Dry-Run)</span>
              </label>
            )}
          </div>

          <div>
            <label htmlFor="px-test-code" className="block text-xs font-medium text-slate-700 mb-1">
              Meta Test Event Code (Optional)
            </label>
            <input
              id="px-test-code"
              type="text"
              placeholder="e.g. TEST48291 (clear when going live)"
              value={testEventCode}
              onChange={(e) => setTestEventCode(e.target.value)}
              className="w-full h-9 px-3 text-xs font-mono border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Found in Meta Events Manager → Test Events. Leave blank for live production attribution.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium border border-slate-300 rounded-md bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Saving…' : editingPixel ? 'Save Pixel' : 'Add Pixel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

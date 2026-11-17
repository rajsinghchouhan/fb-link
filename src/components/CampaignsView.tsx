import { useState } from 'react';
import { ExternalLink, Link2, Pause, Pencil, Play, Plus, Trash2, X } from 'lucide-react';
import {
  buildMetaAdsTrackingUrls,
  buildZeydooPostbackUrl,
  slugify,
  type CampaignConfig,
  type MetaEventName,
  type RedirectMode,
} from '../lib/trackingCore';
import type { OverviewResponse } from '../types/api';
import { CopyButton } from './CopyButton';

interface CampaignsViewProps {
  data: OverviewResponse;
  isModalOpen: boolean;
  onOpenModal: (campaign?: CampaignConfig) => void;
  onCloseModal: () => void;
  editingCampaign: CampaignConfig | null;
  onSaveCampaign: (payload: Record<string, unknown>, editingId?: string) => Promise<void>;
  onToggleStatus: (campaign: CampaignConfig) => Promise<void>;
  onDeleteCampaign: (id: string) => Promise<void>;
  onTestCampaign: (campaign: CampaignConfig) => Promise<void>;
}

export function CampaignsView({
  data,
  isModalOpen,
  onOpenModal,
  onCloseModal,
  editingCampaign,
  onSaveCampaign,
  onToggleStatus,
  onDeleteCampaign,
  onTestCampaign,
}: CampaignsViewProps) {
  const [expandedLinksId, setExpandedLinksId] = useState<string | null>(
    data.campaigns[0]?.id || null
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testFeedback, setTestFeedback] = useState<string>('');

  const handleQuickTest = async (camp: CampaignConfig) => {
    setTestingId(camp.id);
    setTestFeedback('');
    try {
      await onTestCampaign(camp);
      setTestFeedback(`Simulated click + Zeydoo postback for "${camp.name}".`);
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Campaigns &amp; Tracking Links</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Each campaign connects a Facebook Ads tracking link to a Zeydoo offer URL and Meta Pixel.
        </p>
      </div>

      {testFeedback && (
        <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-4 py-2.5 flex items-center justify-between">
          <span>{testFeedback}</span>
          <button
            type="button"
            onClick={() => setTestFeedback('')}
            aria-label="Dismiss notice"
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {data.campaigns.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <p className="text-sm font-medium text-slate-900">No tracking campaigns configured</p>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Add your Zeydoo offer URL and link it to a Meta Pixel to generate your tracking links.
          </p>
          <button
            type="button"
            onClick={() => onOpenModal()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Create First Campaign</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {data.campaigns.map((camp) => {
            const metrics = data.metricsByCampaign[camp.id];
            const pixel = data.pixels.find((p) => p.id === camp.pixelConfigId);
            const metaUrls = buildMetaAdsTrackingUrls(data.baseOrigin, camp.slug);
            const postbackUrl = buildZeydooPostbackUrl(data.baseOrigin, camp.postbackSecret);
            const isExpanded = expandedLinksId === camp.id;

            return (
              <div
                key={camp.id}
                className="bg-white border border-slate-200 rounded-lg overflow-hidden"
              >
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">{camp.name}</h3>
                      <span
                        className={`text-xs font-medium ${
                          camp.status === 'active' ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        · {camp.status === 'active' ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span className="font-mono">/c/{camp.slug}</span>
                      <span aria-hidden="true">·</span>
                      <span>Pixel: {pixel ? `${pixel.name} (${pixel.pixelId})` : 'Unassigned'}</span>
                      <span aria-hidden="true">·</span>
                      <span>Meta Event: {camp.metaEventName}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Mode: {camp.redirectMode === 'pixel_bridge' ? 'Pixel Bridge' : 'Direct 302'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-5 text-xs">
                      <div>
                        <div className="text-slate-500">Clicks</div>
                        <div className="font-mono font-semibold text-slate-900 tabular-nums">
                          {metrics?.clicks ?? 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Conv.</div>
                        <div className="font-mono font-semibold text-slate-900 tabular-nums">
                          {metrics?.conversions ?? 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Revenue</div>
                        <div className="font-mono font-semibold text-slate-900 tabular-nums">
                          ${(metrics?.revenue ?? 0).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">CVR</div>
                        <div className="font-mono font-semibold text-slate-900 tabular-nums">
                          {(metrics?.cvr ?? 0).toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setExpandedLinksId(isExpanded ? null : camp.id)}
                        aria-expanded={isExpanded}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-md bg-white text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                      >
                        <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{isExpanded ? 'Hide URLs' : 'Tracking URLs'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickTest(camp)}
                        disabled={testingId === camp.id}
                        aria-label={`Test flow for ${camp.name}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-md bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                      >
                        <Play className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                        <span>{testingId === camp.id ? 'Testing…' : 'Test Flow'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleStatus(camp)}
                        aria-label={camp.status === 'active' ? `Pause ${camp.name}` : `Resume ${camp.name}`}
                        className="p-1.5 border border-slate-200 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer"
                        title={camp.status === 'active' ? 'Pause campaign' : 'Resume campaign'}
                      >
                        <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenModal(camp)}
                        aria-label={`Edit ${camp.name}`}
                        className="p-1.5 border border-slate-200 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer"
                        title="Edit campaign"
                      >
                        <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>

                      {confirmDeleteId === camp.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={async () => {
                              await onDeleteCampaign(camp.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2.5 py-1.5 text-xs font-medium bg-red-600 text-white rounded-md hover:bg-red-700 cursor-pointer whitespace-nowrap"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(camp.id)}
                          aria-label={`Delete ${camp.name}`}
                          className="p-1.5 border border-slate-200 rounded-md text-slate-500 hover:text-red-600 hover:border-red-200 cursor-pointer"
                          title="Delete campaign"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 space-y-3">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-medium text-slate-700">
                            1. Facebook Ads Website URL
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <a
                              href={metaUrls.fullTestUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline whitespace-nowrap shrink-0"
                            >
                              <span>Test Redirect</span>
                              <ExternalLink className="w-3 h-3" aria-hidden="true" />
                            </a>
                            <CopyButton
                              text={metaUrls.websiteUrl}
                              label="Copy URL"
                              ariaLabel={`Copy Facebook Ads Website URL for ${camp.name}`}
                            />
                          </div>
                        </div>
                        <div className="font-mono text-[11px] bg-white border border-slate-200 rounded-md px-3 py-2 text-slate-800 break-all">
                          {metaUrls.websiteUrl}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-700">
                            2. Meta Ads Manager URL Parameters
                          </span>
                          <CopyButton
                            text={metaUrls.urlParameters}
                            label="Copy Params"
                            ariaLabel={`Copy Meta URL parameters for ${camp.name}`}
                          />
                        </div>
                        <div className="font-mono text-[11px] bg-white border border-slate-200 rounded-md px-3 py-2 text-slate-800 break-all">
                          {metaUrls.urlParameters}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-700">
                          3. Zeydoo S2S Postback URL (Paste in Zeydoo Postback Settings)
                        </span>
                        <CopyButton
                          text={postbackUrl}
                          label="Copy Postback"
                          ariaLabel={`Copy Zeydoo S2S Postback URL for ${camp.name}`}
                        />
                      </div>
                      <div className="font-mono text-[11px] bg-white border border-slate-200 rounded-md px-3 py-2 text-slate-800 break-all">
                        {postbackUrl}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <CampaignFormModal
          pixels={data.pixels}
          editingCampaign={editingCampaign}
          onClose={onCloseModal}
          onSave={onSaveCampaign}
        />
      )}
    </div>
  );
}

interface CampaignFormModalProps {
  pixels: OverviewResponse['pixels'];
  editingCampaign: CampaignConfig | null;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>, editingId?: string) => Promise<void>;
}

function CampaignFormModal({
  pixels,
  editingCampaign,
  onClose,
  onSave,
}: CampaignFormModalProps) {
  const [name, setName] = useState(editingCampaign?.name || '');
  const [slug, setSlug] = useState(editingCampaign?.slug || '');
  const [slugEdited, setSlugEdited] = useState(Boolean(editingCampaign));
  const [pixelConfigId, setPixelConfigId] = useState(
    editingCampaign?.pixelConfigId || pixels[0]?.id || ''
  );
  const [zeydooOfferUrl, setZeydooOfferUrl] = useState(
    editingCampaign?.zeydooOfferUrl || 'https://zeydoo.com/offer?offer_id=&ymid={ymid}'
  );
  const [zeydooOfferId, setZeydooOfferId] = useState(editingCampaign?.zeydooOfferId || '');
  const [redirectMode, setRedirectMode] = useState<RedirectMode>(
    editingCampaign?.redirectMode || 'direct_302'
  );
  const [metaEventName, setMetaEventName] = useState<MetaEventName>(
    editingCampaign?.metaEventName || 'Purchase'
  );
  const [defaultPayout, setDefaultPayout] = useState(
    String(editingCampaign?.defaultPayout ?? 1.5)
  );
  const [sendOnlyApproved, setSendOnlyApproved] = useState(
    editingCampaign ? editingCampaign.sendOnlyApproved : true
  );
  const [firePageViewCapi, setFirePageViewCapi] = useState(
    editingCampaign ? editingCampaign.firePageViewCapi : false
  );
  const [postbackSecret, setPostbackSecret] = useState(editingCampaign?.postbackSecret || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugEdited) {
      setSlug(slugify(val));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Campaign name is required.');
      return;
    }
    if (!pixelConfigId) {
      setError('Please create and select a Meta Pixel profile first.');
      return;
    }
    try {
      new URL(zeydooOfferUrl.trim());
    } catch {
      setError('Enter a valid Zeydoo Offer URL starting with https:// or http://.');
      return;
    }

    setSaving(true);
    try {
      await onSave(
        {
          name: name.trim(),
          slug: slug.trim() || slugify(name),
          pixelConfigId,
          zeydooOfferUrl: zeydooOfferUrl.trim(),
          zeydooOfferId: zeydooOfferId.trim(),
          redirectMode,
          metaEventName,
          defaultPayout: Number(defaultPayout) || 0,
          sendOnlyApproved,
          firePageViewCapi,
          postbackSecret: postbackSecret.trim(),
        },
        editingCampaign?.id
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save campaign.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="campaign-modal-title"
    >
      <div className="w-full max-w-xl max-h-[92vh] flex flex-col bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 id="campaign-modal-title" className="text-base font-semibold text-slate-900">
            {editingCampaign ? 'Edit Tracking Campaign' : 'New Facebook to Zeydoo Campaign'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close campaign dialog"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="camp-name" className="block text-xs font-medium text-slate-700 mb-1">
                Campaign Name
              </label>
              <input
                id="camp-name"
                type="text"
                required
                placeholder="e.g. Survey Offer US"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-full h-9 px-3 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label htmlFor="camp-slug" className="block text-xs font-medium text-slate-700 mb-1">
                Tracking Link Slug
              </label>
              <input
                id="camp-slug"
                type="text"
                required
                placeholder="survey-offer-us"
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(e.target.value);
                }}
                className="w-full h-9 px-3 text-xs font-mono border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <label htmlFor="camp-offer-url" className="block text-xs font-medium text-slate-700 mb-1">
              Zeydoo Offer URL
            </label>
            <input
              id="camp-offer-url"
              type="url"
              required
              placeholder="https://zeydoo.com/offer?id=12345&ymid={ymid}"
              value={zeydooOfferUrl}
              onChange={(e) => setZeydooOfferUrl(e.target.value)}
              className="w-full h-9 px-3 text-xs font-mono border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Include <code className="font-mono">{'{ymid}'}</code> anywhere or let ZeyBridge append <code className="font-mono">?ymid=click_id</code> automatically.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="camp-pixel" className="block text-xs font-medium text-slate-700 mb-1">
                Meta Pixel &amp; CAPI Profile
              </label>
              <select
                id="camp-pixel"
                value={pixelConfigId}
                onChange={(e) => setPixelConfigId(e.target.value)}
                className="w-full h-9 px-2.5 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:border-blue-600"
              >
                {pixels.length === 0 && <option value="">No pixels configured</option>}
                {pixels.map((px) => (
                  <option key={px.id} value={px.id}>
                    {px.name} ({px.pixelId})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="camp-event" className="block text-xs font-medium text-slate-700 mb-1">
                Meta Conversion Event
              </label>
              <select
                id="camp-event"
                value={metaEventName}
                onChange={(e) => setMetaEventName(e.target.value as MetaEventName)}
                className="w-full h-9 px-2.5 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:border-blue-600"
              >
                <option value="Purchase">Purchase (Recommended for Revenue)</option>
                <option value="Lead">Lead (CPA / CPL Offers)</option>
                <option value="CompleteRegistration">CompleteRegistration</option>
                <option value="Subscribe">Subscribe</option>
                <option value="InitiateCheckout">InitiateCheckout</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="camp-redirect" className="block text-xs font-medium text-slate-700 mb-1">
                Redirect Mode
              </label>
              <select
                id="camp-redirect"
                value={redirectMode}
                onChange={(e) => setRedirectMode(e.target.value as RedirectMode)}
                className="w-full h-9 px-2.5 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:border-blue-600"
              >
                <option value="direct_302">Direct 302 (Fastest)</option>
                <option value="pixel_bridge">Pixel Bridge (Fires fbq)</option>
              </select>
            </div>

            <div>
              <label htmlFor="camp-offer-id" className="block text-xs font-medium text-slate-700 mb-1">
                Zeydoo Offer ID
              </label>
              <input
                id="camp-offer-id"
                type="text"
                placeholder="e.g. 20481"
                value={zeydooOfferId}
                onChange={(e) => setZeydooOfferId(e.target.value)}
                className="w-full h-9 px-3 text-xs font-mono border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label htmlFor="camp-payout" className="block text-xs font-medium text-slate-700 mb-1">
                Fallback Payout ($)
              </label>
              <input
                id="camp-payout"
                type="number"
                step="0.01"
                min="0"
                value={defaultPayout}
                onChange={(e) => setDefaultPayout(e.target.value)}
                className="w-full h-9 px-3 text-xs font-mono border border-slate-300 rounded-md focus:outline-none focus:border-blue-600 tabular-nums"
              />
            </div>
          </div>

          <div>
            <label htmlFor="camp-secret" className="block text-xs font-medium text-slate-700 mb-1">
              Optional Postback Secret Token
            </label>
            <input
              id="camp-secret"
              type="text"
              placeholder="Leave blank or set a secret token for Zeydoo postback URL"
              value={postbackSecret}
              onChange={(e) => setPostbackSecret(e.target.value)}
              className="w-full h-9 px-3 text-xs font-mono border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={sendOnlyApproved}
                onChange={(e) => setSendOnlyApproved(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              <span>Only send Meta CAPI conversions when Zeydoo status is Approved</span>
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={firePageViewCapi}
                onChange={(e) => setFirePageViewCapi(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              <span>Also send server-side PageView event to Meta CAPI on each ad click</span>
            </label>
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
              {saving ? 'Saving…' : editingCampaign ? 'Save Changes' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

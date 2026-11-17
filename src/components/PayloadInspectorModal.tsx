import { X } from 'lucide-react';
import type { ConversionRecord } from '../lib/trackingCore';
import { CopyButton } from './CopyButton';
import { CapiStatusLabel, ZeydooStatusLabel } from './StatusLabel';

interface PayloadInspectorModalProps {
  conversion: ConversionRecord | null;
  onClose: () => void;
  onRetryCapi: (conversionId: string) => Promise<void>;
  retryingId: string | null;
}

export function PayloadInspectorModal({
  conversion,
  onClose,
  onRetryCapi,
  retryingId,
}: PayloadInspectorModalProps) {
  if (!conversion) return null;

  const payloadJson = JSON.stringify(conversion.capiPayload, null, 2);
  const responseJson = conversion.capiResponse ? JSON.stringify(conversion.capiResponse, null, 2) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inspector-title"
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="inspector-title" className="text-base font-semibold text-slate-900">
              Conversion &amp; Meta CAPI Payload Inspector
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5 tabular-nums">
              {conversion.clickId} · {conversion.eventId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close payload inspector"
            className="p-2 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-4 border-b border-slate-200 text-xs">
            <div>
              <div className="text-slate-500 mb-1">Zeydoo Status</div>
              <ZeydooStatusLabel status={conversion.normalizedStatus} />
            </div>
            <div>
              <div className="text-slate-500 mb-1">Payout</div>
              <div className="font-mono font-semibold text-slate-900 tabular-nums">
                ${conversion.payout.toFixed(2)} {conversion.currency}
              </div>
            </div>
            <div>
              <div className="text-slate-500 mb-1">Meta Event</div>
              <div className="font-medium text-slate-900">{conversion.metaEventName}</div>
            </div>
            <div>
              <div className="text-slate-500 mb-1">CAPI Delivery</div>
              <CapiStatusLabel status={conversion.capiStatus} />
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="font-medium text-slate-900">Attribution Keys</div>
            <div className="grid grid-cols-1 gap-1.5 font-mono text-[11px] bg-slate-50 border border-slate-200 rounded-md p-3 text-slate-700 break-all">
              <div>
                <span className="text-slate-500">Pixel ID:</span> {conversion.pixelId || 'Not assigned'}
              </div>
              <div>
                <span className="text-slate-500">fbclid:</span> {conversion.fbclid || 'None captured'}
              </div>
              <div>
                <span className="text-slate-500">fbc:</span> {conversion.fbc || 'None'}
              </div>
              {conversion.capiFbtraceId && (
                <div>
                  <span className="text-slate-500">Meta fbtrace_id:</span> {conversion.capiFbtraceId}
                </div>
              )}
            </div>
          </div>

          {conversion.capiErrorMessage && (
            <div className="text-xs text-slate-700 bg-amber-50 border border-amber-200 rounded-md px-3.5 py-2.5">
              {conversion.capiErrorMessage}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-900">
                Meta Conversions API v21.0 Request JSON
              </span>
              <CopyButton text={payloadJson} label="Copy JSON" ariaLabel="Copy CAPI JSON payload" />
            </div>
            <pre className="text-[11px] font-mono bg-slate-900 text-slate-100 rounded-md p-4 overflow-x-auto leading-relaxed">
              {payloadJson}
            </pre>
          </div>

          {responseJson && (
            <div className="space-y-2">
              <span className="text-xs font-medium text-slate-900">Meta Graph API Response</span>
              <pre className="text-[11px] font-mono bg-slate-50 border border-slate-200 text-slate-800 rounded-md p-3 overflow-x-auto leading-relaxed">
                {responseJson}
              </pre>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={() => onRetryCapi(conversion.id)}
            disabled={retryingId === conversion.id}
            className="px-4 py-2 text-xs font-medium rounded-md border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            {retryingId === conversion.id ? 'Dispatching to Meta…' : 'Send / Retry to Meta CAPI'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-md bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

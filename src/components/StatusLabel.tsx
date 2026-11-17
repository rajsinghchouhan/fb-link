import { AlertCircle, CheckCircle2, Clock, MinusCircle } from 'lucide-react';
import type { CapiDeliveryStatus, ZeydooStatus } from '../lib/trackingCore';

export function CapiStatusLabel({ status }: { status: CapiDeliveryStatus }) {
  switch (status) {
    case 'delivered':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Delivered</span>
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 whitespace-nowrap">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Failed</span>
        </span>
      );
    case 'simulated':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Dry-Run</span>
        </span>
      );
    case 'skipped_pending':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 whitespace-nowrap">
          <MinusCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Skipped (Pending)</span>
        </span>
      );
    case 'skipped_rejected':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 whitespace-nowrap">
          <MinusCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Skipped (Rejected)</span>
        </span>
      );
  }
}

export function ZeydooStatusLabel({ status }: { status: ZeydooStatus }) {
  switch (status) {
    case 'approved':
      return <span className="text-xs font-medium text-emerald-700 whitespace-nowrap">Approved</span>;
    case 'pending':
      return <span className="text-xs font-medium text-amber-700 whitespace-nowrap">Pending</span>;
    case 'rejected':
      return <span className="text-xs font-medium text-red-700 whitespace-nowrap">Rejected</span>;
    default:
      return <span className="text-xs font-medium text-slate-600 whitespace-nowrap">Unknown</span>;
  }
}

import crypto from 'node:crypto';
import type { CapiDeliveryStatus } from '../src/lib/trackingCore.ts';

export function sha256Lower(value: string | undefined | null): string {
  const clean = (value || '').trim().toLowerCase();
  if (!clean) return '';
  return crypto.createHash('sha256').update(clean).digest('hex');
}

export interface CapiDispatchResult {
  status: CapiDeliveryStatus;
  httpStatus: number | null;
  fbtraceId: string;
  errorMessage: string;
  response: Record<string, unknown> | null;
}

export async function dispatchToMetaCapi(params: {
  pixelId: string;
  accessToken: string;
  payload: Record<string, unknown>;
}): Promise<CapiDispatchResult> {
  const pixelId = params.pixelId.trim();
  const accessToken = params.accessToken.trim();

  if (!pixelId || !accessToken) {
    return {
      status: 'simulated',
      httpStatus: null,
      fbtraceId: '',
      errorMessage: 'Meta CAPI Access Token not configured; recorded as dry-run preview.',
      response: null,
    };
  }

  const endpoint = `https://graph.facebook.com/v21.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params.payload),
      signal: AbortSignal.timeout(10000),
    });

    const text = await res.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = { rawBody: text };
    }

    const fbtraceId =
      typeof parsed?.fbtrace_id === 'string'
        ? parsed.fbtrace_id
        : typeof (parsed?.error as Record<string, unknown> | undefined)?.fbtrace_id === 'string'
          ? String((parsed?.error as Record<string, unknown>).fbtrace_id)
          : '';

    if (!res.ok) {
      const errObj = parsed?.error as Record<string, unknown> | undefined;
      const errMsg =
        typeof errObj?.message === 'string'
          ? errObj.message
          : `Meta Graph API returned HTTP ${res.status}`;
      return {
        status: 'failed',
        httpStatus: res.status,
        fbtraceId,
        errorMessage: errMsg,
        response: parsed,
      };
    }

    return {
      status: 'delivered',
      httpStatus: res.status,
      fbtraceId,
      errorMessage: '',
      response: parsed,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error connecting to Meta Graph API';
    return {
      status: 'failed',
      httpStatus: null,
      fbtraceId: '',
      errorMessage: message,
      response: null,
    };
  }
}

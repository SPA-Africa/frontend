// Thin fetch wrapper used in live mode. Every request carries:
//   Authorization: Bearer <access token>      short-lived JWT (SRS NFR-SEC.3)
//   Accept-Language: en | fr | rw             i18n (SRS NFR-UX.1)
//   X-Trace-Id: <uuid>                        distributed tracing (SRS NFR-MAINT.1)
//   Idempotency-Key: <uuid>                   on writes, so offline replays are safe (SRS 2.2.1)
// The refresh token lives in an httpOnly cookie set by POST /api/core/auth/refresh.

import { GATEWAY_URL, SERVICE_PREFIX, type Service } from './config';

export interface ApiErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown>; traceId?: string };
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: Record<string, unknown>, public traceId?: string) {
    super(message);
  }
}

let accessToken: string | null = null;
let locale = 'en';

export const setAccessToken = (t: string | null) => { accessToken = t; };
export const getAccessToken = () => accessToken;
export const setRequestLocale = (l: string) => { locale = l; };

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function buildUrl(service: Service, path: string, params?: Record<string, string | number>, query?: Record<string, unknown>) {
  const filled = path.replace(/:([a-zA-Z_]+)/g, (_, k) => {
    const v = params?.[k];
    if (v === undefined) throw new Error(`Missing path param "${k}" for ${path}`);
    return encodeURIComponent(String(v));
  });
  const qs = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    if (Array.isArray(v)) v.forEach(x => qs.append(k, String(x)));
    else qs.set(k, String(v));
  });
  const q = qs.toString();
  return `${GATEWAY_URL}${SERVICE_PREFIX[service]}${filled}${q ? `?${q}` : ''}`;
}

async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch(`${GATEWAY_URL}${SERVICE_PREFIX.core}/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (!res.ok) return false;
    const data = (await res.json()) as { accessToken: string };
    setAccessToken(data.accessToken);
    return true;
  } catch {
    return false;
  }
}

export interface RequestOptions {
  method: string;
  body?: unknown;
  signal?: AbortSignal;
  idempotencyKey?: string;
  retried?: boolean;
}

export async function request<T>(url: string, opts: RequestOptions): Promise<T> {
  const traceId = newId();
  const headers: Record<string, string> = { Accept: 'application/json', 'Accept-Language': locale, 'X-Trace-Id': traceId };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (opts.method !== 'GET') headers['Idempotency-Key'] = opts.idempotencyKey ?? newId();
  const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  if (opts.body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method: opts.method,
    headers,
    body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
    credentials: 'include',
    signal: opts.signal,
  });

  if (res.status === 401 && !opts.retried && (await refreshAccessToken())) {
    return request<T>(url, { ...opts, retried: true });
  }
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const e = (data as ApiErrorBody | undefined)?.error;
    throw new ApiError(res.status, e?.code ?? 'http_error', e?.message ?? res.statusText, e?.details, e?.traceId ?? traceId);
  }
  return data as T;
}

/** Upload a file straight to MinIO with a pre-signed URL (SRS FR-A3.3). Files never pass through the app server. */
export async function uploadToPresignedUrl(url: string, file: File, onProgress?: (share: number) => void) {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = e => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new ApiError(xhr.status, 'upload_failed', 'Upload failed')));
    xhr.onerror = () => reject(new ApiError(0, 'network_error', 'Network error during upload'));
    xhr.send(file);
  });
}

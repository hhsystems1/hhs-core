import { apiUrl } from './config';
import { clearStoredSession, getStoredToken } from './auth';
import { isLocalToken } from './localAuth';

export function getAuthHeaders(extra: HeadersInit = {}): HeadersInit {
  const session = getStoredToken();
  return session ? { ...extra, Authorization: `Bearer ${session}` } : extra;
}

export { clearStoredSession };

export async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const fullUrl = apiUrl(url);
  const r = await fetch(fullUrl, {
    ...options,
    headers: getAuthHeaders(options.headers || {}),
  });
  if (r.status === 401 && !isLocalToken(getStoredToken())) clearStoredSession();
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${fullUrl}`);
  return (await r.json()) as T;
}

export function formatWhen(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

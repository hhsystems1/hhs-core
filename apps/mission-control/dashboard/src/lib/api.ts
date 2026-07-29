import { apiUrl } from './config';

export function getAuthHeaders(extra: HeadersInit = {}): HeadersInit {
  const session = localStorage.getItem('session');
  return session ? { ...extra, Authorization: `Bearer ${session}` } : extra;
}

export function clearStoredSession() {
  localStorage.removeItem('session');
  localStorage.removeItem('user');
  window.dispatchEvent(new Event('mission-control:unauthorized'));
}

export async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const fullUrl = apiUrl(url);
  const r = await fetch(fullUrl, {
    ...options,
    headers: getAuthHeaders(options.headers || {}),
  });
  if (r.status === 401) clearStoredSession();
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${fullUrl}`);
  return (await r.json()) as T;
}

export function formatWhen(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

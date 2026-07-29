const API_BASE = import.meta.env.VITE_API_URL || '';

export function apiUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${API_BASE}${path}`;
}

export function wsUrl(): string | undefined {
  return import.meta.env.VITE_WS_URL || undefined;
}

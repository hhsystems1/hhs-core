const API_BASE = import.meta.env.VITE_API_URL || '';

function normalizeBase(base: string): string {
  return base.replace(/\/+$/, '');
}

function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

export function apiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  const base = normalizeBase(API_BASE);
  let requestPath = normalizePath(path);

  // Support both styles of VITE_API_URL:
  // - https://api.example.com
  // - https://api.example.com/api
  // The app always calls paths like "/api/auth/login", so strip the duplicated
  // prefix only when the base already ends with "/api".
  if (base.endsWith('/api') && requestPath === '/api') {
    requestPath = '';
  } else if (base.endsWith('/api') && requestPath.startsWith('/api/')) {
    requestPath = requestPath.slice(4);
  }

  return `${base}${requestPath}`;
}

export function wsUrl(): string | undefined {
  return import.meta.env.VITE_WS_URL || undefined;
}

const SESSION_KEY = 'session';
const USER_KEY = 'user';
export const AUTH_EVENT = 'mission-control:auth-changed';

export interface StoredUser {
  id?: string;
  email?: string;
  user_metadata?: { full_name?: string };
}

export function getStoredToken(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function getStoredUser(): StoredUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function setStoredSession(token: string, user: StoredUser) {
  localStorage.setItem(SESSION_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function clearStoredSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function onAuthChanged(fn: () => void): () => void {
  window.addEventListener(AUTH_EVENT, fn);
  return () => window.removeEventListener(AUTH_EVENT, fn);
}

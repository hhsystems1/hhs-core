import type { StoredUser } from './auth';

export interface LocalAuthResult {
  token: string;
  user: StoredUser;
}

const LOCAL_USERS: Record<string, string> = {
  hhs: 'laimta',
};

export function authenticateLocal(username: string, password: string): LocalAuthResult | null {
  const name = username.trim().toLowerCase();
  if (!LOCAL_USERS[name] || LOCAL_USERS[name] !== password) return null;
  return {
    token: `local-${name}`,
    user: {
      email: `${name}@hhs.local`,
      user_metadata: { full_name: name.toUpperCase() },
    },
  };
}

export function isLocalToken(token: string | null): boolean {
  return !!token && token.startsWith('local-');
}

-- Durable auth sessions.
-- Replaces the API's in-memory session Map so logins survive process restarts
-- and work across multiple API instances. Session ids are UUIDs issued by
-- POST /api/auth/login and carried as Bearer tokens.

create table if not exists auth_sessions (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_auth_sessions_user on auth_sessions(user_id);
create index if not exists idx_auth_sessions_expires on auth_sessions(expires_at);

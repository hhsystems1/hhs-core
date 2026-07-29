-- Agent Context Store: persistent memory for AI agents (OpenClaw, Hermes, etc.)
-- Allows agents to save/retrieve context when context windows reset or bots switch.

-- Note: vector(1536) column omitted until pgvector is installed locally.
-- The existing knowledge_chunks.embedding column shows the intended pattern.

create table if not exists agent_context_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  agent_id text not null,
  session_id text not null,
  context_type text not null default 'state' check (context_type in ('state', 'conversation', 'decision', 'observation', 'handoff')),
  summary text,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists idx_agent_context_tenant_session on agent_context_log(tenant_id, session_id);
create index if not exists idx_agent_context_tenant_agent on agent_context_log(tenant_id, agent_id);
create index if not exists idx_agent_context_tenant_created on agent_context_log(tenant_id, created_at desc);
create index if not exists idx_agent_context_tenant_type on agent_context_log(tenant_id, context_type);

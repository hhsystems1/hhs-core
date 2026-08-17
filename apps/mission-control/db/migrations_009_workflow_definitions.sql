-- Workflow definitions: saved visual graphs for agent orchestration.
-- Each row stores a React Flow graph (nodes + edges) that can be executed.

create table if not exists workflow_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  name text not null,
  description text not null default '',
  nodes_json jsonb not null default '[]'::jsonb,
  edges_json jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workflow_definitions_tenant on workflow_definitions(tenant_id);
create index if not exists idx_workflow_definitions_active on workflow_definitions(tenant_id, is_active) where is_active = true;

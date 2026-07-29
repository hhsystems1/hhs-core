-- Core infrastructure tables: events, artifacts, review, tools, entities, knowledge
-- These tables were created ad-hoc and never had migration files.

-- 1) events_v2 — structured activity log
create table if not exists events_v2 (
  id uuid primary key default gen_random_uuid(),
  event_level text not null check (event_level in ('system','ingestion','review','decision','deployment','error','milestone')),
  event_type text not null,
  occurred_at timestamptz not null default now(),
  actor text,
  artifact_id uuid,
  workspace_id uuid,
  person_id uuid,
  payload_json jsonb not null default '{}'::jsonb
);

create index if not exists idx_events_v2_occurred on events_v2(occurred_at desc);
create index if not exists idx_events_v2_level on events_v2(event_level);
create index if not exists idx_events_v2_type on events_v2(event_type);
create index if not exists idx_events_v2_actor on events_v2(actor);
create index if not exists idx_events_v2_artifact on events_v2(artifact_id);

-- 2) artifacts — traceable knowledge units
create table if not exists artifacts (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_ref text not null,
  title text,
  artifact_type text not null,
  scope text not null default 'personal_context',
  sensitivity text not null default 'personal',
  attributes jsonb not null default '{}'::jsonb,
  status text not null default 'captured' check (status in ('captured','processing','ready','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_ref)
);

create index if not exists idx_artifacts_scope on artifacts(scope);
create index if not exists idx_artifacts_type on artifacts(artifact_type);
create index if not exists idx_artifacts_source on artifacts(source, source_ref);

-- 3) artifact_anchors — links artifacts to entities
create table if not exists artifact_anchors (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references artifacts(id) on delete cascade,
  anchor_entity_id uuid not null,
  anchor_type text not null check (anchor_type in ('person','workspace')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (artifact_id, anchor_entity_id)
);

create index if not exists idx_artifact_anchors_artifact on artifact_anchors(artifact_id);
create index if not exists idx_artifact_anchors_entity on artifact_anchors(anchor_entity_id);

-- 4) review_queue — artifact promotion review pipeline
create table if not exists review_queue (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references artifacts(id) on delete cascade,
  requested_by text not null,
  reviewer text not null default 'stephen',
  review_type text not null default 'promotion',
  status text not null default 'queued' check (status in ('queued','in_review','changes_requested','approved','rejected','promoted')),
  decision text check (decision in ('approved','rejected','changes_requested')),
  promotion_target text check (promotion_target in ('business_core','workspace')),
  target_workspace_id uuid,
  notes text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists idx_review_queue_status on review_queue(status);
create index if not exists idx_review_queue_artifact on review_queue(artifact_id);
create index if not exists idx_review_queue_requested on review_queue(requested_at desc);

-- 5) tool_registry — available tools/agents
create table if not exists tool_registry (
  id uuid primary key default gen_random_uuid(),
  tool_id text not null unique,
  display_name text not null,
  category text,
  role text,
  capabilities jsonb not null default '[]'::jsonb,
  preferred_task_types jsonb not null default '[]'::jsonb,
  preferred_input_format text,
  preferred_output_format text,
  strengths jsonb not null default '[]'::jsonb,
  weaknesses jsonb not null default '[]'::jsonb,
  review_requirements jsonb not null default '{}'::jsonb,
  runtime_model text,
  status text not null default 'active',
  routing_priority int not null default 10,
  auto_select boolean not null default false,
  fallback_order jsonb not null default '[]'::jsonb,
  cost_profile text not null default 'low',
  latency_profile text not null default 'fast',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tool_registry_tool_id on tool_registry(tool_id);
create index if not exists idx_tool_registry_category on tool_registry(category);

-- 6) tool_run_log — execution history of tools
create table if not exists tool_run_log (
  id uuid primary key default gen_random_uuid(),
  tool_id text not null,
  task_summary text,
  task_type text,
  input_reference jsonb default '{}'::jsonb,
  output_reference jsonb default '{}'::jsonb,
  status text not null default 'running' check (status in ('running','success','partial','failed','cancelled')),
  root_run_id uuid,
  sequence_index int default 0,
  initiated_by text default 'system',
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_tool_run_log_tool on tool_run_log(tool_id);
create index if not exists idx_tool_run_log_root on tool_run_log(root_run_id);
create index if not exists idx_tool_run_log_status on tool_run_log(status);
create index if not exists idx_tool_run_log_started on tool_run_log(started_at desc);

-- 7) knowledge_documents_v2 — knowledge base documents
create table if not exists knowledge_documents_v2 (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid references artifacts(id) on delete set null,
  title text,
  scope text not null default 'personal_context',
  summary text,
  tags jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_knowledge_docs_v2_scope on knowledge_documents_v2(scope);
create index if not exists idx_knowledge_docs_v2_artifact on knowledge_documents_v2(artifact_id);

-- 8) knowledge_chunks_v2 — chunked content with optional vector embeddings
create table if not exists knowledge_chunks_v2 (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references knowledge_documents_v2(id) on delete cascade,
  chunk_index int not null,
  text text not null,
  tags jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_knowledge_chunks_v2_doc on knowledge_chunks_v2(document_id);

-- 9) entities — people, organizations, workspaces
create table if not exists entities (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('person','organization','workspace')),
  display_name text not null,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_entities_type on entities(entity_type);

-- 10) entity_links — relationships between entities
create table if not exists entity_links (
  id uuid primary key default gen_random_uuid(),
  from_entity_id uuid not null references entities(id) on delete cascade,
  to_entity_id uuid not null references entities(id) on delete cascade,
  relationship_type text not null,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_entity_links_from on entity_links(from_entity_id);
create index if not exists idx_entity_links_to on entity_links(to_entity_id);
create index if not exists idx_entity_links_type on entity_links(relationship_type);

-- Context documents: .md uploads (information + links) that agents can look up.
-- Kept separate from agent_context_log so uploaded reference material is durable
-- and links are parsed out for quick scanning.

create table if not exists context_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  title text not null,
  filename text not null,
  content text not null,
  links jsonb not null default '[]'::jsonb,
  source text not null default 'upload',
  uploaded_by text default 'stephen',
  artifact_id uuid,
  knowledge_document_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_context_documents_tenant on context_documents(tenant_id);
create index if not exists idx_context_documents_created on context_documents(created_at desc);

-- Phase 1 Slice C: tenant-safe CRM core foundation
-- Additive only: create product-owned CRM tables without dropping/renaming existing compatibility tables.

create extension if not exists pgcrypto;

create table if not exists crm_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  source_business_id uuid,
  name text not null,
  account_type text not null default 'organization' check (account_type in ('organization', 'customer', 'partner', 'vendor', 'referral_source', 'software_customer', 'internal')),
  lifecycle_stage text not null default 'unknown',
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  website_url text,
  primary_email text,
  primary_phone text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, source_business_id)
);

create table if not exists crm_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  account_id uuid references crm_accounts(id) on delete set null,
  source_person_id uuid,
  full_name text not null,
  primary_email text,
  primary_phone text,
  lifecycle_stage text not null default 'unknown',
  status text not null default 'active' check (status in ('active', 'inactive', 'archived', 'do_not_contact')),
  role_title text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, source_person_id)
);

create table if not exists crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  account_id uuid references crm_accounts(id) on delete set null,
  contact_id uuid references crm_contacts(id) on delete set null,
  name text not null,
  pipeline text not null default 'general',
  stage text not null default 'new',
  status text not null default 'open' check (status in ('open', 'won', 'lost', 'paused', 'archived')),
  estimated_value_cents integer,
  expected_close_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists crm_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  account_id uuid references crm_accounts(id) on delete set null,
  contact_id uuid references crm_contacts(id) on delete set null,
  opportunity_id uuid references crm_opportunities(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'cancelled', 'archived')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  due_at timestamptz,
  assigned_user_id uuid references users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_crm_accounts_tenant_name on crm_accounts(tenant_id, name);
create index if not exists idx_crm_accounts_tenant_status on crm_accounts(tenant_id, status);
create index if not exists idx_crm_contacts_tenant_name on crm_contacts(tenant_id, full_name);
create index if not exists idx_crm_contacts_tenant_email on crm_contacts(tenant_id, primary_email);
create index if not exists idx_crm_contacts_account_id on crm_contacts(account_id);
create index if not exists idx_crm_opportunities_tenant_stage on crm_opportunities(tenant_id, pipeline, stage, status);
create index if not exists idx_crm_tasks_tenant_status_due on crm_tasks(tenant_id, status, due_at);

with default_tenant as (
  select id
  from tenants
  where slug = 'helping-hands-systems'
  limit 1
)
insert into crm_accounts (tenant_id, source_business_id, name, account_type, lifecycle_stage, status, metadata, created_at, updated_at)
select
  default_tenant.id,
  businesses.id,
  businesses.name,
  'organization',
  'unknown',
  'active',
  jsonb_build_object('source', 'businesses_compat_backfill'),
  businesses.created_at,
  now()
from businesses
cross join default_tenant
where businesses.name is not null
on conflict (tenant_id, source_business_id) do update set
  name = excluded.name,
  updated_at = now();

with default_tenant as (
  select id
  from tenants
  where slug = 'helping-hands-systems'
  limit 1
)
insert into crm_contacts (tenant_id, source_person_id, full_name, primary_email, primary_phone, lifecycle_stage, status, notes, metadata, created_at, updated_at)
select
  default_tenant.id,
  people.id,
  coalesce(nullif(people.full_name, ''), people.primary_email, people.primary_phone, 'Unknown Contact'),
  people.primary_email,
  people.primary_phone,
  'unknown',
  'active',
  people.notes,
  jsonb_build_object('source', 'people_compat_backfill'),
  people.created_at,
  now()
from people
cross join default_tenant
on conflict (tenant_id, source_person_id) do update set
  full_name = excluded.full_name,
  primary_email = excluded.primary_email,
  primary_phone = excluded.primary_phone,
  notes = excluded.notes,
  updated_at = now();

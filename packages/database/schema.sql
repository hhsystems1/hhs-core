-- HHS-CORE UNIFIED DATABASE SCHEMA
-- Version: 1.1.0
-- Hierarchy: Root (HHS) -> Tenant (Client) -> Sub-Account (Distributor/Partner)

-- 0. Extensions
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- 1. TENANCY CORE
create table if not exists tenants (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text unique not null,
    parent_tenant_id uuid references tenants(id),
    account_level text check (account_level in ('root', 'tenant', 'sub_account')) not null,
    status text not null default 'active' check (status in ('active', 'inactive', 'suspended', 'archived')),
    settings jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    email citext unique not null,
    full_name text,
    password_hash text,
    status text not null default 'active' check (status in ('active', 'invited', 'disabled', 'removed')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists tenant_memberships (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    role text not null check (role in ('owner', 'admin', 'manager', 'sales', 'ops', 'viewer', 'agent_service')),
    status text not null default 'active' check (status in ('invited', 'active', 'disabled', 'removed')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (tenant_id, user_id)
);

-- 2. CRM CORE (Unified)
create table if not exists crm_accounts (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants(id) on delete cascade,
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
    updated_at timestamptz not null default now()
);

create table if not exists crm_contacts (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants(id) on delete cascade,
    account_id uuid references crm_accounts(id) on delete set null,
    full_name text not null,
    primary_email text,
    primary_phone text,
    lifecycle_stage text not null default 'unknown',
    status text not null default 'active' check (status in ('active', 'inactive', 'archived', 'do_not_contact')),
    notes text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 3. AGENT ORCHESTRATION
create table if not exists agent_jobs (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants(id) on delete cascade,
    agent_id text not null,
    capability text not null,
    status text check (status in ('queued', 'running', 'needs_approval', 'completed', 'failed')) default 'queued',
    approval_required boolean default false,
    input jsonb,
    result jsonb,
    artifacts jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists agent_runs (
    id uuid primary key default gen_random_uuid(),
    job_id uuid references agent_jobs(id) on delete cascade,
    tenant_id uuid not null references tenants(id) on delete cascade,
    step_index int not null,
    action text not null,
    output text,
    status text,
    created_at timestamptz not null default now()
);

-- 4. MIGRATION LOGIC (The "Launderette")
-- Map legacy CRM distributors to the new Tenant model
do $$
begin
    -- Create the Root HHS Tenant first
    insert into tenants (name, slug, account_level, status)
    values ('Helping Hands Systems', 'hhs-root', 'root', 'active')
    on conflict (slug) do nothing;

    -- Create the Fusion Tenant (Parent for distributors)
    insert into tenants (name, slug, parent_tenant_id, account_level, status)
    select 'Fusion 44X', 'fusion-core', id, 'tenant', 'active'
    from tenants where slug = 'hhs-root'
    on conflict (slug) do nothing;

    -- Migrate old CRM distributors into tenants as sub_accounts
    insert into tenants (name, slug, parent_tenant_id, account_level, status)
    select 
        name, 
        lower(replace(name, ' ', '-')) || '-dist', 
        (select id from tenants where slug = 'fusion-core'), 
        'sub_account', 
        status
    from public.distributors
    on conflict (slug) do nothing;

    -- Migrate old CRM leads into unified crm_contacts
    insert into crm_contacts (tenant_id, full_name, primary_email, status, created_at)
    select 
        (select id from tenants where slug = lower(replace(dist.name, ' ', '-')) || '-dist'),
        leads.name,
        null, -- CRM leads didn't have a primary_email field in original 001_schema.sql
        leads.status,
        leads.created_at
    from public.leads
    join public.distributors dist on leads.distributor_id = dist.id;
end $$;

-- 5. APPROVALS TABLE (New)
create table if not exists approvals (
    id          uuid primary key default gen_random_uuid(),
    command_id  uuid not null references agent_jobs(id) on delete cascade,
    tenant_id   uuid not null references tenants(id) on delete cascade,
    approved    boolean not null default false,
    created_at  timestamptz not null default now()
);
-- -----------------------------------------------------------------
-- 5a. DB Helper Functions (for approvals)
-- These helpers live in packages/database/src/helpers.ts
-- -----------------------------------------------------------------
-- INSERT helper
-- function dbInsert(table: string, data: any) {
--   return knexInsert(knex, table, data);
-- }
-- SELECT helper
-- function dbGet(table: string, id: any) {
--   return knexSelect(knex, table, id);
-- }
-- DELETE helper
-- function dbDelete(table: string, id: any) {
--   return knexDelete(knex, table, id);
-- }
-- END of helper functions
-- -----------------------------------------------------------------


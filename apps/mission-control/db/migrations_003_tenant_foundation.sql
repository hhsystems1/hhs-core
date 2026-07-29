-- Phase 1 Slice A: tenant foundation for CRM + Mission Control
-- Additive only: do not drop or rename existing tables.

create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended', 'archived')),
  plan text,
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
  source_person_id uuid,
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

create index if not exists idx_tenant_memberships_tenant_id on tenant_memberships(tenant_id);
create index if not exists idx_tenant_memberships_user_id on tenant_memberships(user_id);
create index if not exists idx_tenant_memberships_active_user on tenant_memberships(user_id, status);

insert into tenants (name, slug, status, settings)
values (
  'Helping Hands Systems',
  'helping-hands-systems',
  'active',
  jsonb_build_object('source', 'phase_1_slice_a_seed')
)
on conflict (slug) do update set
  name = excluded.name,
  status = excluded.status,
  updated_at = now();

-- Compatibility backfill: older local installs stored login fields on people.
-- Fresh installs do not have these columns, so guard this with catalog checks.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'people' and column_name = 'email'
  ) and exists (
    select 1 from information_schema.columns
    where table_name = 'people' and column_name = 'password_hash'
  ) then
    execute $sql$
      insert into users (email, full_name, password_hash, source_person_id, status, created_at, updated_at)
      select
        p.email,
        p.full_name,
        p.password_hash,
        p.id,
        'active',
        coalesce(p.created_at, now()),
        now()
      from people p
      where p.email is not null
        and p.password_hash is not null
      on conflict (email) do update set
        full_name = coalesce(excluded.full_name, users.full_name),
        password_hash = coalesce(users.password_hash, excluded.password_hash),
        source_person_id = coalesce(users.source_person_id, excluded.source_person_id),
        updated_at = now()
    $sql$;
  end if;
end $$;

insert into tenant_memberships (tenant_id, user_id, role, status)
select tenants.id, users.id, 'owner', 'active'
from tenants
cross join users
where tenants.slug = 'helping-hands-systems'
  and users.status = 'active'
on conflict (tenant_id, user_id) do nothing;

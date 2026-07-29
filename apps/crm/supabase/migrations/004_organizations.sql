-- ============================================================
-- Fusion 44X CRM — Organizations & Account Hierarchy
-- ============================================================

-- 1. Extend profiles role to include 'admin'
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'manufacturer', 'distributor', 'customer'));

-- 2. Add organization_id to profiles
alter table public.profiles
  add column if not exists organization_id uuid;

-- 3. Organizations table (without inline FKs so CREATE TABLE is idempotent)
create table if not exists public.organizations (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  type           text not null default 'manufacturer',
  parent_org_id  uuid,
  created_by     uuid,
  created_at     timestamptz not null default now()
);

-- Re-apply type check in case table already existed
alter table public.organizations
  drop constraint if exists organizations_type_check;

alter table public.organizations
  add constraint organizations_type_check
  check (type in ('hqs', 'manufacturer', 'distributor', 'customer'));

alter table public.organizations enable row level security;

-- 4. FKs (dropped first to be idempotent)
alter table public.profiles
  drop constraint if exists profiles_organization_id_fkey;

alter table public.profiles
  add constraint profiles_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete set null;

alter table public.organizations
  drop constraint if exists organizations_parent_org_id_fkey;

alter table public.organizations
  add constraint organizations_parent_org_id_fkey
  foreign key (parent_org_id) references public.organizations(id) on delete set null;

alter table public.organizations
  drop constraint if exists organizations_created_by_fkey;

alter table public.organizations
  add constraint organizations_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

-- 5. Indexes
create index if not exists idx_profiles_organization_id on public.profiles(organization_id);
create index if not exists idx_organizations_parent_org_id on public.organizations(parent_org_id);

-- 6. RLS Policies for organizations (dropped first to be idempotent)
drop policy if exists "Admins can read all organizations" on public.organizations;
create policy "Admins can read all organizations"
  on public.organizations for select
  using (
    exists (select 1 from public.profiles where user_id = auth.uid() and role = 'admin')
    or created_by = auth.uid()
  );

drop policy if exists "Admins can insert organizations" on public.organizations;
create policy "Admins can insert organizations"
  on public.organizations for insert
  with check (
    exists (select 1 from public.profiles where user_id = auth.uid() and role = 'admin')
  );

drop policy if exists "Admins can update organizations" on public.organizations;
create policy "Admins can update organizations"
  on public.organizations for update
  using (
    exists (select 1 from public.profiles where user_id = auth.uid() and role = 'admin')
  );

-- 7. Profiles RLS — admins read all
drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where user_id = auth.uid() and role = 'admin')
  );

-- 8. Seed organization: HQS (HHS)
insert into public.organizations (name, type)
values ('HHS', 'hqs')
on conflict do nothing;

-- 9. Manufacturing orgs get a manufacturer_org_id for RLS via org hierarchy
-- Update existing manufacturers to see data from their org and child orgs
-- This is handled via application-level filtering

-- 10. Create a default Fusion44x org
insert into public.organizations (name, type)
values ('Fusion44x', 'manufacturer')
on conflict do nothing;

-- Social post workflow for CRM2.1
-- Creates a durable queue for drafts, approvals, scheduling, and publishing.

create table if not exists public.social_posts (
  id             uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  created_by     uuid references auth.users(id) on delete set null,
  approved_by    uuid references auth.users(id) on delete set null,
  title          text not null,
  platform       text not null default 'instagram',
  content        text not null,
  campaign       text,
  status         text not null default 'Draft',
  scheduled_for  timestamptz,
  published_at   timestamptz,
  approval_notes text,
  post_url       text,
  media_url      text,
  created_at     timestamptz not null default now()
);

alter table public.social_posts enable row level security;

create index if not exists idx_social_posts_created_at
  on public.social_posts (created_at desc);

create index if not exists idx_social_posts_status
  on public.social_posts (status);

create index if not exists idx_social_posts_platform
  on public.social_posts (platform);

drop policy if exists "Authenticated users can read social_posts" on public.social_posts;
create policy "Authenticated users can read social_posts"
  on public.social_posts for select
  using (
    auth.role() = 'authenticated'
    and exists (
      select 1
      from public.profiles
      where user_id = auth.uid()
        and role in ('manufacturer', 'distributor')
    )
  );

drop policy if exists "Authenticated users can insert social_posts" on public.social_posts;
create policy "Authenticated users can insert social_posts"
  on public.social_posts for insert
  with check (
    auth.role() = 'authenticated'
    and exists (
      select 1
      from public.profiles
      where user_id = auth.uid()
        and role in ('manufacturer', 'distributor')
    )
  );

drop policy if exists "Authenticated users can update social_posts" on public.social_posts;
create policy "Authenticated users can update social_posts"
  on public.social_posts for update
  using (
    auth.role() = 'authenticated'
    and exists (
      select 1
      from public.profiles
      where user_id = auth.uid()
        and role in ('manufacturer', 'distributor')
    )
  )
  with check (
    auth.role() = 'authenticated'
    and exists (
      select 1
      from public.profiles
      where user_id = auth.uid()
        and role in ('manufacturer', 'distributor')
    )
  );

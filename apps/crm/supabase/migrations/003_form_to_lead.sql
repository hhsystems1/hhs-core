-- Form-to-Lead system: expand leads, add form_submissions, add RLS policies

-- Add columns to existing leads table
alter table public.leads add column if not exists email     text;
alter table public.leads add column if not exists phone     text;
alter table public.leads add column if not exists source    text not null default 'crm';
alter table public.leads add column if not exists notes     text;
alter table public.leads add column if not exists form_data jsonb default '{}';

-- Raw form submissions audit trail
create table if not exists public.form_submissions (
  id         uuid primary key default gen_random_uuid(),
  source_url text,
  form_name  text not null default 'Unknown',
  form_data  jsonb not null default '{}',
  lead_id    uuid references public.leads(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.form_submissions enable row level security;

-- RLS: leads
drop policy if exists "Anyone can insert leads" on public.leads;
create policy "Authenticated users can insert leads"
  on public.leads for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Users can update leads" on public.leads;
create policy "Manufacturers and distributors can update leads"
  on public.leads for update
  using (
    exists (select 1 from public.profiles where user_id = auth.uid() and role in ('manufacturer', 'distributor'))
  );

-- RLS: form_submissions
drop policy if exists "Authenticated users can read form_submissions" on public.form_submissions;
create policy "Authenticated users can read form_submissions"
  on public.form_submissions for select
  using (auth.role() = 'authenticated');

drop policy if exists "Service role can insert form_submissions" on public.form_submissions;
create policy "Service role can insert form_submissions"
  on public.form_submissions for insert
  with check (true);

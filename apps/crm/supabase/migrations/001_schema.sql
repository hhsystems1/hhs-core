-- ============================================================
-- Fusion 44X CRM — Full Database Schema
-- Run this in Supabase SQL Editor or via `supabase migration up`
-- ============================================================

-- 0. Extensions
create extension if not exists "pgcrypto";

-- 1. Profiles (extends auth.users)
create table if not exists public.profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade unique,
  role        text not null check (role in ('manufacturer', 'distributor', 'customer')) default 'customer',
  full_name   text,
  company     text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 2. Stripe products
create table if not exists public.products (
  id                 uuid primary key default gen_random_uuid(),
  stripe_product_id  text not null unique,
  name               text not null,
  description        text,
  active             boolean not null default true,
  metadata           jsonb default '{}',
  created_at         timestamptz not null default now()
);

alter table public.products enable row level security;

-- 3. Stripe prices
create table if not exists public.prices (
  id                uuid primary key default gen_random_uuid(),
  stripe_price_id   text not null unique,
  product_id        uuid not null references public.products(id) on delete cascade,
  currency          text not null default 'usd',
  unit_amount       integer not null,
  interval          text check (interval in ('one_time', 'month', 'year')),
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);

alter table public.prices enable row level security;

-- 4. Customer mapping (CRM user → Stripe customer)
create table if not exists public.customers (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade unique,
  stripe_customer_id  text not null unique,
  email               text,
  name                text,
  created_at          timestamptz not null default now()
);

alter table public.customers enable row level security;

-- 5. Orders
create table if not exists public.orders (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  stripe_session_id        text unique,
  stripe_payment_intent_id text unique,
  amount_total             integer not null,
  currency                 text not null default 'usd',
  status                   text not null default 'pending',
  customer_name            text,
  customer_email           text,
  created_at               timestamptz not null default now()
);

alter table public.orders enable row level security;

-- 6. Order items
create table if not exists public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  price_id       text not null,
  product_name   text not null,
  quantity       integer not null default 1,
  unit_amount    integer not null,
  amount_total   integer not null
);

alter table public.order_items enable row level security;

-- 7. Subscriptions
create table if not exists public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  stripe_subscription_id   text not null unique,
  status                   text not null,
  price_id                 uuid not null references public.prices(id),
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  cancel_at_period_end     boolean not null default false,
  created_at               timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- 8. Distributors
create table if not exists public.distributors (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  region        text,
  status        text not null default 'Active',
  revenue       text,
  contact_email text,
  created_at    timestamptz not null default now()
);

alter table public.distributors enable row level security;

-- 9. Leads
create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  distributor_id  uuid references public.distributors(id) on delete set null,
  name            text not null,
  company         text,
  score           integer default 0,
  status          text not null default 'New',
  date            text,
  created_at      timestamptz not null default now()
);

alter table public.leads enable row level security;

-- 10. Support tickets
create table if not exists public.support_tickets (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references auth.users(id) on delete cascade,
  subject       text not null,
  description   text,
  status        text not null default 'Open',
  priority      text not null default 'Med',
  assigned_to   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

alter table public.support_tickets enable row level security;

-- 11. Ticket messages
create table if not exists public.ticket_messages (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.support_tickets(id) on delete cascade,
  author_id  uuid not null references auth.users(id) on delete cascade,
  message    text not null,
  created_at timestamptz not null default now()
);

alter table public.ticket_messages enable row level security;

-- 12. Content assets
create table if not exists public.content_assets (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  type        text not null,
  views       integer default 0,
  engagement  text,
  status      text not null default 'Draft',
  file_url    text,
  created_at  timestamptz not null default now()
);

alter table public.content_assets enable row level security;

-- 13. Knowledge categories
create table if not exists public.knowledge_categories (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  icon_name  text,
  count      integer default 0,
  color      text default '#0057D9',
  created_at timestamptz not null default now()
);

alter table public.knowledge_categories enable row level security;

-- 14. Knowledge articles
create table if not exists public.knowledge_articles (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.knowledge_categories(id) on delete cascade,
  title       text not null,
  content     text,
  views       integer default 0,
  created_at  timestamptz not null default now()
);

alter table public.knowledge_articles enable row level security;

-- 15. Funnel metrics
create table if not exists public.funnel_metrics (
  id           uuid primary key default gen_random_uuid(),
  funnel_name  text not null,
  stage_name   text not null,
  count        integer not null default 0,
  recorded_at  timestamptz not null default now()
);

alter table public.funnel_metrics enable row level security;

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Profiles: users read own, admins read all
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = user_id);

-- Products: public read
create policy "Anyone can read products"
  on public.products for select
  using (true);

-- Prices: public read
create policy "Anyone can read prices"
  on public.prices for select
  using (true);

-- Customers: users read own
create policy "Users can read own customer record"
  on public.customers for select
  using (auth.uid() = user_id);

-- Orders: users read own, manufacturers read all
create policy "Users can read own orders"
  on public.orders for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where user_id = auth.uid() and role = 'manufacturer')
  );

-- Order items: inherited from orders
create policy "Users can read own order items"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
      and (orders.user_id = auth.uid()
        or exists (select 1 from public.profiles where user_id = auth.uid() and role = 'manufacturer'))
    )
  );

-- Subscriptions: users read own
create policy "Users can read own subscriptions"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Distributors: manufacturers CRUD, all read
create policy "Anyone can read distributors"
  on public.distributors for select
  using (true);

create policy "Manufacturers can insert distributors"
  on public.distributors for insert
  with check (exists (select 1 from public.profiles where user_id = auth.uid() and role = 'manufacturer'));

create policy "Manufacturers can update distributors"
  on public.distributors for update
  using (exists (select 1 from public.profiles where user_id = auth.uid() and role = 'manufacturer'));

-- Leads: distributor CRUD own, manufacturer reads all
create policy "Users can read leads"
  on public.leads for select
  using (
    exists (select 1 from public.profiles where user_id = auth.uid() and role = 'manufacturer')
    or distributor_id in (select id from public.distributors where contact_email = auth.email())
  );

-- Support tickets: customer CRUD own, agent reads assigned
create policy "Customers can read own tickets"
  on public.support_tickets for select
  using (auth.uid() = customer_id or assigned_to = auth.uid());

create policy "Customers can insert tickets"
  on public.support_tickets for insert
  with check (auth.uid() = customer_id);

-- Ticket messages: inherited
create policy "Users can read ticket messages"
  on public.ticket_messages for select
  using (
    exists (
      select 1 from public.support_tickets
      where support_tickets.id = ticket_messages.ticket_id
      and (support_tickets.customer_id = auth.uid() or support_tickets.assigned_to = auth.uid())
    )
  );

-- Content: public read
create policy "Anyone can read content"
  on public.content_assets for select
  using (true);

-- Knowledge: public read
create policy "Anyone can read knowledge categories"
  on public.knowledge_categories for select
  using (true);

create policy "Anyone can read knowledge articles"
  on public.knowledge_articles for select
  using (true);

-- Funnel metrics: public read
create policy "Anyone can read funnel metrics"
  on public.funnel_metrics for select
  using (true);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Auto-create profile on signup (trigger)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, role, company)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(
      nullif(new.raw_user_meta_data ->> 'role', ''),
      'customer'
    )::text,
    new.raw_user_meta_data ->> 'company'
  );
  return new;
end;
$$;

-- Trigger the function on auth.users insert
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- SEED DATA (mock data matching current UI)
-- ============================================================

insert into public.distributors (name, region, status, revenue) values
  ('AquaPure Systems', 'West Coast', 'Active', '$384K'),
  ('ClearWater Tech', 'Southeast', 'Active', '$291K'),
  ('HydroLogic Inc.', 'Northeast', 'Active', '$247K'),
  ('PureFlow Dist.', 'Midwest', 'Onboarding', '$112K');

insert into public.leads (distributor_id, name, company, score, status, date)
select id, 'Sarah Chen', 'BlueSpring Resorts', 92, 'Hot', 'Mar 12' from public.distributors where name = 'AquaPure Systems' limit 1;

insert into public.leads (distributor_id, name, company, score, status, date)
select id, 'Mike Torres', 'Coastal Spas', 78, 'Warm', 'Mar 11' from public.distributors where name = 'ClearWater Tech' limit 1;

insert into public.leads (distributor_id, name, company, score, status, date)
select id, 'Jen Kim', 'Elite Wellness', 85, 'Hot', 'Mar 10' from public.distributors where name = 'HydroLogic Inc.' limit 1;

insert into public.leads (distributor_id, name, company, score, status, date)
select id, 'Dave Ross', 'Aqua Luxury', 63, 'Warm', 'Mar 09' from public.distributors where name = 'PureFlow Dist.' limit 1;

insert into public.support_tickets (customer_id, subject, status, priority, assigned_to)
select id, 'Probe calibration error', 'Open', 'High', id from auth.users limit 1;

insert into public.knowledge_categories (title, icon_name, count, color) values
  ('Product Specs', 'BookOpen', 24, '#0057D9'),
  ('Installation Guides', 'Wrench', 18, '#0A66FF'),
  ('Troubleshooting', 'FileQuestion', 31, '#1A7AFF'),
  ('Training Materials', 'GraduationCap', 12, '#8BA0C4'),
  ('Compliance', 'Shield', 9, '#16A34A'),
  ('FAQ', 'HelpCircle', 45, '#F59E0B');

insert into public.content_assets (title, type, views, engagement, status) values
  ('Probe Installation Guide', 'Video', 12400, '8.2%', 'Published'),
  ('Water Quality 101', 'Blog', 8700, '6.8%', 'Published'),
  ('Advanced Troubleshooting', 'Guide', 5200, '12.1%', 'Draft'),
  ('ROI Calculator', 'Tool', 3800, '15.3%', 'Published');

insert into public.funnel_metrics (funnel_name, stage_name, count) values
  ('Spa & Wellness', 'Awareness', 40),
  ('Spa & Wellness', 'Interest', 28),
  ('Spa & Wellness', 'Consideration', 15),
  ('Spa & Wellness', 'Purchase', 8),
  ('Residential', 'Awareness', 120),
  ('Residential', 'Interest', 85),
  ('Residential', 'Consideration', 52),
  ('Residential', 'Purchase', 31),
  ('Commercial', 'Awareness', 65),
  ('Commercial', 'Interest', 42),
  ('Commercial', 'Consideration', 27),
  ('Commercial', 'Purchase', 14);

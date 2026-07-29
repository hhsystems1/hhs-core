-- Phase 1 Slice F/G: tenant-owned CRM timeline events
-- Additive only: create tenant-scoped CRM timeline records and backfill from legacy events.

create extension if not exists pgcrypto;

alter table events add column if not exists event_level text;
alter table events add column if not exists description text;

create table if not exists crm_timeline_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  contact_id uuid references crm_contacts(id) on delete set null,
  source_person_id uuid,
  legacy_event_id uuid,
  event_type text not null,
  event_level text,
  occurred_at timestamptz not null default now(),
  source_channel text,
  source_link_id text,
  workspace_id uuid,
  title text,
  description text,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, legacy_event_id)
);

create index if not exists idx_crm_timeline_events_tenant_contact_time
  on crm_timeline_events(tenant_id, contact_id, occurred_at desc);

create index if not exists idx_crm_timeline_events_tenant_person_time
  on crm_timeline_events(tenant_id, source_person_id, occurred_at desc);

create index if not exists idx_crm_timeline_events_tenant_type_time
  on crm_timeline_events(tenant_id, event_type, occurred_at desc);

insert into crm_timeline_events (
  tenant_id,
  contact_id,
  source_person_id,
  legacy_event_id,
  event_type,
  event_level,
  occurred_at,
  source_channel,
  source_link_id,
  workspace_id,
  title,
  description,
  payload_json,
  created_at
)
select
  crm_contacts.tenant_id,
  crm_contacts.id,
  events.person_id,
  events.id,
  coalesce(nullif(events.event_type, ''), 'event'),
  events.event_level,
  coalesce(events.occurred_at, now()),
  events.source_channel,
  events.source_link_id,
  events.workspace_id,
  coalesce(nullif(events.event_type, ''), 'event'),
  events.description,
  coalesce(events.payload_json, '{}'::jsonb),
  now()
from events
join crm_contacts
  on crm_contacts.source_person_id = events.person_id
where events.person_id is not null
on conflict (tenant_id, legacy_event_id) do update set
  contact_id = excluded.contact_id,
  source_person_id = excluded.source_person_id,
  event_type = excluded.event_type,
  event_level = excluded.event_level,
  occurred_at = excluded.occurred_at,
  source_channel = excluded.source_channel,
  source_link_id = excluded.source_link_id,
  workspace_id = excluded.workspace_id,
  title = excluded.title,
  description = excluded.description,
  payload_json = excluded.payload_json;

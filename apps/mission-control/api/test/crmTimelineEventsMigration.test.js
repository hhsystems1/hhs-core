import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve('../db/migrations_005_crm_timeline_events.sql');

test('CRM timeline migration creates tenant-owned timeline events additively', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');

  assert.match(sql, /create table if not exists\s+crm_timeline_events/i);
  assert.match(sql, /tenant_id\s+uuid\s+not null\s+references\s+tenants\(id\)/i);
  assert.match(sql, /contact_id\s+uuid\s+references\s+crm_contacts\(id\)/i);
  assert.match(sql, /legacy_event_id\s+uuid/i);
  assert.match(sql, /unique\s*\(tenant_id,\s*legacy_event_id\)/i);
  assert.match(sql, /idx_crm_timeline_events_tenant_contact_time/i);
  assert.match(sql, /insert into crm_timeline_events/i);
  assert.match(sql, /from events/i);
  assert.match(sql, /join crm_contacts/i);
  assert.match(sql, /on conflict\s*\(tenant_id,\s*legacy_event_id\)/i);
  assert.doesNotMatch(sql, /drop\s+table/i);
  assert.doesNotMatch(sql, /alter\s+table\s+\w+\s+rename/i);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve('../db/migrations_004_crm_core_foundation.sql');

test('CRM core foundation migration creates tenant-safe CRM tables additively', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');

  assert.match(sql, /create table if not exists\s+crm_accounts/i);
  assert.match(sql, /create table if not exists\s+crm_contacts/i);
  assert.match(sql, /create table if not exists\s+crm_opportunities/i);
  assert.match(sql, /create table if not exists\s+crm_tasks/i);
  assert.match(sql, /tenant_id\s+uuid\s+not null\s+references\s+tenants\(id\)/i);
  assert.match(sql, /source_business_id\s+uuid/i);
  assert.match(sql, /source_person_id\s+uuid/i);
  assert.match(sql, /insert into crm_accounts/i);
  assert.match(sql, /from businesses/i);
  assert.match(sql, /insert into crm_contacts/i);
  assert.match(sql, /from people/i);
  assert.doesNotMatch(sql, /drop\s+table/i);
  assert.doesNotMatch(sql, /alter\s+table\s+\w+\s+rename/i);
});

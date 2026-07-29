import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve('../db/migrations_003_tenant_foundation.sql');

test('tenant foundation migration is additive and seeds HHS default tenant', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');

  assert.match(sql, /create table if not exists\s+tenants/i);
  assert.match(sql, /create table if not exists\s+users/i);
  assert.match(sql, /create table if not exists\s+tenant_memberships/i);
  assert.match(sql, /helping-hands-systems/i);
  assert.match(sql, /insert into tenants/i);
  assert.doesNotMatch(sql, /drop\s+table/i);
  assert.doesNotMatch(sql, /alter\s+table\s+\w+\s+rename/i);
});

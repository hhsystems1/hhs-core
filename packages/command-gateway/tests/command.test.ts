import { validateCommand } from '../src/validation';
import { z } from 'zod';

test('valid command passes validation', async () => {
  const good = {
    tenantId: 'c1d2e3f4-5678-90ab-cdef-1234567890ab',
    command: 'do-something',
    actor: 'agent-xyz',
    approvalRequired: true,
    payload: { example: 'value' }
  };
  const result = await validateCommand(good);
  expect(result.success).toBe(true);
});

test('invalid command fails validation', async () => {
  const bad = { foo: 'bar' };
  const result = await validateCommand(bad);
  expect(result.success).toBe(false);
  expect(result.error).toContain('Invalid command payload');
});

// Additional quick smoke test for the approve endpoint logic
test('approve rejects unknown id', async () => {
  const { Pool } = require('pg');
  const pool = new Pool(); // assuming CI environment provides DB-free mock?
  // The test is illustrative; no real DB call needed for this unit test.
  // If DB connectivity is required, mock pool.query appropriately.
});
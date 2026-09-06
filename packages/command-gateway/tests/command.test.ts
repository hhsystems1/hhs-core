import { validateCommand } from '../src/validation';

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
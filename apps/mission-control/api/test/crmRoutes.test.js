import test from 'node:test';
import assert from 'node:assert/strict';
import { registerCrmRoutes } from '../crmRoutes.js';

function createFakeApp() {
  const routes = new Map();
  return {
    routes,
    get(path, handler) {
      routes.set(`GET ${path}`, handler);
    },
    post(path, handler) {
      routes.set(`POST ${path}`, handler);
    },
    patch(path, handler) {
      routes.set(`PATCH ${path}`, handler);
    },
  };
}

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('registers read-only CRM routes under /api/v1', () => {
  const app = createFakeApp();
  registerCrmRoutes(app, { query: async () => ({ rows: [] }) });

  assert.equal(typeof app.routes.get('GET /api/v1/crm/people'), 'function');
  assert.equal(typeof app.routes.get('GET /api/v1/crm/people/:personId'), 'function');
  assert.equal(typeof app.routes.get('GET /api/v1/crm/organizations'), 'function');
  assert.equal(typeof app.routes.get('GET /api/v1/crm/contacts'), 'function');
  assert.equal(typeof app.routes.get('GET /api/v1/crm/opportunities'), 'function');
  assert.equal(typeof app.routes.get('GET /api/v1/crm/people/:personId/timeline'), 'function');
  assert.equal(typeof app.routes.get('GET /api/v1/crm/tasks'), 'function');
  assert.equal(typeof app.routes.get('POST /api/v1/crm/people/:personId/tasks/draft'), 'function');
  assert.equal(typeof app.routes.get('PATCH /api/v1/crm/tasks/:taskId/review'), 'function');
});

test('GET /api/v1/crm/people returns normalized people from existing people table', async () => {
  const app = createFakeApp();
  const queries = [];
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params });
      return {
        rows: [
          {
            id: 'person-1',
            full_name: 'Jane Solar',
            email: 'jane@example.com',
            primary_email: null,
            primary_phone: '555-0100',
            notes: 'Interested in solar',
            created_at: '2026-05-11T00:00:00.000Z',
            updated_at: null,
          },
        ],
      };
    },
  };

  registerCrmRoutes(app, pool);
  const handler = app.routes.get('GET /api/v1/crm/people');
  const req = { query: { q: 'jane', limit: '25' }, tenant: { id: 'tenant-hhs' } };
  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.deepEqual(res.body.filter, { q: 'jane', limit: 25 });
  assert.deepEqual(res.body.people, [
    {
      id: 'person-1',
      full_name: 'Jane Solar',
      primary_email: 'jane@example.com',
      primary_phone: '555-0100',
      lifecycle_stage: 'unknown',
      notes: 'Interested in solar',
      created_at: '2026-05-11T00:00:00.000Z',
      updated_at: null,
      tenant_id: 'tenant-hhs',
    },
  ]);
  assert.match(queries[0].sql, /join people/i);
  assert.match(queries[0].sql, /people\.full_name ilike/i);
  assert.match(queries[0].sql, /from crm_contacts/i);
  assert.match(queries[0].sql, /crm_contacts\.tenant_id = \$1/i);
  assert.deepEqual(queries[0].params, ['tenant-hhs', '%jane%', 25]);
});

test('GET /api/v1/crm/people/:personId returns a normalized person profile with linked CRM contact', async () => {
  const app = createFakeApp();
  const queries = [];
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params });
      return {
        rows: [
          {
            id: 'person-1',
            full_name: 'Jane Solar',
            email: 'jane@example.com',
            primary_email: null,
            primary_phone: '555-0100',
            notes: 'Interested in solar',
            created_at: '2026-05-11T00:00:00.000Z',
            updated_at: '2026-05-12T00:00:00.000Z',
            contact_id: 'contact-1',
            account_id: 'account-1',
            contact_status: 'active',
            account_name: 'Jane Household',
          },
        ],
      };
    },
  };

  registerCrmRoutes(app, pool);
  const handler = app.routes.get('GET /api/v1/crm/people/:personId');
  const req = { params: { personId: 'person-1' }, query: {}, tenant: { id: 'tenant-hhs' } };
  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.deepEqual(res.body.person, {
    id: 'person-1',
    full_name: 'Jane Solar',
    primary_email: 'jane@example.com',
    primary_phone: '555-0100',
    lifecycle_stage: 'unknown',
    notes: 'Interested in solar',
    created_at: '2026-05-11T00:00:00.000Z',
    updated_at: '2026-05-12T00:00:00.000Z',
    tenant_id: 'tenant-hhs',
    crm_contact: {
      id: 'contact-1',
      account_id: 'account-1',
      status: 'active',
      account_name: 'Jane Household',
    },
  });
  assert.match(queries[0].sql, /from crm_contacts/i);
  assert.match(queries[0].sql, /join people/i);
  assert.match(queries[0].sql, /crm_contacts\.tenant_id = \$2/i);
  assert.deepEqual(queries[0].params, ['person-1', 'tenant-hhs']);
});

test('GET /api/v1/crm/people/:personId returns 404 when person is missing', async () => {
  const app = createFakeApp();
  const pool = { async query() { return { rows: [] }; } };

  registerCrmRoutes(app, pool);
  const handler = app.routes.get('GET /api/v1/crm/people/:personId');
  const req = { params: { personId: 'missing-person' }, query: {}, tenant: { id: 'tenant-hhs' } };
  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { ok: false, error: 'person not found', code: 'crm_person_not_found' });
});

test('GET /api/v1/crm/organizations returns tenant-safe CRM accounts', async () => {
  const app = createFakeApp();
  const queries = [];
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params });
      return {
        rows: [
          {
            id: 'account-1',
            tenant_id: 'tenant-hhs',
            source_business_id: 'business-1',
            name: 'Acme Roofing',
            account_type: 'customer',
            lifecycle_stage: 'lead',
            status: 'active',
            created_at: '2026-05-11T01:00:00.000Z',
            updated_at: '2026-05-12T01:00:00.000Z',
          },
        ],
      };
    },
  };

  registerCrmRoutes(app, pool);
  const handler = app.routes.get('GET /api/v1/crm/organizations');
  const req = { query: { q: 'acme', limit: '10' }, tenant: { id: 'tenant-hhs' } };
  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.deepEqual(res.body.filter, { q: 'acme', limit: 10 });
  assert.deepEqual(res.body.organizations, [
    {
      id: 'account-1',
      name: 'Acme Roofing',
      account_type: 'customer',
      lifecycle_stage: 'lead',
      status: 'active',
      source_business_id: 'business-1',
      created_at: '2026-05-11T01:00:00.000Z',
      updated_at: '2026-05-12T01:00:00.000Z',
      tenant_id: 'tenant-hhs',
    },
  ]);
  assert.match(queries[0].sql, /from crm_accounts/i);
  assert.match(queries[0].sql, /tenant_id = \$1/i);
  assert.match(queries[0].sql, /name ilike/i);
  assert.deepEqual(queries[0].params, ['tenant-hhs', '%acme%', 10]);
});

test('GET /api/v1/crm/contacts returns tenant-safe CRM contacts', async () => {
  const app = createFakeApp();
  const queries = [];
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params });
      return {
        rows: [
          {
            id: 'contact-1',
            tenant_id: 'tenant-hhs',
            source_person_id: 'person-1',
            account_id: 'account-1',
            full_name: 'Jane Solar',
            primary_email: 'jane@example.com',
            primary_phone: '555-0100',
            lifecycle_stage: 'lead',
            status: 'active',
            created_at: '2026-05-11T00:00:00.000Z',
            updated_at: '2026-05-12T00:00:00.000Z',
          },
        ],
      };
    },
  };

  registerCrmRoutes(app, pool);
  const handler = app.routes.get('GET /api/v1/crm/contacts');
  const req = { query: { q: 'jane', limit: '15' }, tenant: { id: 'tenant-hhs' } };
  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.deepEqual(res.body.filter, { q: 'jane', limit: 15 });
  assert.deepEqual(res.body.contacts, [
    {
      id: 'contact-1',
      full_name: 'Jane Solar',
      primary_email: 'jane@example.com',
      primary_phone: '555-0100',
      lifecycle_stage: 'lead',
      status: 'active',
      source_person_id: 'person-1',
      account_id: 'account-1',
      created_at: '2026-05-11T00:00:00.000Z',
      updated_at: '2026-05-12T00:00:00.000Z',
      tenant_id: 'tenant-hhs',
    },
  ]);
  assert.match(queries[0].sql, /from crm_contacts/i);
  assert.match(queries[0].sql, /tenant_id = \$1/i);
  assert.match(queries[0].sql, /full_name ilike/i);
  assert.deepEqual(queries[0].params, ['tenant-hhs', '%jane%', 15]);
});

test('GET /api/v1/crm/opportunities returns basic CRM pipeline rows', async () => {
  const app = createFakeApp();
  const queries = [];
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params });
      return {
        rows: [
          {
            id: 'opportunity-1',
            tenant_id: 'tenant-hhs',
            account_id: 'account-1',
            account_name: 'Jane Household',
            contact_id: 'contact-1',
            contact_name: 'Jane Solar',
            name: 'Jane solar install',
            pipeline: 'solar',
            stage: 'qualified',
            status: 'open',
            estimated_value_cents: 2200000,
            expected_close_date: '2026-06-01',
            created_at: '2026-05-11T00:00:00.000Z',
            updated_at: '2026-05-12T00:00:00.000Z',
          },
        ],
      };
    },
  };

  registerCrmRoutes(app, pool);
  const res = createResponse();
  await app.routes.get('GET /api/v1/crm/opportunities')({ query: { status: 'open', q: 'jane', limit: '12' }, tenant: { id: 'tenant-hhs' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.deepEqual(res.body.filter, { status: 'open', q: 'jane', limit: 12 });
  assert.equal(res.body.opportunities[0].name, 'Jane solar install');
  assert.equal(res.body.opportunities[0].account_name, 'Jane Household');
  assert.equal(res.body.opportunities[0].estimated_value_cents, 2200000);
  assert.match(queries[0].sql, /from crm_opportunities/i);
  assert.match(queries[0].sql, /left join crm_accounts/i);
  assert.match(queries[0].sql, /left join crm_contacts/i);
  assert.match(queries[0].sql, /crm_opportunities\.tenant_id = \$1/i);
  assert.deepEqual(queries[0].params, ['tenant-hhs', 'open', '%jane%', 12]);
});

test('GET /api/v1/crm/people/:personId/timeline returns normalized tenant-owned CRM timeline events', async () => {
  const app = createFakeApp();
  const queries = [];
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (/from crm_contacts/i.test(sql)) {
        return { rows: [{ id: 'contact-1' }] };
      }
      return {
        rows: [
          {
            id: 'event-1',
            event_type: 'bill.uploaded',
            event_level: 'milestone',
            occurred_at: '2026-05-11T02:00:00.000Z',
            source_channel: 'website',
            source_link_id: 'bill-123',
            workspace_id: 'workspace-1',
            person_id: 'person-1',
            title: 'bill.uploaded',
            description: 'Bill uploaded',
            payload_json: { bill_status: 'uploaded' },
          },
        ],
      };
    },
  };

  registerCrmRoutes(app, pool);
  const handler = app.routes.get('GET /api/v1/crm/people/:personId/timeline');
  const req = {
    params: { personId: 'person-1' },
    query: { limit: '20' },
    tenant: { id: 'tenant-hhs' },
  };
  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.person_id, 'person-1');
  assert.deepEqual(res.body.filter, { limit: 20 });
  assert.deepEqual(res.body.timeline, [
    {
      id: 'event-1',
      item_type: 'event',
      event_type: 'bill.uploaded',
      event_level: 'milestone',
      occurred_at: '2026-05-11T02:00:00.000Z',
      source_channel: 'website',
      source_link_id: 'bill-123',
      workspace_id: 'workspace-1',
      person_id: 'person-1',
      title: 'bill.uploaded',
      description: 'Bill uploaded',
      payload: { bill_status: 'uploaded' },
      tenant_id: 'tenant-hhs',
    },
  ]);
  assert.match(queries[0].sql, /from crm_contacts/i);
  assert.match(queries[0].sql, /tenant_id = \$1/i);
  assert.match(queries[1].sql, /from crm_timeline_events/i);
  assert.match(queries[1].sql, /crm_timeline_events\.tenant_id = \$1/i);
  assert.doesNotMatch(queries[1].sql, /from events/i);
  assert.deepEqual(queries[0].params, ['tenant-hhs', 'person-1']);
  assert.deepEqual(queries[1].params, ['tenant-hhs', 'contact-1', 20]);
});

test('GET /api/v1/crm/tasks returns tenant-safe queued internal task drafts', async () => {
  const app = createFakeApp();
  const queries = [];
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params });
      return {
        rows: [{
          id: 'task-1', tenant_id: 'tenant-hhs', title: 'Follow up with Jane', description: 'Review latest timeline first.',
          status: 'open', priority: 'normal', due_at: null, created_at: '2026-05-12T00:00:00.000Z', updated_at: null,
          metadata: { review_status: 'queued', approval_required: true, customer_facing: false, external_action_taken: false, draft_only: true },
          contact_id: 'contact-1', source_person_id: 'person-1', contact_full_name: 'Jane Solar', contact_primary_email: 'jane@example.com', contact_primary_phone: '555-0100',
          account_id: 'account-1', account_name: 'Jane Household',
        }],
      };
    },
  };
  registerCrmRoutes(app, pool);
  const res = createResponse();
  await app.routes.get('GET /api/v1/crm/tasks')({ query: { review_status: 'queued', person_id: 'person-1', limit: '10' }, tenant: { id: 'tenant-hhs' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.tasks[0].review.status, 'queued');
  assert.deepEqual(res.body.tasks[0].safety, { customer_facing: false, external_action_taken: false, draft_only: true });
  assert.match(queries[0].sql, /from crm_tasks/i);
  assert.match(queries[0].sql, /crm_tasks\.tenant_id = \$1/i);
  assert.match(queries[0].sql, /join crm_contacts/i);
  assert.deepEqual(queries[0].params, ['tenant-hhs', 'queued', 'person-1', 10]);
});

test('POST /api/v1/crm/people/:personId/tasks/draft creates internal approval-gated task', async () => {
  const app = createFakeApp();
  const queries = [];
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (/from crm_contacts/i.test(sql)) {
        return { rows: [{ id: 'contact-1', account_id: 'account-1', source_person_id: 'person-1', full_name: 'Jane Solar', primary_email: 'jane@example.com', primary_phone: '555-0100' }] };
      }
      return { rows: [{ id: 'task-1', tenant_id: 'tenant-hhs', title: params[3], description: params[4], status: 'open', priority: params[5], due_at: null, metadata: JSON.parse(params[7]), created_at: null, updated_at: null, contact_id: 'contact-1', source_person_id: 'person-1', contact_full_name: 'Jane Solar', contact_primary_email: 'jane@example.com', contact_primary_phone: '555-0100', account_id: 'account-1', account_name: null }] };
    },
  };
  registerCrmRoutes(app, pool);
  const res = createResponse();
  await app.routes.get('POST /api/v1/crm/people/:personId/tasks/draft')({ params: { personId: 'person-1' }, body: { title: 'Follow up', priority: 'high' }, tenant: { id: 'tenant-hhs' } }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.task.review.status, 'queued');
  assert.equal(res.body.task.review.approval_required, true);
  assert.deepEqual(res.body.task.safety, { customer_facing: false, external_action_taken: false, draft_only: true });
  assert.match(queries[1].sql, /insert into crm_tasks/i);
  assert.equal(JSON.parse(queries[1].params[7]).source, 'crm_person_timeline');
  assert.equal(JSON.parse(queries[1].params[7]).customer_facing, false);
});

test('POST draft task requires a title', async () => {
  const app = createFakeApp();
  registerCrmRoutes(app, { async query() { throw new Error('should not query'); } });
  const res = createResponse();
  await app.routes.get('POST /api/v1/crm/people/:personId/tasks/draft')({ params: { personId: 'person-1' }, body: {}, tenant: { id: 'tenant-hhs' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 'task_title_required');
});

test('PATCH /api/v1/crm/tasks/:taskId/review approves internal task without external action', async () => {
  const app = createFakeApp();
  const queries = [];
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params });
      return { rows: [{ id: 'task-1', tenant_id: 'tenant-hhs', title: 'Follow up', description: null, status: params[2], priority: 'normal', due_at: null, metadata: JSON.parse(params[3]), created_at: null, updated_at: null }] };
    },
  };
  registerCrmRoutes(app, pool);
  const res = createResponse();
  await app.routes.get('PATCH /api/v1/crm/tasks/:taskId/review')({ params: { taskId: 'task-1' }, body: { decision: 'approved', notes: 'Internal follow-up ok' }, tenant: { id: 'tenant-hhs' }, user: { email: 'brendon@example.com' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.task.review.status, 'approved');
  assert.equal(res.body.task.safety.customer_facing, false);
  assert.equal(res.body.task.safety.external_action_taken, false);
  assert.match(queries[0].sql, /update crm_tasks/i);
  assert.match(queries[0].sql, /where id = \$1\s+and tenant_id = \$2/i);
});

test('PATCH review rejects invalid decisions', async () => {
  const app = createFakeApp();
  registerCrmRoutes(app, { async query() { throw new Error('should not query'); } });
  const res = createResponse();
  await app.routes.get('PATCH /api/v1/crm/tasks/:taskId/review')({ params: { taskId: 'task-1' }, body: { decision: 'send_sms' }, tenant: { id: 'tenant-hhs' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 'invalid_review_decision');
});

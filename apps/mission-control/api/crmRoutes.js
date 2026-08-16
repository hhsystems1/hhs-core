import { clampLimit } from './tenantContext.js';
import { getIO } from './ws.js';

function normalizePerson(row, tenantId) {
  return {
    id: String(row.id),
    full_name: row.full_name || null,
    primary_email: row.primary_email || row.email || null,
    primary_phone: row.primary_phone || null,
    lifecycle_stage: row.lifecycle_stage || 'unknown',
    notes: row.notes || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    tenant_id: tenantId || row.tenant_id || null,
  };
}

function normalizeOrganization(row, tenantId) {
  return {
    id: String(row.id),
    name: row.name || null,
    account_type: row.account_type || 'organization',
    lifecycle_stage: row.lifecycle_stage || 'unknown',
    status: row.status || 'active',
    source_business_id: row.source_business_id || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    tenant_id: tenantId || row.tenant_id || null,
  };
}

function normalizeContact(row, tenantId) {
  return {
    id: String(row.id),
    full_name: row.full_name || null,
    primary_email: row.primary_email || null,
    primary_phone: row.primary_phone || null,
    lifecycle_stage: row.lifecycle_stage || 'unknown',
    status: row.status || 'active',
    source_person_id: row.source_person_id || null,
    account_id: row.account_id || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    tenant_id: tenantId || row.tenant_id || null,
  };
}

function normalizeOpportunity(row, tenantId) {
  return {
    id: String(row.id),
    name: row.name || null,
    pipeline: row.pipeline || 'general',
    stage: row.stage || 'new',
    status: row.status || 'open',
    estimated_value_cents: row.estimated_value_cents ?? null,
    expected_close_date: row.expected_close_date || null,
    account_id: row.account_id || null,
    account_name: row.account_name || null,
    contact_id: row.contact_id || null,
    contact_name: row.contact_name || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    tenant_id: tenantId || row.tenant_id || null,
  };
}

function normalizePersonProfile(row, tenantId) {
  return {
    ...normalizePerson(row, tenantId),
    crm_contact: row.contact_id
      ? {
          id: String(row.contact_id),
          account_id: row.account_id || null,
          status: row.contact_status || 'active',
          account_name: row.account_name || null,
        }
      : null,
  };
}

function normalizeTimelineEvent(row, tenantId) {
  return {
    id: String(row.id),
    item_type: 'event',
    event_type: row.event_type || null,
    event_level: row.event_level || null,
    occurred_at: row.occurred_at || null,
    source_channel: row.source_channel || null,
    source_link_id: row.source_link_id || null,
    workspace_id: row.workspace_id || null,
    person_id: row.person_id || row.source_person_id || null,
    title: row.title || row.event_type || 'event',
    description: row.description || null,
    payload: row.payload_json || {},
    tenant_id: tenantId || row.tenant_id || null,
  };
}

function normalizeTask(row, tenantId) {
  const metadata = row.metadata || {};
  return {
    id: String(row.id),
    title: row.title || null,
    description: row.description || null,
    status: row.status || 'open',
    priority: row.priority || 'normal',
    due_at: row.due_at || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    tenant_id: tenantId || row.tenant_id || null,
    contact: row.contact_id
      ? {
          id: String(row.contact_id),
          source_person_id: row.source_person_id || null,
          full_name: row.contact_full_name || null,
          primary_email: row.contact_primary_email || null,
          primary_phone: row.contact_primary_phone || null,
        }
      : null,
    account: row.account_id ? { id: String(row.account_id), name: row.account_name || null } : null,
    review: {
      status: metadata.review_status || 'queued',
      approval_required: metadata.approval_required !== false,
      approved_at: metadata.approved_at || null,
      approved_by: metadata.approved_by || null,
      decision_notes: metadata.decision_notes || null,
    },
    safety: {
      customer_facing: metadata.customer_facing === true,
      external_action_taken: metadata.external_action_taken === true,
      draft_only: metadata.draft_only !== false,
    },
  };
}

function safePriority(value) {
  return ['low', 'normal', 'high', 'urgent'].includes(value) ? value : 'normal';
}

function safeString(value, max = 4000) {
  return String(value || '').trim().slice(0, max);
}

async function getContactForPerson(pool, tenantId, personId) {
  const result = await pool.query(
    `select
       crm_contacts.id::text,
       crm_contacts.tenant_id::text,
       crm_contacts.account_id::text,
       crm_contacts.source_person_id::text,
       crm_contacts.full_name,
       crm_contacts.primary_email,
       crm_contacts.primary_phone,
       crm_contacts.lifecycle_stage,
       crm_contacts.status,
       crm_contacts.metadata,
       crm_accounts.name as account_name
     from crm_contacts
     left join crm_accounts
       on crm_accounts.id = crm_contacts.account_id
      and crm_accounts.tenant_id = crm_contacts.tenant_id
     where crm_contacts.tenant_id = $1
       and crm_contacts.source_person_id = $2
     limit 1`,
    [tenantId, personId]
  );
  return result.rows[0] || null;
}

async function insertTimelineEvent(pool, tenantId, contact, event) {
  const result = await pool.query(
    `insert into crm_timeline_events (
       tenant_id, contact_id, source_person_id, event_type, event_level,
       occurred_at, source_channel, source_link_id, title, description, payload_json
     ) values ($1, $2, $3, $4, $5, coalesce($6::timestamptz, now()), $7, $8, $9, $10, $11::jsonb)
     returning
       id::text, tenant_id::text, contact_id::text, source_person_id::text as person_id,
       event_type, event_level, occurred_at, source_channel, source_link_id,
       workspace_id::text, title, description, coalesce(payload_json, '{}'::jsonb) as payload_json`,
    [
      tenantId,
      contact.id,
      contact.source_person_id || null,
      event.event_type,
      event.event_level || 'crm',
      event.occurred_at || null,
      event.source_channel || null,
      event.source_link_id || null,
      event.title || event.event_type,
      event.description || null,
      JSON.stringify(event.payload || {}),
    ]
  );
  return result.rows[0];
}

async function insertCrmTask(pool, tenantId, contact, task) {
  const metadata = {
    source: task.source || 'crm_workflow',
    source_person_id: contact.source_person_id || null,
    review_status: task.review_status || 'queued',
    approval_required: task.approval_required !== false,
    customer_facing: task.customer_facing === true,
    external_action_taken: task.external_action_taken === true,
    draft_only: task.draft_only !== false,
    ...(task.metadata || {}),
  };

  const result = await pool.query(
    `insert into crm_tasks (tenant_id, account_id, contact_id, title, description, status, priority, due_at, metadata)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     returning
       id::text, tenant_id::text, title, description, status, priority, due_at, metadata, created_at, updated_at,
       $3::text as contact_id, $10::text as source_person_id, $11::text as contact_full_name,
       $12::text as contact_primary_email, $13::text as contact_primary_phone, $2::text as account_id, $14::text as account_name`,
    [
      tenantId,
      contact.account_id || null,
      contact.id,
      task.title,
      task.description || null,
      task.status || 'open',
      safePriority(task.priority),
      task.due_at || null,
      JSON.stringify(metadata),
      contact.source_person_id || null,
      contact.full_name || null,
      contact.primary_email || null,
      contact.primary_phone || null,
      contact.account_name || null,
    ]
  );
  return result.rows[0];
}

export function registerCrmRoutes(app, pool) {
  app.get('/api/v1/crm/people', async (req, res) => {
    try {
      const tenantId = req.tenant?.id || null;
      if (!tenantId) return res.status(503).json({ ok: false, error: 'tenant context required', code: 'tenant_context_required' });
      const q = req.query?.q ? String(req.query.q).trim() : '';
      const limit = clampLimit(req.query?.limit, { defaultValue: 50, min: 1, max: 200 });
      const params = [tenantId];
      let where = 'where crm_contacts.tenant_id = $1';
      if (q) {
        params.push(`%${q}%`);
        where += ` and (people.full_name ilike $${params.length} or people.primary_email ilike $${params.length} or people.primary_phone ilike $${params.length})`;
      }
      params.push(limit);
      const result = await pool.query(
        `select people.id::text, people.full_name, people.primary_email, people.primary_phone, people.notes, people.created_at
         from crm_contacts
         join people on people.id = crm_contacts.source_person_id
         ${where}
         order by people.created_at desc nulls last, people.full_name asc nulls last
         limit $${params.length}`,
        params
      );
      res.json({ ok: true, tenant: req.tenant || null, filter: { q: q || null, limit }, people: result.rows.map((row) => normalizePerson(row, tenantId)) });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'crm_people_list_failed' });
    }
  });

  app.get('/api/v1/crm/people/:personId', async (req, res) => {
    try {
      const personId = safeString(req.params.personId, 120);
      if (!personId) return res.status(400).json({ ok: false, error: 'personId required', code: 'person_id_required' });
      const tenantId = req.tenant?.id || null;
      const result = await pool.query(
        `select people.id::text, people.full_name, people.primary_email, people.primary_phone, people.notes, people.created_at,
                crm_contacts.id::text as contact_id, crm_contacts.account_id::text, crm_contacts.status as contact_status,
                crm_accounts.name as account_name
         from crm_contacts
         join people on people.id = crm_contacts.source_person_id
         left join crm_accounts on crm_accounts.id = crm_contacts.account_id and crm_accounts.tenant_id = crm_contacts.tenant_id
         where people.id = $1 and crm_contacts.tenant_id = $2
         limit 1`,
        [personId, tenantId]
      );
      if (!result.rows[0]) return res.status(404).json({ ok: false, error: 'person not found', code: 'crm_person_not_found' });
      res.json({ ok: true, tenant: req.tenant || null, person: normalizePersonProfile(result.rows[0], tenantId) });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'crm_person_detail_failed' });
    }
  });

  app.get('/api/v1/crm/organizations', async (req, res) => {
    try {
      const tenantId = req.tenant?.id || null;
      if (!tenantId) return res.status(503).json({ ok: false, error: 'tenant context required', code: 'tenant_context_required' });
      const q = req.query?.q ? String(req.query.q).trim() : '';
      const limit = clampLimit(req.query?.limit, { defaultValue: 50, min: 1, max: 200 });
      const params = [tenantId];
      let where = 'where tenant_id = $1';
      if (q) {
        params.push(`%${q}%`);
        where += ` and name ilike $${params.length}`;
      }
      params.push(limit);
      const result = await pool.query(
        `select id::text, tenant_id::text, source_business_id::text, name, account_type, lifecycle_stage, status, created_at, updated_at
         from crm_accounts
         ${where}
         order by coalesce(updated_at, created_at) desc nulls last, name asc nulls last
         limit $${params.length}`,
        params
      );
      res.json({ ok: true, tenant: req.tenant || null, filter: { q: q || null, limit }, organizations: result.rows.map((row) => normalizeOrganization(row, tenantId)) });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'crm_organizations_list_failed' });
    }
  });

  app.get('/api/v1/crm/contacts', async (req, res) => {
    try {
      const tenantId = req.tenant?.id || null;
      if (!tenantId) return res.status(503).json({ ok: false, error: 'tenant context required', code: 'tenant_context_required' });
      const q = req.query?.q ? String(req.query.q).trim() : '';
      const limit = clampLimit(req.query?.limit, { defaultValue: 50, min: 1, max: 200 });
      const params = [tenantId];
      let where = 'where tenant_id = $1';
      if (q) {
        params.push(`%${q}%`);
        where += ` and (full_name ilike $${params.length} or primary_email ilike $${params.length} or primary_phone ilike $${params.length})`;
      }
      params.push(limit);
      const result = await pool.query(
        `select id::text, tenant_id::text, source_person_id::text, account_id::text, full_name, primary_email, primary_phone, lifecycle_stage, status, created_at, updated_at
         from crm_contacts
         ${where}
         order by coalesce(updated_at, created_at) desc nulls last, full_name asc nulls last
         limit $${params.length}`,
        params
      );
      res.json({ ok: true, tenant: req.tenant || null, filter: { q: q || null, limit }, contacts: result.rows.map((row) => normalizeContact(row, tenantId)) });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'crm_contacts_list_failed' });
    }
  });

  app.get('/api/v1/crm/opportunities', async (req, res) => {
    try {
      const tenantId = req.tenant?.id || null;
      if (!tenantId) return res.status(503).json({ ok: false, error: 'tenant context required', code: 'tenant_context_required' });
      const status = req.query?.status === 'all' ? null : String(req.query?.status || 'open').trim();
      const q = req.query?.q ? String(req.query.q).trim() : '';
      const limit = clampLimit(req.query?.limit, { defaultValue: 50, min: 1, max: 200 });
      const params = [tenantId];
      let where = 'where crm_opportunities.tenant_id = $1';
      if (status) {
        params.push(status);
        where += ` and crm_opportunities.status = $${params.length}`;
      }
      if (q) {
        params.push(`%${q}%`);
        where += ` and crm_opportunities.name ilike $${params.length}`;
      }
      params.push(limit);
      const result = await pool.query(
        `select crm_opportunities.id::text, crm_opportunities.tenant_id::text, crm_opportunities.account_id::text,
                crm_accounts.name as account_name, crm_opportunities.contact_id::text, crm_contacts.full_name as contact_name,
                crm_opportunities.name, crm_opportunities.pipeline, crm_opportunities.stage, crm_opportunities.status,
                crm_opportunities.estimated_value_cents, crm_opportunities.expected_close_date,
                crm_opportunities.created_at, crm_opportunities.updated_at
         from crm_opportunities
         left join crm_accounts on crm_accounts.id = crm_opportunities.account_id and crm_accounts.tenant_id = crm_opportunities.tenant_id
         left join crm_contacts on crm_contacts.id = crm_opportunities.contact_id and crm_contacts.tenant_id = crm_opportunities.tenant_id
         ${where}
         order by coalesce(crm_opportunities.updated_at, crm_opportunities.created_at) desc nulls last, crm_opportunities.name asc
         limit $${params.length}`,
        params
      );
      res.json({ ok: true, tenant: req.tenant || null, filter: { status, q: q || null, limit }, opportunities: result.rows.map((row) => normalizeOpportunity(row, tenantId)) });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'crm_opportunities_list_failed' });
    }
  });

  // --- Create endpoints ---

  app.post('/api/v1/crm/contacts', async (req, res) => {
    try {
      const tenantId = req.tenant?.id || null;
      if (!tenantId) return res.status(503).json({ ok: false, error: 'tenant context required', code: 'tenant_context_required' });

      const { full_name, primary_email, primary_phone, account_id, lifecycle_stage, status, role_title, notes } = req.body || {};
      if (!full_name) return res.status(400).json({ ok: false, error: 'full_name is required', code: 'full_name_required' });

      const result = await pool.query(
        `insert into crm_contacts (tenant_id, full_name, primary_email, primary_phone, account_id, lifecycle_stage, status, role_title, notes)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         returning id::text, tenant_id::text, source_person_id::text, account_id::text, full_name, primary_email, primary_phone, lifecycle_stage, status, created_at, updated_at`,
        [
          tenantId,
          safeString(full_name, 500),
          safeString(primary_email || null, 320),
          safeString(primary_phone || null, 80),
          account_id || null,
          ['lead', 'subscriber', 'opportunity', 'customer', 'evangelist', 'unknown'].includes(lifecycle_stage) ? lifecycle_stage : 'unknown',
          ['active', 'inactive', 'archived', 'do_not_contact'].includes(status) ? status : 'active',
          safeString(role_title || null, 200),
          safeString(notes || null, 10000),
        ]
      );

      res.status(201).json({ ok: true, contact: normalizeContact(result.rows[0], tenantId) });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'crm_contact_create_failed' });
    }
  });

  app.patch('/api/v1/crm/contacts/:id', async (req, res) => {
    try {
      const tenantId = req.tenant?.id || null;
      if (!tenantId) return res.status(503).json({ ok: false, error: 'tenant context required', code: 'tenant_context_required' });
      const { id } = req.params;
      const { full_name, primary_email, primary_phone, account_id, lifecycle_stage, status, role_title, notes } = req.body || {};
      const sets = []; const params = []; let idx = 1;
      if (full_name !== undefined) { sets.push(`full_name = $${idx++}`); params.push(safeString(full_name, 500)); }
      if (primary_email !== undefined) { sets.push(`primary_email = $${idx++}`); params.push(safeString(primary_email, 320)); }
      if (primary_phone !== undefined) { sets.push(`primary_phone = $${idx++}`); params.push(safeString(primary_phone, 80)); }
      if (account_id !== undefined) params.push(account_id); sets.push(`account_id = $${idx++}`);
      if (lifecycle_stage !== undefined) { sets.push(`lifecycle_stage = $${idx++}`); params.push(['lead', 'subscriber', 'opportunity', 'customer', 'evangelist', 'unknown'].includes(lifecycle_stage) ? lifecycle_stage : 'unknown'); }
      if (status !== undefined) { sets.push(`status = $${idx++}`); params.push(['active', 'inactive', 'archived', 'do_not_contact'].includes(status) ? status : 'active'); }
      if (role_title !== undefined) { sets.push(`role_title = $${idx++}`); params.push(safeString(role_title, 200)); }
      if (notes !== undefined) { sets.push(`notes = $${idx++}`); params.push(safeString(notes, 10000)); }
      if (!sets.length) return res.status(400).json({ ok: false, error: 'no fields to update', code: 'no_fields' });
      params.push(tenantId, id);
      const result = await pool.query(
        `update crm_contacts set ${sets.join(', ')}, updated_at = now() where tenant_id = $${idx++} and id = $${idx} returning id::text, tenant_id::text, source_person_id::text, account_id::text, full_name, primary_email, primary_phone, lifecycle_stage, status, created_at, updated_at`,
        params
      );
      if (!result.rows.length) return res.status(404).json({ ok: false, error: 'contact not found', code: 'not_found' });
      res.json({ ok: true, contact: normalizeContact(result.rows[0], tenantId) });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'crm_contact_update_failed' });
    }
  });

  app.post('/api/v1/crm/accounts', async (req, res) => {
    try {
      const tenantId = req.tenant?.id || null;
      if (!tenantId) return res.status(503).json({ ok: false, error: 'tenant context required', code: 'tenant_context_required' });

      const { name, account_type, lifecycle_stage, status, website_url, primary_email, primary_phone, notes } = req.body || {};
      if (!name) return res.status(400).json({ ok: false, error: 'name is required', code: 'name_required' });

      const result = await pool.query(
        `insert into crm_accounts (tenant_id, name, account_type, lifecycle_stage, status, website_url, primary_email, primary_phone, notes)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         returning id::text, tenant_id::text, source_business_id::text, name, account_type, lifecycle_stage, status, created_at, updated_at`,
        [
          tenantId,
          safeString(name, 500),
          ['organization', 'customer', 'partner', 'vendor', 'referral_source', 'software_customer', 'internal'].includes(account_type) ? account_type : 'organization',
          safeString(lifecycle_stage || 'unknown', 80),
          ['active', 'inactive', 'archived'].includes(status) ? status : 'active',
          safeString(website_url || null, 500),
          safeString(primary_email || null, 320),
          safeString(primary_phone || null, 80),
          safeString(notes || null, 10000),
        ]
      );

      res.status(201).json({ ok: true, account: normalizeOrganization(result.rows[0], tenantId) });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'crm_account_create_failed' });
    }
  });

  app.patch('/api/v1/crm/accounts/:id', async (req, res) => {
    try {
      const tenantId = req.tenant?.id || null;
      if (!tenantId) return res.status(503).json({ ok: false, error: 'tenant context required', code: 'tenant_context_required' });
      const { id } = req.params;
      const { name, account_type, lifecycle_stage, status, website_url, primary_email, primary_phone, notes } = req.body || {};
      const sets = []; const params = []; let idx = 1;
      if (name !== undefined) { sets.push(`name = $${idx++}`); params.push(safeString(name, 500)); }
      if (account_type !== undefined) { sets.push(`account_type = $${idx++}`); params.push(['organization', 'customer', 'partner', 'vendor', 'referral_source', 'software_customer', 'internal'].includes(account_type) ? account_type : 'organization'); }
      if (lifecycle_stage !== undefined) { sets.push(`lifecycle_stage = $${idx++}`); params.push(safeString(lifecycle_stage, 80)); }
      if (status !== undefined) { sets.push(`status = $${idx++}`); params.push(['active', 'inactive', 'archived'].includes(status) ? status : 'active'); }
      if (website_url !== undefined) { sets.push(`website_url = $${idx++}`); params.push(safeString(website_url, 500)); }
      if (primary_email !== undefined) { sets.push(`primary_email = $${idx++}`); params.push(safeString(primary_email, 320)); }
      if (primary_phone !== undefined) { sets.push(`primary_phone = $${idx++}`); params.push(safeString(primary_phone, 80)); }
      if (notes !== undefined) { sets.push(`notes = $${idx++}`); params.push(safeString(notes, 10000)); }
      if (!sets.length) return res.status(400).json({ ok: false, error: 'no fields to update', code: 'no_fields' });
      params.push(tenantId, id);
      const result = await pool.query(
        `update crm_accounts set ${sets.join(', ')}, updated_at = now() where tenant_id = $${idx++} and id = $${idx} returning id::text, tenant_id::text, source_business_id::text, name, account_type, lifecycle_stage, status, created_at, updated_at`,
        params
      );
      if (!result.rows.length) return res.status(404).json({ ok: false, error: 'account not found', code: 'not_found' });
      res.json({ ok: true, account: normalizeOrganization(result.rows[0], tenantId) });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'crm_account_update_failed' });
    }
  });

  app.post('/api/v1/crm/opportunities', async (req, res) => {
    try {
      const tenantId = req.tenant?.id || null;
      if (!tenantId) return res.status(503).json({ ok: false, error: 'tenant context required', code: 'tenant_context_required' });

      const { name, pipeline, stage, status, estimated_value_cents, expected_close_date, account_id, contact_id } = req.body || {};
      if (!name) return res.status(400).json({ ok: false, error: 'name is required', code: 'name_required' });

      const result = await pool.query(
        `insert into crm_opportunities (tenant_id, name, pipeline, stage, status, estimated_value_cents, expected_close_date, account_id, contact_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         returning id::text, tenant_id::text, account_id::text, contact_id::text, name, pipeline, stage, status, estimated_value_cents, expected_close_date, created_at, updated_at`,
        [
          tenantId,
          safeString(name, 500),
          safeString(pipeline || 'general', 80),
          safeString(stage || 'new', 80),
          ['open', 'won', 'lost', 'paused', 'archived'].includes(status) ? status : 'open',
          estimated_value_cents != null ? Math.max(0, Math.floor(Number(estimated_value_cents))) : null,
          expected_close_date || null,
          account_id || null,
          contact_id || null,
        ]
      );

      res.status(201).json({ ok: true, opportunity: normalizeOpportunity(result.rows[0], tenantId) });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'crm_opportunity_create_failed' });
    }
  });

  app.patch('/api/v1/crm/opportunities/:id', async (req, res) => {
    try {
      const tenantId = req.tenant?.id || null;
      if (!tenantId) return res.status(503).json({ ok: false, error: 'tenant context required', code: 'tenant_context_required' });
      const { id } = req.params;
      const { name, pipeline, stage, status, estimated_value_cents, expected_close_date, account_id, contact_id } = req.body || {};
      const sets = []; const params = []; let idx = 1;
      if (name !== undefined) { sets.push(`name = $${idx++}`); params.push(safeString(name, 500)); }
      if (pipeline !== undefined) { sets.push(`pipeline = $${idx++}`); params.push(safeString(pipeline, 80)); }
      if (stage !== undefined) { sets.push(`stage = $${idx++}`); params.push(safeString(stage, 80)); }
      if (status !== undefined) { sets.push(`status = $${idx++}`); params.push(['open', 'won', 'lost', 'paused', 'archived'].includes(status) ? status : 'open'); }
      if (estimated_value_cents !== undefined) { sets.push(`estimated_value_cents = $${idx++}`); params.push(Math.max(0, Math.floor(Number(estimated_value_cents)))); }
      if (expected_close_date !== undefined) { sets.push(`expected_close_date = $${idx++}`); params.push(expected_close_date); }
      if (account_id !== undefined) { sets.push(`account_id = $${idx++}`); params.push(account_id); }
      if (contact_id !== undefined) { sets.push(`contact_id = $${idx++}`); params.push(contact_id); }
      if (!sets.length) return res.status(400).json({ ok: false, error: 'no fields to update', code: 'no_fields' });
      params.push(tenantId, id);
      const result = await pool.query(
        `update crm_opportunities set ${sets.join(', ')}, updated_at = now() where tenant_id = $${idx++} and id = $${idx} returning id::text, tenant_id::text, account_id::text, contact_id::text, name, pipeline, stage, status, estimated_value_cents, expected_close_date, created_at, updated_at`,
        params
      );
      if (!result.rows.length) return res.status(404).json({ ok: false, error: 'opportunity not found', code: 'not_found' });
      res.json({ ok: true, opportunity: normalizeOpportunity(result.rows[0], tenantId) });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'crm_opportunity_update_failed' });
    }
  });

  app.post('/api/v1/crm/tasks', async (req, res) => {
    try {
      const tenantId = req.tenant?.id || null;
      if (!tenantId) return res.status(503).json({ ok: false, error: 'tenant context required', code: 'tenant_context_required' });

      const { title, description, status, priority, due_at, account_id, contact_id, opportunity_id, metadata } = req.body || {};
      if (!title) return res.status(400).json({ ok: false, error: 'title is required', code: 'title_required' });

      const result = await pool.query(
        `insert into crm_tasks (tenant_id, account_id, contact_id, opportunity_id, title, description, status, priority, due_at, metadata)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
         returning id::text, tenant_id::text, title, description, status, priority, due_at, metadata, created_at, updated_at`,
        [
          tenantId,
          account_id || null,
          contact_id || null,
          opportunity_id || null,
          safeString(title, 500),
          safeString(description || null, 10000),
          ['open', 'in_progress', 'completed', 'cancelled', 'archived'].includes(status) ? status : 'open',
          safePriority(priority),
          due_at || null,
          JSON.stringify(metadata || {}),
        ]
      );

      res.status(201).json({ ok: true, task: normalizeTask(result.rows[0], tenantId) });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'crm_task_create_failed' });
    }
  });

  app.get('/api/v1/crm/tasks', async (req, res) => {
    try {
      const tenantId = req.tenant?.id || null;
      if (!tenantId) return res.status(503).json({ ok: false, error: 'tenant context required', code: 'tenant_context_required' });
      const reviewStatus = req.query?.review_status === 'all' ? null : String(req.query?.review_status || 'queued').trim();
      const status = req.query?.status ? String(req.query.status).trim() : '';
      const personId = req.query?.person_id ? String(req.query.person_id).trim() : '';
      const limit = clampLimit(req.query?.limit, { defaultValue: 50, min: 1, max: 200 });
      const params = [tenantId];
      let where = 'where crm_tasks.tenant_id = $1';
      if (reviewStatus) {
        params.push(reviewStatus);
        where += ` and coalesce(crm_tasks.metadata->>'review_status', 'queued') = $${params.length}`;
      }
      if (status) {
        params.push(status);
        where += ` and crm_tasks.status = $${params.length}`;
      }
      if (personId) {
        params.push(personId);
        where += ` and crm_contacts.source_person_id = $${params.length}`;
      }
      params.push(limit);
      const result = await pool.query(
        `select crm_tasks.id::text, crm_tasks.tenant_id::text, crm_tasks.title, crm_tasks.description, crm_tasks.status,
                crm_tasks.priority, crm_tasks.due_at, crm_tasks.metadata, crm_tasks.created_at, crm_tasks.updated_at,
                crm_contacts.id::text as contact_id, crm_contacts.source_person_id::text,
                crm_contacts.full_name as contact_full_name, crm_contacts.primary_email as contact_primary_email,
                crm_contacts.primary_phone as contact_primary_phone, crm_accounts.id::text as account_id, crm_accounts.name as account_name
         from crm_tasks
         left join crm_contacts on crm_contacts.id = crm_tasks.contact_id and crm_contacts.tenant_id = crm_tasks.tenant_id
         left join crm_accounts on crm_accounts.id = crm_tasks.account_id and crm_accounts.tenant_id = crm_tasks.tenant_id
         ${where}
         order by crm_tasks.created_at desc nulls last
         limit $${params.length}`,
        params
      );
      res.json({ ok: true, tenant: req.tenant || null, filter: { review_status: reviewStatus, status: status || null, person_id: personId || null, limit }, tasks: result.rows.map((row) => normalizeTask(row, tenantId)) });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'crm_tasks_list_failed' });
    }
  });

  app.post('/api/v1/crm/people/:personId/tasks/draft', async (req, res) => {
    try {
      const tenantId = req.tenant?.id || null;
      if (!tenantId) return res.status(503).json({ ok: false, error: 'tenant context required', code: 'tenant_context_required' });
      const personId = safeString(req.params.personId, 120);
      const title = safeString(req.body?.title, 300);
      if (!title) return res.status(400).json({ ok: false, error: 'task title required', code: 'task_title_required' });
      const contact = await getContactForPerson(pool, tenantId, personId);
      if (!contact) return res.status(404).json({ ok: false, error: 'person not found', code: 'crm_person_not_found' });
      const task = await insertCrmTask(pool, tenantId, contact, {
        title,
        description: req.body?.description ? String(req.body.description) : null,
        priority: req.body?.priority,
        due_at: req.body?.due_at || null,
        source: 'crm_person_timeline',
      });
      res.status(201).json({ ok: true, task: normalizeTask(task, tenantId) });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'crm_task_draft_create_failed' });
    }
  });

  app.post('/api/v1/crm/people/:personId/messages/sms', async (req, res) => {
    try {
      const tenantId = req.tenant?.id || null;
      if (!tenantId) return res.status(503).json({ ok: false, error: 'tenant context required', code: 'tenant_context_required' });
      const personId = safeString(req.params.personId, 120);
      const body = safeString(req.body?.body, 1600);
      if (!body) return res.status(400).json({ ok: false, error: 'sms body required', code: 'sms_body_required' });
      const contact = await getContactForPerson(pool, tenantId, personId);
      if (!contact) return res.status(404).json({ ok: false, error: 'person not found', code: 'crm_person_not_found' });
      const task = await insertCrmTask(pool, tenantId, contact, {
        title: `Text ${contact.full_name || 'CRM contact'}`,
        description: `Draft/send this SMS after review.\nTo: ${contact.primary_phone || 'missing'}\n\nMessage:\n${body}`,
        priority: 'normal',
        source: 'crm_sms_reply',
        customer_facing: true,
        external_action_taken: false,
      });
      res.status(201).json({ ok: true, mode: 'approval_task', task: normalizeTask(task, tenantId) });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'crm_sms_draft_failed' });
    }
  });

  app.post('/api/v1/crm/people/:personId/messages/email', async (req, res) => {
    try {
      const tenantId = req.tenant?.id || null;
      if (!tenantId) return res.status(503).json({ ok: false, error: 'tenant context required', code: 'tenant_context_required' });
      const personId = safeString(req.params.personId, 120);
      const subject = safeString(req.body?.subject, 998) || '(no subject)';
      const body = safeString(req.body?.body, 10000);
      if (!body) return res.status(400).json({ ok: false, error: 'email body required', code: 'email_body_required' });
      const contact = await getContactForPerson(pool, tenantId, personId);
      if (!contact) return res.status(404).json({ ok: false, error: 'person not found', code: 'crm_person_not_found' });
      const to = safeString(req.body?.to || contact.primary_email, 320);
      if (!to) return res.status(400).json({ ok: false, error: 'contact email required', code: 'contact_email_required' });

      const event = await insertTimelineEvent(pool, tenantId, contact, {
        event_type: 'message.email.queued',
        event_level: 'customer_communication',
        source_channel: 'email',
        source_link_id: null,
        title: `Email queued: ${subject}`,
        description: `${subject}\n\n${body}`,
        payload: { to, subject, status: 'queued_for_review' },
      });

      const io = getIO();
      if (io) io.emit('message:sent', { channel: 'email', contact_id: contact.id, person_id: personId, contact_name: contact.full_name, event_type: 'message.email.queued' });

      res.status(201).json({ ok: true, mode: 'approval_task', message: { to, subject, status: 'queued_for_review' }, event: normalizeTimelineEvent(event, tenantId) });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'crm_email_send_failed' });
    }
  });

  app.post('/api/v1/crm/people/:personId/social-touchpoints', async (req, res) => {
    try {
      const tenantId = req.tenant?.id || null;
      if (!tenantId) return res.status(503).json({ ok: false, error: 'tenant context required', code: 'tenant_context_required' });
      const personId = safeString(req.params.personId, 120);
      const platform = safeString(req.body?.platform || 'social', 80).toLowerCase();
      const url = safeString(req.body?.url, 500) || null;
      const notes = safeString(req.body?.notes || 'Social touchpoint logged from CRM.', 4000);
      const contact = await getContactForPerson(pool, tenantId, personId);
      if (!contact) return res.status(404).json({ ok: false, error: 'person not found', code: 'crm_person_not_found' });
      const event = await insertTimelineEvent(pool, tenantId, contact, {
        event_type: 'social.touchpoint.logged',
        event_level: 'customer_communication',
        source_channel: platform,
        source_link_id: url,
        title: `${platform} touchpoint`,
        description: notes,
        payload: { platform, url, notes },
      });
      const io = getIO();
      if (io) io.emit('message:sent', { channel: platform, contact_id: contact.id, person_id: personId, contact_name: contact.full_name, event_type: 'social.touchpoint.logged' });
      res.status(201).json({ ok: true, event: normalizeTimelineEvent(event, tenantId) });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'crm_social_touchpoint_failed' });
    }
  });

  app.post('/api/v1/crm/people/:personId/appointments', async (req, res) => {
    try {
      const tenantId = req.tenant?.id || null;
      if (!tenantId) return res.status(503).json({ ok: false, error: 'tenant context required', code: 'tenant_context_required' });
      const personId = safeString(req.params.personId, 120);
      const title = safeString(req.body?.title || 'Customer appointment', 300);
      const notes = safeString(req.body?.notes || '', 4000);
      const scheduledAt = req.body?.scheduled_at ? String(req.body.scheduled_at) : null;
      const contact = await getContactForPerson(pool, tenantId, personId);
      if (!contact) return res.status(404).json({ ok: false, error: 'person not found', code: 'crm_person_not_found' });
      const task = await insertCrmTask(pool, tenantId, contact, {
        title,
        description: notes || `Appointment for ${contact.full_name || 'CRM contact'}`,
        priority: 'high',
        due_at: scheduledAt,
        source: 'crm_appointment',
        review_status: 'approved',
        approval_required: false,
        customer_facing: false,
        external_action_taken: false,
        draft_only: true,
        metadata: { appointment_status: 'scheduled', scheduled_at: scheduledAt },
      });
      const event = await insertTimelineEvent(pool, tenantId, contact, {
        event_type: 'appointment.scheduled',
        event_level: 'crm',
        occurred_at: scheduledAt,
        source_channel: 'mission_control_calendar',
        title,
        description: notes,
        payload: { scheduled_at: scheduledAt, task_id: task.id, calendar_provider: 'google_calendar_handoff' },
      });
      await pool.query(
        `update crm_contacts
         set metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
             updated_at = now()
         where tenant_id = $1 and id = $2`,
        [tenantId, contact.id, JSON.stringify({ appointment_status: 'scheduled', next_appointment_at: scheduledAt })]
      );
      const io = getIO();
      if (io) io.emit('message:sent', { channel: 'mission_control_calendar', contact_id: contact.id, person_id: personId, contact_name: contact.full_name, event_type: 'appointment.scheduled' });
      res.status(201).json({ ok: true, task: normalizeTask(task, tenantId), event: normalizeTimelineEvent(event, tenantId) });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'crm_appointment_create_failed' });
    }
  });

  app.patch('/api/v1/crm/tasks/:taskId/review', async (req, res) => {
    try {
      const tenantId = req.tenant?.id || null;
      if (!tenantId) return res.status(503).json({ ok: false, error: 'tenant context required', code: 'tenant_context_required' });
      const taskId = safeString(req.params.taskId, 120);
      const decision = safeString(req.body?.decision, 80);
      if (!['approved', 'rejected', 'changes_requested'].includes(decision)) return res.status(400).json({ ok: false, error: 'invalid review decision', code: 'invalid_review_decision' });
      const status = decision === 'rejected' ? 'cancelled' : 'open';
      const notes = req.body?.notes ? String(req.body.notes) : null;
      const reviewedBy = req.user?.id || req.user?.email || req.session?.email || 'mission-control';
      const metadataPatch = {
        review_status: decision,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy,
        decision_notes: notes,
        customer_facing: false,
        external_action_taken: false,
        draft_only: true,
      };
      const result = await pool.query(
        `update crm_tasks
         set status = $3, metadata = coalesce(metadata, '{}'::jsonb) || $4::jsonb, updated_at = now()
         where id = $1 and tenant_id = $2
         returning id::text, tenant_id::text, title, description, status, priority, due_at, metadata, created_at, updated_at`,
        [taskId, tenantId, status, JSON.stringify(metadataPatch)]
      );
      if (!result.rows[0]) return res.status(404).json({ ok: false, error: 'task not found', code: 'crm_task_not_found' });
      res.json({ ok: true, task: normalizeTask(result.rows[0], tenantId) });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'crm_task_review_failed' });
    }
  });

  app.get('/api/v1/crm/people/:personId/timeline', async (req, res) => {
    try {
      const personId = safeString(req.params.personId, 120);
      if (!personId) return res.status(400).json({ ok: false, error: 'personId required', code: 'person_id_required' });
      const tenantId = req.tenant?.id || null;
      if (!tenantId) return res.status(503).json({ ok: false, error: 'tenant context required', code: 'tenant_context_required' });
      const limit = clampLimit(req.query?.limit, { defaultValue: 50, min: 1, max: 200 });
      const contact = await getContactForPerson(pool, tenantId, personId);
      if (!contact) return res.status(404).json({ ok: false, error: 'person not found', code: 'crm_person_not_found' });
      const result = await pool.query(
        `select id::text, tenant_id::text, contact_id::text, source_person_id::text as person_id,
                event_type, event_level, occurred_at, source_channel, source_link_id,
                workspace_id::text, title, description, coalesce(payload_json, '{}'::jsonb) as payload_json
         from crm_timeline_events
         where tenant_id = $1 and contact_id = $2
         order by occurred_at desc nulls last
         limit $3`,
        [tenantId, contact.id, limit]
      );
      res.json({ ok: true, tenant: req.tenant || null, person_id: personId, filter: { limit }, timeline: result.rows.map((row) => normalizeTimelineEvent(row, tenantId)) });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'crm_person_timeline_failed' });
    }
  });

  // --- Kanban Pipeline ---

  const PIPELINE_STAGES = ['lead', 'qualified', 'proposal', 'closed_won', 'closed_lost'];

  app.get('/api/v1/crm/kanban', async (req, res) => {
    try {
      const tenantId = req.tenant?.id || null;
      if (!tenantId) return res.status(503).json({ ok: false, error: 'tenant context required', code: 'tenant_context_required' });

      const result = await pool.query(
        `select o.id::text, o.tenant_id::text, o.account_id::text,
                o.contact_id::text, o.name, o.pipeline, o.stage, o.status,
                o.estimated_value_cents, o.expected_close_date,
                o.created_at, o.updated_at,
                a.name as account_name,
                c.full_name as contact_name, c.primary_email as contact_email, c.primary_phone as contact_phone
         from crm_opportunities o
         left join crm_accounts a on a.id = o.account_id and a.tenant_id = o.tenant_id
         left join crm_contacts c on c.id = o.contact_id and c.tenant_id = o.tenant_id
         where o.tenant_id = $1
         order by o.updated_at desc nulls last`,
        [tenantId]
      );

      const columns = {};
      for (const stage of PIPELINE_STAGES) {
        columns[stage] = [];
      }

      for (const row of result.rows) {
        const stage = row.stage || 'lead';
        if (!columns[stage]) columns[stage] = [];
        columns[stage].push({
          id: row.id,
          name: row.name,
          pipeline: row.pipeline,
          stage: row.stage,
          status: row.status,
          estimated_value_cents: row.estimated_value_cents,
          expected_close_date: row.expected_close_date,
          account_name: row.account_name,
          contact_name: row.contact_name,
          contact_email: row.contact_email,
          contact_phone: row.contact_phone,
          updated_at: row.updated_at,
        });
      }

      res.json({ ok: true, tenant: req.tenant || null, columns, stages: PIPELINE_STAGES });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'kanban_list_failed' });
    }
  });

  app.patch('/api/v1/crm/opportunities/:id/stage', async (req, res) => {
    try {
      const tenantId = req.tenant?.id || null;
      if (!tenantId) return res.status(503).json({ ok: false, error: 'tenant context required', code: 'tenant_context_required' });

      const id = String(req.params.id);
      const { stage } = req.body;

      if (!stage || !PIPELINE_STAGES.includes(stage)) {
        return res.status(400).json({ ok: false, error: `stage must be one of: ${PIPELINE_STAGES.join(', ')}`, code: 'invalid_stage' });
      }

      const result = await pool.query(
        `update crm_opportunities
         set stage = $1, updated_at = now()
         where id = $2 and tenant_id = $3
         returning id::text, stage, status, name, updated_at`,
        [stage, id, tenantId]
      );

      if (!result.rows[0]) {
        return res.status(404).json({ ok: false, error: 'opportunity not found', code: 'opportunity_not_found' });
      }

      const io = getIO();
      if (io) {
        io.to(`tenant:${tenantId}`).emit('opportunity:stage_changed', {
          id,
          stage,
          updated_at: result.rows[0].updated_at,
        });
      }

      res.json({ ok: true, opportunity: result.rows[0] });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'stage_update_failed' });
    }
  });

  // --- Inbox (SMS history timeline) ---

  app.get('/api/v1/crm/inbox', async (req, res) => {
    try {
      const tenantId = req.tenant?.id || null;
      if (!tenantId) return res.status(503).json({ ok: false, error: 'tenant context required', code: 'tenant_context_required' });
      const limit = clampLimit(req.query?.limit, { defaultValue: 50, min: 1, max: 200 });

      const result = await pool.query(
        `select e.id::text, e.tenant_id::text, e.contact_id::text,
                e.source_person_id::text as person_id, e.event_type, e.event_level,
                e.occurred_at, e.source_channel, e.source_link_id,
                e.title, e.description, e.payload_json,
                c.full_name as contact_name
         from crm_timeline_events e
         left join crm_contacts c on c.id = e.contact_id and c.tenant_id = e.tenant_id
         where e.tenant_id = $1 and e.source_channel = 'twilio_sms'
         order by e.occurred_at desc nulls last
         limit $2`,
        [tenantId, limit]
      );

      res.json({ ok: true, tenant: req.tenant || null, filter: { limit }, messages: result.rows });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'inbox_list_failed' });
    }
  });
}

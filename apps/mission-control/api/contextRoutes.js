import { clampLimit } from './tenantContext.js';
import { getIO } from './ws.js';

function safeString(value, max = 4000) {
  return String(value || '').trim().slice(0, max);
}

function normalizeContextEntry(row) {
  return {
    id: row.id,
    agent_id: row.agent_id,
    session_id: row.session_id,
    context_type: row.context_type,
    summary: row.summary || null,
    content: row.content,
    metadata: row.metadata || {},
    created_at: row.created_at,
    expires_at: row.expires_at || null,
  };
}

export function registerContextRoutes(app, pool) {
  // Save a context entry
  app.post('/api/context', async (req, res) => {
    try {
      const tenantId = req.tenant?.id || null;
      if (!tenantId) return res.status(503).json({ ok: false, error: 'tenant context required', code: 'tenant_context_required' });

      const { agent_id, session_id, context_type, summary, content, metadata } = req.body || {};
      if (!agent_id || !session_id || !content) {
        return res.status(400).json({ ok: false, error: 'agent_id, session_id, and content are required', code: 'missing_fields' });
      }

      const result = await pool.query(
        `insert into agent_context_log (tenant_id, agent_id, session_id, context_type, summary, content, metadata, expires_at)
         values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
         returning id, agent_id, session_id, context_type, summary, content, metadata, created_at, expires_at`,
        [
          tenantId,
          safeString(agent_id, 120),
          safeString(session_id, 255),
          ['state', 'conversation', 'decision', 'observation', 'handoff'].includes(context_type) ? context_type : 'state',
          summary ? safeString(summary, 500) : null,
          content,
          JSON.stringify(metadata || {}),
          metadata?.expires_at || null,
        ]
      );

      const io = getIO();
      if (io) {
        io.to(`tenant:${tenantId}`).emit('context:created', {
          id: result.rows[0].id,
          agent_id,
          session_id,
          context_type,
        });
      }

      res.status(201).json({ ok: true, entry: normalizeContextEntry(result.rows[0]) });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'context_create_failed' });
    }
  });

  // List distinct agents (must be before :sessionId route)
  app.get('/api/context/agents', async (req, res) => {
    try {
      const tenantId = req.tenant?.id || null;
      if (!tenantId) return res.status(503).json({ ok: false, error: 'tenant context required', code: 'tenant_context_required' });

      const result = await pool.query(
        `select agent_id, count(*)::int as entry_count, max(created_at) as last_seen
         from agent_context_log
         where tenant_id = $1
         group by agent_id
         order by last_seen desc`,
        [tenantId]
      );

      res.json({ ok: true, agents: result.rows });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'context_agents_list_failed' });
    }
  });

  // Search context across all sessions
  app.get('/api/context', async (req, res) => {
    try {
      const tenantId = req.tenant?.id || null;
      if (!tenantId) return res.status(503).json({ ok: false, error: 'tenant context required', code: 'tenant_context_required' });

      const q = req.query?.q ? String(req.query.q).trim() : '';
      const agentId = req.query?.agent_id ? String(req.query.agent_id).trim() : '';
      const contextType = req.query?.context_type ? String(req.query.context_type).trim() : '';
      const limit = clampLimit(req.query?.limit, { defaultValue: 50, min: 1, max: 200 });

      const params = [tenantId];
      const conditions = ['tenant_id = $1'];

      if (q) {
        params.push(`%${q}%`);
        conditions.push(`(content ilike $${params.length} or coalesce(summary, '') ilike $${params.length})`);
      }
      if (agentId) {
        params.push(agentId);
        conditions.push(`agent_id = $${params.length}`);
      }
      if (contextType) {
        params.push(contextType);
        conditions.push(`context_type = $${params.length}`);
      }

      params.push(limit);
      const result = await pool.query(
        `select id, agent_id, session_id, context_type, summary, content, metadata, created_at, expires_at
         from agent_context_log
         where ${conditions.join(' and ')}
         order by created_at desc
         limit $${params.length}`,
        params
      );

      res.json({
        ok: true,
        filter: { q: q || null, agent_id: agentId || null, context_type: contextType || null, limit },
        entries: result.rows.map(normalizeContextEntry),
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'context_search_failed' });
    }
  });

  // Get all context for a session
  app.get('/api/context/:sessionId', async (req, res) => {
    try {
      const tenantId = req.tenant?.id || null;
      if (!tenantId) return res.status(503).json({ ok: false, error: 'tenant context required', code: 'tenant_context_required' });

      const sessionId = safeString(req.params.sessionId, 255);
      if (!sessionId) return res.status(400).json({ ok: false, error: 'sessionId required', code: 'session_id_required' });

      const limit = clampLimit(req.query?.limit, { defaultValue: 100, min: 1, max: 500 });

      const result = await pool.query(
        `select id, agent_id, session_id, context_type, summary, content, metadata, created_at, expires_at
         from agent_context_log
         where tenant_id = $1 and session_id = $2
         order by created_at asc
         limit $3`,
        [tenantId, sessionId, limit]
      );

      res.json({ ok: true, session_id: sessionId, entries: result.rows.map(normalizeContextEntry) });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'context_session_get_failed' });
    }
  });

  // Delete a context entry
  app.delete('/api/context/:id', async (req, res) => {
    try {
      const tenantId = req.tenant?.id || null;
      if (!tenantId) return res.status(503).json({ ok: false, error: 'tenant context required', code: 'tenant_context_required' });

      const id = String(req.params.id);
      const result = await pool.query(
        'delete from agent_context_log where id = $1 and tenant_id = $2 returning id',
        [id, tenantId]
      );

      if (!result.rows[0]) return res.status(404).json({ ok: false, error: 'entry not found', code: 'context_entry_not_found' });
      res.json({ ok: true, deleted: id });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'context_delete_failed' });
    }
  });
}

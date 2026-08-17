import express from 'express';

/**
 * registerWorkflowRoutes(app, pool)
 *
 * Exposes:
 *   GET    /api/v1/workflows             – list workflow definitions
 *   POST   /api/v1/workflows             – create a workflow
 *   GET    /api/v1/workflows/:id         – get a single workflow
 *   PATCH  /api/v1/workflows/:id         – update name / nodes / edges
 *   DELETE /api/v1/workflows/:id         – soft-delete (set is_active=false)
 *   POST   /api/v1/workflows/:id/run     – execute workflow as a job
 */
export function registerWorkflowRoutes(app, pool) {

  // ── List ───────────────────────────────────────────────────────
  app.get('/api/v1/workflows', async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, name, description, is_active, created_at, updated_at
         FROM workflow_definitions
         WHERE tenant_id = $1 AND is_active = true
         ORDER BY updated_at DESC`,
        [req.tenant.id]
      );
      return res.json({ ok: true, workflows: rows });
    } catch (err) {
      console.error('GET /api/v1/workflows error:', err);
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  });

  // ── Create ─────────────────────────────────────────────────────
  app.post('/api/v1/workflows', async (req, res) => {
    try {
      const { name, description, nodes_json, edges_json } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ ok: false, error: 'name is required' });
      }
      const { rows } = await pool.query(
        `INSERT INTO workflow_definitions (tenant_id, name, description, nodes_json, edges_json)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, description, nodes_json, edges_json, is_active, created_at, updated_at`,
        [req.tenant.id, name.trim(), description || '', JSON.stringify(nodes_json || []), JSON.stringify(edges_json || [])]
      );
      return res.status(201).json({ ok: true, workflow: rows[0] });
    } catch (err) {
      console.error('POST /api/v1/workflows error:', err);
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  });

  // ── Get single ─────────────────────────────────────────────────
  app.get('/api/v1/workflows/:id', async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM workflow_definitions
         WHERE id = $1 AND tenant_id = $2`,
        [req.params.id, req.tenant.id]
      );
      if (!rows.length) {
        return res.status(404).json({ ok: false, error: 'Not found' });
      }
      return res.json({ ok: true, workflow: rows[0] });
    } catch (err) {
      console.error('GET /api/v1/workflows/:id error:', err);
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  });

  // ── Update ─────────────────────────────────────────────────────
  app.patch('/api/v1/workflows/:id', async (req, res) => {
    try {
      const { name, description, nodes_json, edges_json } = req.body;
      const sets = [];
      const vals = [];
      let i = 1;

      if (name !== undefined) { sets.push(`name = $${i++}`); vals.push(name); }
      if (description !== undefined) { sets.push(`description = $${i++}`); vals.push(description); }
      if (nodes_json !== undefined) { sets.push(`nodes_json = $${i++}`); vals.push(JSON.stringify(nodes_json)); }
      if (edges_json !== undefined) { sets.push(`edges_json = $${i++}`); vals.push(JSON.stringify(edges_json)); }

      if (!sets.length) {
        return res.status(400).json({ ok: false, error: 'No fields to update' });
      }

      sets.push(`updated_at = NOW()`);
      vals.push(req.params.id, req.tenant.id);

      const { rows } = await pool.query(
        `UPDATE workflow_definitions
         SET ${sets.join(', ')}
         WHERE id = $${i++} AND tenant_id = $${i}
         RETURNING *`,
        vals
      );
      if (!rows.length) {
        return res.status(404).json({ ok: false, error: 'Not found' });
      }
      return res.json({ ok: true, workflow: rows[0] });
    } catch (err) {
      console.error('PATCH /api/v1/workflows/:id error:', err);
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  });

  // ── Soft-delete ────────────────────────────────────────────────
  app.delete('/api/v1/workflows/:id', async (req, res) => {
    try {
      const { rowCount } = await pool.query(
        `UPDATE workflow_definitions
         SET is_active = false, updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2`,
        [req.params.id, req.tenant.id]
      );
      if (!rowCount) {
        return res.status(404).json({ ok: false, error: 'Not found' });
      }
      return res.json({ ok: true });
    } catch (err) {
      console.error('DELETE /api/v1/workflows/:id error:', err);
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  });

  // ── Run workflow ───────────────────────────────────────────────
  // Creates a single root job. The worker reads payload.graph and
  // executes nodes in topological order, writing tool_run_log steps.
  app.post('/api/v1/workflows/:id/run', async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM workflow_definitions
         WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
        [req.params.id, req.tenant.id]
      );
      if (!rows.length) {
        return res.status(404).json({ ok: false, error: 'Workflow not found' });
      }
      const wf = rows[0];
      const nodes = wf.nodes_json || [];
      const edges = wf.edges_json || [];

      if (!nodes.length) {
        return res.status(400).json({ ok: false, error: 'Workflow has no nodes' });
      }

      // Build topological order + adjacency for dependency tracking
      const adjacency = new Map();
      const inDegree = new Map();
      for (const n of nodes) {
        adjacency.set(n.id, []);
        inDegree.set(n.id, 0);
      }
      for (const e of edges) {
        const src = typeof e.source === 'string' ? e.source : e.source?.id;
        const tgt = typeof e.target === 'string' ? e.target : e.target?.id;
        if (src && tgt && adjacency.has(src) && adjacency.has(tgt)) {
          adjacency.get(src).push(tgt);
          inDegree.set(tgt, (inDegree.get(tgt) || 0) + 1);
        }
      }

      // Kahn's algorithm for topological sort
      const queue = [];
      for (const [id, deg] of inDegree) {
        if (deg === 0) queue.push(id);
      }
      const sorted = [];
      while (queue.length) {
        const cur = queue.shift();
        sorted.push(cur);
        for (const next of (adjacency.get(cur) || [])) {
          const d = inDegree.get(next) - 1;
          inDegree.set(next, d);
          if (d === 0) queue.push(next);
        }
      }

      // If cycle detected, fall back to node order
      const topoOrder = sorted.length === nodes.length ? sorted : nodes.map((n) => n.id);

      // Build node lookup for quick access
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));

      // Build dependency map: node_id -> [upstream node_ids]
      const depsMap = new Map();
      for (const n of nodes) depsMap.set(n.id, []);
      for (const e of edges) {
        const src = typeof e.source === 'string' ? e.source : e.source?.id;
        const tgt = typeof e.target === 'string' ? e.target : e.target?.id;
        if (src && tgt && depsMap.has(tgt)) {
          depsMap.get(tgt).push(src);
        }
      }

      const graph = {
        workflow_id: wf.id,
        workflow_name: wf.name,
        topo_order: topoOrder,
        nodes: topoOrder.map((id) => {
          const n = nodeMap.get(id);
          return {
            id,
            type: n?.type || 'agent',
            data: n?.data || {},
            depends_on: depsMap.get(id) || [],
          };
        }),
      };

      // Create the root job
      const actor = (req.body.actor || 'coding').toString();
      const { rows: jobRows } = await pool.query(
        `INSERT INTO agent_jobs (tenant_id, agent_id, capability, status, approval_required, input, created_at, updated_at)
         VALUES ($1, $2, $3, 'queued', false, $4, NOW(), NOW())
         RETURNING id, status`,
        [
          req.tenant.id,
          actor,
          `workflow:${wf.name}`,
          JSON.stringify({ workflow_id: wf.id, graph }),
        ]
      );

      return res.status(201).json({
        ok: true,
        jobId: jobRows[0].id,
        status: jobRows[0].status,
        workflow_name: wf.name,
        node_count: topoOrder.length,
      });
    } catch (err) {
      console.error('POST /api/v1/workflows/:id/run error:', err);
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  });
}

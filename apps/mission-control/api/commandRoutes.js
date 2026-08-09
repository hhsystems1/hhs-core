import express from 'express';
import { z } from 'zod'; // will be bundled via node_modules
import { Pool } from 'pg';

/**
 * registerCommandRoutes(app, pool)
 *
 * - app   : Express instance (the same instance used by mission-control)
 * - pool  : pg Pool instance (already configured in index.js)
 *
 * Exposes:
 *   POST   /api/v1/commands          – create a new command (may require approval)
 *   POST   /api/v1/commands/:id/approve – approve a pending command
 *   POST   /api/v1/commands/:id/reject  – reject a pending command
 */
export function registerCommandRoutes(app, pool) {
  // -----------------------------------------------------------------
  // 1️⃣ Validation schema (Zod)
  // -----------------------------------------------------------------
  const commandSchema = z.object({
    tenantId: z.string().uuid(),
    command: z.string().min(1),
    actor: z.string().min(1),
    approvalRequired: z.boolean().default(false),
    payload: z.any()
  });

  // -----------------------------------------------------------------
  // 2️⃣ POST /api/v1/commands – create a new command
  // -----------------------------------------------------------------
  app.post('/api/v1/commands', async (req, res) => {
    try {
      // 2.1 Validate payload
      const validation = commandSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid command payload',
          details: validation.error.errors.map(e => e.message).join('; ')
        });
      }
      const cmd = validation.data;

      // 2.2 Ensure tenant context exists and matches requested tenantId
      if (!req.tenant?.id) {
        return res.status(401).json({ ok: false, error: 'tenant context required' });
      }
      if (cmd.tenantId !== req.tenant.id) {
        return res.status(400).json({ error: 'tenantId mismatch' });
      }

      // 2.3 Insert into agent_jobs table
      const jobInsert = `
        INSERT INTO agent_jobs (tenant_id, agent_id, capability, status,
                                approval_required, input, created_at, updated_at)
        VALUES ($1, $2, $3, 'queued', $4, $5, NOW(), NOW())
        RETURNING id, status;
      `;
      const jobVals = [
        req.tenant.id,          // tenant_id
        cmd.actor,              // agent_id
        cmd.command,            // capability
        cmd.approvalRequired,   // approval_required
        JSON.stringify(cmd.payload) // input (as JSON string)
      ];
      const { rows } = await pool.query(jobInsert, jobVals);
      const job = rows[0]; // contains id, status, ...

      // 2.4 If approval is required, also insert a row into approvals and return that id
      if (cmd.approvalRequired) {
        const approvalInsert = `
          INSERT INTO approvals (command_id, tenant_id, approved, created_at)
          VALUES ($1, $2, false, NOW())
          RETURNING id;
        `;
        const approvalRes = await pool.query(approvalInsert, [job.id, req.tenant.id]);
        const approvalId = approvalRes.rows[0].id;
        return res.status(202).json({ ok: true, commandId: approvalId, jobId: job.id });
      }

      // 2.5 If no approval required, just return the job id
      return res.status(201).json({ ok: true, jobId: job.id });
    } catch (err) {
      console.error('⚡ /api/v1/commands error:', err);
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  });

  // -----------------------------------------------------------------
  // 3️⃣ POST /api/v1/commands/:id/approve – approve a pending command
  // -----------------------------------------------------------------
  app.post('/api/v1/commands/:id/approve', async (req, res) => {
    try {
      const { id } = req.params;
      const { approved } = req.body;
      if (typeof approved !== 'boolean') {
        return res.status(400).json({ ok: false, error: 'approved must be true/false' });
      }
      // Verify that an approval entry exists for this command id
      const approvalCheck = await pool.query('SELECT * FROM approvals WHERE command_id = $1', [id]);
      if (approvalCheck.rows.length === 0) {
        return res.status(404).json({ ok: false, error: 'Approval pending not found' });
      }

      if (approved) {
        // Transition job to "running" and clean up the approval record
        const updateJob = `
          UPDATE agent_jobs
          SET status = 'running'
          WHERE id = (SELECT command_id FROM approvals WHERE command_id = $1);
        `;
        await pool.query(updateJob, [id]);
        // Remove the approval row
        await pool.query('DELETE FROM approvals WHERE command_id = $1', [id]);
        return res.status(200).json({ ok: true, jobId: id });
      } else {
        // Explicit rejection – just delete the approval record
        await pool.query('DELETE FROM approvals WHERE command_id = $1', [id]);
        return res.status(200).json({ ok: true, message: 'Rejected' });
      }
    } catch (err) {
      console.error('⚡ /api/v1/commands/:id/approve error:', err);
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  });

  // -----------------------------------------------------------------
  // 4️⃣ POST /api/v1/commands/:id/reject – reject a pending command
  // -----------------------------------------------------------------
  app.post('/api/v1/commands/:id/reject', async (req, res) => {
    try {
      const { id } = req.params;
      // Simply delete the approval entry – the job stays in 'queued' state
      await pool.query('DELETE FROM approvals WHERE command_id = $1', [id]);
      return res.status(200).json({ ok: true, message: 'Rejected' });
    } catch (err) {
      console.error('⚡ /api/v1/commands/:id/reject error:', err);
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  });
}
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { z } from 'zod';

const commandSchema = z.object({
  tenantId: z.string().uuid(),
  command: z.string().min(1),
  actor: z.string().min(1),
  approvalRequired: z.boolean().default(false),
  payload: z.any(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validation = commandSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        ok: false,
        error: 'Invalid command payload',
        details: validation.error.errors.map(e => e.message).join('; '),
      }, { status: 400 });
    }

    const cmd = validation.data;
    const tenantId = cmd.tenantId; // In a real app, this would come from the auth session

    // Insert into agent_jobs
    const jobInsert = `
      INSERT INTO agent_jobs (tenant_id, agent_id, capability, status, 
                              approval_required, input, created_at, updated_at)
      VALUES ($1, $2, $3, 'queued', $4, $5, NOW(), NOW())
      RETURNING id, status;
    `;
    
    const { rows } = await pool.query(jobInsert, [
      tenantId,
      cmd.actor,
      cmd.command,
      cmd.approvalRequired,
      JSON.stringify(cmd.payload)
    ]);
    
    const job = rows[0];

    if (cmd.approvalRequired) {
      const approvalInsert = `
        INSERT INTO approvals (command_id, tenant_id, approved, created_at)
        VALUES ($1, $2, false, NOW())
        RETURNING id;
      `;
      const approvalRes = await pool.query(approvalInsert, [job.id, tenantId]);
      return NextResponse.json({ 
        ok: true, 
        commandId: approvalRes.rows[0].id, 
        jobId: job.id 
      }, { status: 202 });
    }

    return NextResponse.json({ ok: true, jobId: job.id }, { status: 201 });
  } catch (err: any) {
    console.error('⚡ /api/v1/commands error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  try {
    // In Next.js, we extract the tenant from the session/token
    // For now, we'll use a default or query param for testing
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId') || '00000000-0000-0000-0000-000000000000';

    const q = `
      select 
        id, tenant_id, agent_id, capability, status, 
        approval_required, input, result, created_at, updated_at 
      from agent_jobs 
      where tenant_id = $1 
      order by created_at desc
    `;
    const { rows } = await pool.query(q, [tenantId]);
    return NextResponse.json({ ok: true, jobs: rows });
  } catch (e: any) {
    console.error('⚡ /api/v1/jobs error:', e);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

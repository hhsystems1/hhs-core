import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { eventBus } from '@hhs/event-bus';

const execFileAsync = promisify(execFile);

const POLL_INTERVAL_MS = 3000;
const EXECUTION_TIMEOUT_MS = 300000;
const MAX_RESULT_BYTES = 8000;

function publishJobStatus(event, jobId) {
  const payload = { jobId, timestamp: new Date().toISOString() };
  eventBus.publish(`job.${event}`, payload);
  eventBus.publish('flow.updated', { root_run_id: jobId, timestamp: payload.timestamp });
}

async function insertStep(pool, { rootRunId, sequenceIndex, toolId, taskSummary, taskType, status, inputRef, initiatedBy, error }) {
  const startedAt = new Date();
  const completedAt = status === 'running' ? null : startedAt;
  const r = await pool.query(
    `insert into tool_run_log
       (tool_id, task_summary, task_type, input_reference, output_reference, status,
        root_run_id, sequence_index, initiated_by, error, started_at, completed_at)
     values ($1, $2, $3, $4, '{}'::jsonb, $5, $6, $7, $8, $9, $10, $11)
     returning id`,
    [toolId, taskSummary, taskType, inputRef, status, rootRunId, sequenceIndex, initiatedBy, error || null, startedAt, completedAt]
  );
  return r.rows[0].id;
}

async function updateStep(pool, runId, { status, error, outputRef }) {
  await pool.query(
    `update tool_run_log
        set status = $2,
            error = $3,
            output_reference = $4,
            completed_at = case when $2 = 'running' then null else now() end
      where id = $1`,
    [runId, status, error || null, outputRef || null]
  );
}

async function claimQueuedJobs(pool) {
  return pool.query(
    `update agent_jobs
        set status = 'running', updated_at = now()
      where id in (
        select j.id
          from agent_jobs j
          left join approvals a on a.command_id = j.id
         where j.status = 'queued'
           and a.id is null
         order by j.created_at asc
         limit 3
      )
      returning id, agent_id, capability, input, created_at`
  );
}

function truncateText(value, max) {
  const s = String(value || '');
  return s.length > max ? `${s.slice(0, max)}\n…(truncated)` : s;
}

async function runSubagent(job) {
  const task = truncateText(job.capability, 4000);
  try {
    const { stdout, stderr } = await execFileAsync(
      'openclaw',
      ['agent', '--session-id', String(job.id), '-m', task, '--timeout', '300'],
      { timeout: EXECUTION_TIMEOUT_MS, maxBuffer: 1024 * 1024 }
    );
    return stdout || stderr || '';
  } catch (e) {
    if (e && e.code === 'ENOENT') {
      throw new Error('openclaw runtime is not available on this host — subagent execution skipped');
    }
    const stderrText = e && typeof e.stderr === 'string' ? e.stderr.trim() : '';
    throw new Error(stderrText || (e && e.message) || String(e));
  }
}

async function processJob(pool, job, broadcast) {
  const rootRunId = job.id;
  const agentId = job.agent_id || 'agent';
  const task = job.capability || 'Execute command';
  const inputRef = job.input || '{}';

  try {
    await insertStep(pool, {
      rootRunId,
      sequenceIndex: 0,
      toolId: 'orchestrator.route',
      taskSummary: 'Route command to agent',
      taskType: 'route',
      status: 'success',
      inputRef,
      initiatedBy: 'system',
    });

    const execRunId = await insertStep(pool, {
      rootRunId,
      sequenceIndex: 1,
      toolId: `agent:${agentId}`,
      taskSummary: task,
      taskType: 'agent_execute',
      status: 'running',
      inputRef,
      initiatedBy: agentId,
    });
    publishJobStatus('running', rootRunId);
    if (broadcast) broadcast('flow:updated', { root_run_id: rootRunId });

    let output = '';
    try {
      output = await runSubagent(job);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await updateStep(pool, execRunId, { status: 'failed', error: message });
      await pool.query(
        `update agent_jobs set status = 'failed', result = $2, updated_at = now() where id = $1`,
        [rootRunId, JSON.stringify({ error: message })]
      );
      publishJobStatus('failed', rootRunId);
      if (broadcast) broadcast('flow:updated', { root_run_id: rootRunId });
      return;
    }

    await updateStep(pool, execRunId, { status: 'success', outputRef: { output: truncateText(output, 2000) } });
    await pool.query(
      `update agent_jobs set status = 'completed', result = $2, updated_at = now() where id = $1`,
      [rootRunId, JSON.stringify({ output: truncateText(output, MAX_RESULT_BYTES) })]
    );
    publishJobStatus('completed', rootRunId);
    if (broadcast) broadcast('flow:updated', { root_run_id: rootRunId });
  } catch (e) {
    console.error(`⚡ worker processJob error (job ${rootRunId}):`, e);
    try {
      await pool.query(`update agent_jobs set status = 'failed', updated_at = now() where id = $1`, [rootRunId]);
    } catch (_) {
      // ignore secondary failure
    }
    publishJobStatus('failed', rootRunId);
    if (broadcast) broadcast('flow:updated', { root_run_id: rootRunId });
  }
}

export function startJobWorker({ pool, broadcast }) {
  let stopped = false;
  let running = false;

  const tick = async () => {
    if (stopped || running) return;
    running = true;
    try {
      const claim = await claimQueuedJobs(pool);
      for (const job of claim.rows) {
        await processJob(pool, job, broadcast);
      }
    } catch (e) {
      console.error('⚡ worker tick error:', e);
    } finally {
      running = false;
    }
  };

  tick();
  const interval = setInterval(tick, POLL_INTERVAL_MS);
  console.log('⚡ job worker started');

  return () => {
    stopped = true;
    clearInterval(interval);
  };
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, ArrowRight, Layers3, MessageSquare, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { ShellCard } from '../components/ShellCard';
import { fetchJson, formatWhen } from '../lib/api';

type SystemStatus = {
  ok?: boolean;
  totals?: {
    artifacts?: number;
    knowledge_documents_v2?: number;
    knowledge_chunks_v2?: number;
    events_v2?: number;
    review_queue?: number;
  };
  counts_by?: {
    event_level?: Array<{ event_level: string; n: number }>;
    review_status?: Array<{ status: string; n: number }>;
  };
  last_event_at?: string | null;
  ingestion_activity_24h?: { has_activity?: boolean; count?: number };
};

type OpenClawStatus = {
  ok?: boolean;
  text?: string;
  error?: string;
};

type AgentConfig = {
  name: string;
  model: string;
  fallbacks?: string[];
  description?: string;
};

type RunRecord = {
  run_id?: number | string;
  tool_id?: string;
  status?: string;
  started_at?: string;
  completed_at?: string;
  task_summary?: string;
  failure_reason?: string | null;
  root_run_id?: number | string;
};

type FlowRecord = {
  run_id?: number | string;
  tool_id?: string;
  status?: string;
  started_at?: string;
  completed_at?: string;
  task_summary?: string;
  task_type?: string;
  decision_status?: string;
  parent_run_id?: number | string | null;
  sequence_index?: number | null;
  failure_reason?: string | null;
  error?: string | null;
};

export default function MissionControlPage() {
  const navigate = useNavigate();
  const [task, setTask] = useState('');
  const [projectName, setProjectName] = useState('Mission Control');
  const [template, setTemplate] = useState('mission-control-shell');
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [openClawStatus, setOpenClawStatus] = useState<OpenClawStatus | null>(null);
  const [agents, setAgents] = useState<Record<string, AgentConfig>>({});
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunRecord | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<FlowRecord[]>([]);
  const [loadingFlow, setLoadingFlow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const quickTasks = useMemo(() => ([
    {
      title: 'Summarize activity',
      description: 'Pull the latest agent activity and tell me what is blocked.',
      task: 'Summarize the latest agent activity, identify blockers, and recommend the next action.',
      project: 'Mission Control',
      template: 'agent-summary',
    },
    {
      title: 'Review CRM queue',
      description: 'Inspect review-gated CRM work only.',
      task: 'Review the CRM task queue for approval-gated work and list the next safe actions.',
      project: 'Mission Control',
      template: 'crm-review',
    },
    {
      title: 'Inspect solar leads',
      description: 'Turn lead inbox items into follow-up decisions.',
      task: 'Inspect the solar lead inbox and identify missing bills, stalled contacts, and the best next action for each lead.',
      project: 'Solar',
      template: 'solar-leads',
    },
    {
      title: 'Inspect agents',
      description: 'Look at active sessions and tell me who to message next.',
      task: 'Review the active subagent sessions, point out failures, and tell me which agent to talk to next.',
      project: 'Mission Control',
      template: 'agent-console',
    },
  ]), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchJson<SystemStatus>('/api/system-status'),
      fetchJson<OpenClawStatus>('/api/openclaw/status').catch((e) => ({ ok: false, error: e instanceof Error ? e.message : String(e) })),
      fetchJson<{ ok: boolean; agents: Record<string, AgentConfig> }>('/api/subagents').catch((e) => ({ ok: false, agents: {}, error: e instanceof Error ? e.message : String(e) } as any)),
      fetchJson<{ ok: boolean; runs?: RunRecord[] }>('/api/runs?limit=8').catch((e) => ({ ok: false, runs: [], error: e instanceof Error ? e.message : String(e) } as any)),
    ])
      .then(([status, openClaw, agentResult, runResult]) => {
        if (cancelled) return;
        setSystemStatus(status);
        setOpenClawStatus(openClaw);
        setAgents(agentResult.agents || {});
        setRuns(Array.isArray(runResult.runs) ? runResult.runs : []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const launchTask = () => {
    const trimmed = task.trim();
    if (!trimmed) return;
    localStorage.setItem('mission-control:task', trimmed);
    localStorage.setItem('mission-control:project', projectName.trim() || 'Mission Control');
    localStorage.setItem('mission-control:template', template.trim() || 'mission-control-shell');
    setStatusMessage('Brief stored. Opening Agent Console…');
    navigate('/agents');
  };

  const refreshRuns = async () => {
    try {
      const result = await fetchJson<{ ok: boolean; runs?: RunRecord[] }>('/api/runs?limit=8');
      setRuns(Array.isArray(result.runs) ? result.runs : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const openRun = async (run: RunRecord) => {
    setSelectedRun(run);
    setSelectedFlow([]);
    setLoadingFlow(true);
    setError(null);
    try {
      const rootRunId = run.root_run_id ?? run.run_id;
      const result = await fetchJson<{ ok: boolean; flow?: FlowRecord[] }>(`/api/flows?root_run_id=${encodeURIComponent(String(rootRunId))}`);
      setSelectedFlow(Array.isArray(result.flow) ? result.flow : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingFlow(false);
    }
  };

  const applyQuickTask = (preset: { task: string; project: string; template: string }) => {
    setTask(preset.task);
    setProjectName(preset.project);
    setTemplate(preset.template);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const reviewQueued = systemStatus?.counts_by?.review_status?.find?.((row) => row.status === 'queued')?.n ?? 0;
  const activeAgents = Object.keys(agents).length;
  const eventLevels = systemStatus?.counts_by?.event_level || [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_30%),linear-gradient(180deg,rgba(8,12,20,0.98),rgba(6,10,18,0.96))] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-100">
              <Bot className="h-3.5 w-3.5" />
              Mission Control
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Brief an agent, launch the work, and read the result here.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60 sm:text-base">
              This is the operator surface. It should be the place you use to talk to deployed agents, not the place you visit after Telegram has already wasted your time.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[34rem]">
            <Metric label="Queued reviews" value={loading ? '…' : reviewQueued} detail="Approval-gated work" />
            <Metric label="Agents" value={loading ? '…' : activeAgents} detail="Configured subagents" />
            <Metric label="Events" value={loading ? '…' : (systemStatus?.totals?.events_v2 ?? '—')} detail="System activity" />
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Tile icon={<ShieldCheck className="h-4 w-4 text-emerald-300" />} label="Review gate" value={String(reviewQueued)} helper="CRM and public-facing work still routes through review." />
          <Tile icon={<Layers3 className="h-4 w-4 text-sky-300" />} label="System state" value={systemStatus?.ingestion_activity_24h?.has_activity ? 'Active' : 'Quiet'} helper={`Last event: ${formatWhen(systemStatus?.last_event_at)}`} />
          <Tile icon={<Sparkles className="h-4 w-4 text-violet-300" />} label="OpenClaw" value={openClawStatus?.ok === false ? 'Check' : 'Loaded'} helper={openClawStatus?.error || 'Runtime config available'} />
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">{error}</div>}
      {statusMessage && <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-200">{statusMessage}</div>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <ShellCard title="Quick brief" subtitle="One-click starter tasks for the current workflow.">
          <div className="grid gap-3 md:grid-cols-2">
            {quickTasks.map((item) => (
              <button
                key={item.title}
                onClick={() => applyQuickTask(item)}
                className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-left transition hover:border-sky-500/50 hover:bg-slate-950"
              >
                <div className="text-sm font-semibold text-white">{item.title}</div>
                <div className="mt-1 text-xs leading-5 text-slate-400">{item.description}</div>
              </button>
            ))}
          </div>
        </ShellCard>

        <ShellCard title="Operator links" subtitle="Jump directly to the control surfaces that already work.">
          <div className="grid gap-3 sm:grid-cols-2">
            <button onClick={() => navigate('/agents')} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10">
              <div className="text-sm font-semibold">Agent Console</div>
              <div className="mt-1 text-xs text-white/55">Talk to a subagent and inspect old sessions.</div>
            </button>
            <button onClick={() => navigate('/openclaw')} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10">
              <div className="text-sm font-semibold">OpenClaw Control</div>
              <div className="mt-1 text-xs text-white/55">Check runtime config and subagent routing.</div>
            </button>
            <button onClick={() => navigate('/crm')} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10">
              <div className="text-sm font-semibold">CRM</div>
              <div className="mt-1 text-xs text-white/55">Work review-gated customer tasks safely.</div>
            </button>
            <button onClick={() => navigate('/solar/leads')} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10">
              <div className="text-sm font-semibold">Solar Leads</div>
              <div className="mt-1 text-xs text-white/55">Open the lead inbox and work the pipeline.</div>
            </button>
          </div>
        </ShellCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.75fr]">
        <ShellCard title="Brief an agent" subtitle="Store the prompt here, then jump into the Agent Console with it ready.">
          <div className="grid gap-4">
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Project</span>
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-500"
                placeholder="Mission Control"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Template</span>
              <input
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-500"
                placeholder="mission-control-shell"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Objective</span>
              <textarea
                value={task}
                onChange={(e) => setTask(e.target.value)}
                rows={6}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-500"
                placeholder="e.g. Review the latest agent sessions, tell me what failed, and propose the next fix."
              />
            </label>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <MessageSquare className="h-4 w-4 text-slate-500" />
                The prompt is stored locally, then opened in Agent Console. No more manual copy/paste.
              </div>
              <button
                onClick={launchTask}
                disabled={!task.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Launch agent
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </ShellCard>

        <ShellCard title="Live status" subtitle="Current counters, event-level breakdowns, and recent run health.">
          <div className="space-y-3">
            <Row label="Artifacts" value={systemStatus?.totals?.artifacts ?? '—'} />
            <Row label="Knowledge docs" value={systemStatus?.totals?.knowledge_documents_v2 ?? '—'} />
            <Row label="Knowledge chunks" value={systemStatus?.totals?.knowledge_chunks_v2 ?? '—'} />
            <Row label="Events" value={systemStatus?.totals?.events_v2 ?? '—'} />
            <Row label="Reviews" value={systemStatus?.totals?.review_queue ?? '—'} />
            <div className="pt-2">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Event levels</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(eventLevels.length > 0 ? eventLevels : []).map((row) => (
                  <span key={row.event_level} className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300">
                    {row.event_level}: {row.n}
                  </span>
                ))}
                {eventLevels.length === 0 && <span className="text-sm text-slate-500">No event breakdown yet.</span>}
              </div>
            </div>

            <div className="pt-3 border-t border-white/5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Recent runs</div>
                <button onClick={refreshRuns} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10 transition">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {runs.length > 0 ? runs.slice(0, 5).map((run) => (
                  <button
                    key={String(run.run_id ?? `${run.tool_id}-${run.started_at}`)}
                    onClick={() => openRun(run)}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-left transition hover:border-sky-500/40 hover:bg-slate-950"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{run.tool_id || 'run'}</div>
                        <div className="mt-1 text-xs text-slate-400 line-clamp-2">{run.task_summary || run.failure_reason || 'No summary available.'}</div>
                      </div>
                      <div className="shrink-0 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                        {run.status || '—'}
                      </div>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500">
                      {formatWhen(run.started_at)}{run.completed_at ? ` • done ${formatWhen(run.completed_at)}` : ''}
                    </div>
                  </button>
                )) : (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-500">
                    No recent runs loaded yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </ShellCard>
      </div>

      {selectedRun && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setSelectedRun(null)} />
      )}
      {selectedRun && (
        <div className="fixed right-0 top-0 z-50 h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-zinc-950 shadow-2xl">
          <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-zinc-950/95 px-5 py-4 backdrop-blur">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Run detail</div>
              <div className="text-sm font-semibold text-white">{selectedRun.tool_id || 'run'}</div>
            </div>
            <button
              onClick={() => setSelectedRun(null)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10"
            >
              Close
            </button>
          </div>

          <div className="space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <MiniStat label="Status" value={selectedRun.status || '—'} />
              <MiniStat label="Run ID" value={String(selectedRun.run_id ?? '—')} />
              <MiniStat label="Started" value={formatWhen(selectedRun.started_at)} />
              <MiniStat label="Completed" value={formatWhen(selectedRun.completed_at)} />
            </div>

            <ShellCard
              title="Flow"
              subtitle="Related runs grouped by root_run_id"
              right={
                <button onClick={() => selectedRun && openRun(selectedRun)} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </button>
              }
            >
              {loadingFlow ? (
                <div className="text-sm text-white/50">Loading flow...</div>
              ) : selectedFlow.length === 0 ? (
                <div className="text-sm text-white/50">No flow rows returned yet.</div>
              ) : (
                <div className="space-y-3">
                  {selectedFlow.map((step, index) => (
                    <div key={String(step.run_id ?? index)} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">{step.tool_id || 'step'}</div>
                          <div className="mt-1 text-xs text-white/45">
                            #{step.sequence_index ?? index + 1} • {step.task_type || 'task'} • {step.decision_status || step.status || '—'}
                          </div>
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/60">
                          {step.status || '—'}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-white/65">{step.task_summary || step.error || step.failure_reason || 'No summary.'}</div>
                      <div className="mt-2 text-[11px] text-white/45">
                        {formatWhen(step.started_at)}{step.completed_at ? ` • done ${formatWhen(step.completed_at)}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ShellCard>

            <ShellCard title="Jump points" subtitle="Open the full operator surfaces for this work.">
              <div className="grid gap-2 sm:grid-cols-2">
                <button onClick={() => navigate('/system/runs')} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10">
                  <div className="text-sm font-semibold text-white">All runs</div>
                  <div className="mt-1 text-xs text-white/55">Open the full run log.</div>
                </button>
                <button onClick={() => navigate('/system/flows')} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10">
                  <div className="text-sm font-semibold text-white">Flow view</div>
                  <div className="mt-1 text-xs text-white/55">Open the grouped flow inspector.</div>
                </button>
                <button onClick={() => navigate('/agents')} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10">
                  <div className="text-sm font-semibold text-white">Agent Console</div>
                  <div className="mt-1 text-xs text-white/55">Brief or steer an agent.</div>
                </button>
                <button onClick={() => navigate('/openclaw')} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10">
                  <div className="text-sm font-semibold text-white">OpenClaw Control</div>
                  <div className="mt-1 text-xs text-white/55">Check runtime config and routing.</div>
                </button>
              </div>
            </ShellCard>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric(props: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{props.label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{props.value}</div>
      <div className="mt-1 text-xs text-slate-400">{props.detail}</div>
    </div>
  );
}

function Tile(props: { icon: React.ReactNode; label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
        {props.icon}
        {props.label}
      </div>
      <div className="mt-2 text-xl font-semibold text-white">{props.value}</div>
      <div className="mt-1 text-xs leading-5 text-slate-400">{props.helper}</div>
    </div>
  );
}

function Row(props: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 py-3 last:border-0">
      <span className="text-sm text-white/55">{props.label}</span>
      <span className="text-right text-sm font-semibold break-words">{props.value == null || props.value === '' ? '—' : String(props.value)}</span>
    </div>
  );
}

function MiniStat(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{props.label}</div>
      <div className="mt-2 text-sm font-semibold text-white break-words">{props.value}</div>
    </div>
  );
}

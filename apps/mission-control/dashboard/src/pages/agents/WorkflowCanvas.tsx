import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Background, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow } from '@xyflow/react';
import type { Edge, Node, NodeProps, NodeTypes } from '@xyflow/react';
import { fetchJson, getTenantId } from '../../lib/api';
import { ShellCard } from '../../components/ShellCard';
import { getSocket } from '../../lib/useSocket';

export type FlowStep = {
  run_id: string;
  tool_id: string | null;
  task_summary: string | null;
  task_type: string | null;
  started_at: string | null;
  completed_at: string | null;
  status: string;
  root_run_id: string;
  sequence_index: number | null;
  initiated_by: string | null;
  failure_reason: string | null;
};

export type FlowSummary = {
  root_run_id: string;
  root_task_summary: string | null;
  root_started_at: string | null;
  runs: number;
  any_failed: boolean;
  any_partial: boolean;
  any_running: boolean;
};

type FlowNodeData = {
  label: string;
  tool: string | null;
  type: string | null;
  status: string;
  index: number;
  time: string;
};

type ToolRow = {
  tool_id: string;
  display_name: string | null;
  category: string | null;
  status: string;
  last_status: string | null;
};

const STATUS_STYLES: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  running: { border: 'border-sky-400/50', bg: 'bg-sky-400/10', text: 'text-sky-200', dot: 'bg-sky-400 animate-pulse' },
  success: { border: 'border-emerald-400/40', bg: 'bg-emerald-400/10', text: 'text-emerald-200', dot: 'bg-emerald-400' },
  completed: { border: 'border-emerald-400/40', bg: 'bg-emerald-400/10', text: 'text-emerald-200', dot: 'bg-emerald-400' },
  failed: { border: 'border-red-400/50', bg: 'bg-red-400/10', text: 'text-red-200', dot: 'bg-red-400' },
  partial: { border: 'border-amber-400/40', bg: 'bg-amber-400/10', text: 'text-amber-200', dot: 'bg-amber-400' },
  queued: { border: 'border-white/15', bg: 'bg-white/5', text: 'text-white/60', dot: 'bg-white/30' },
  pending: { border: 'border-white/15', bg: 'bg-white/5', text: 'text-white/60', dot: 'bg-white/30' },
};

type FlowNodeType = Node<FlowNodeData>;

function FlowNode({ data }: NodeProps<FlowNodeType>) {
  const s = STATUS_STYLES[data.status] || STATUS_STYLES.queued;
  return (
    <div className={`w-52 rounded-2xl border ${s.border} ${s.bg} p-3 backdrop-blur-xl cursor-pointer hover:brightness-125`}>
      <Handle type="target" position={Position.Left} className="!bg-white/30 !w-2 !h-2" />
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${s.dot}`} />
        <span className={`text-[10px] font-bold uppercase tracking-wider ${s.text}`}>{data.status}</span>
      </div>
      <div className="mt-2 text-sm font-semibold leading-snug text-white">{data.label}</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-white/45">
        {data.tool && <span className="rounded-full bg-black/30 px-2 py-0.5 font-mono">{data.tool}</span>}
        {data.type && <span>{data.type}</span>}
      </div>
      {data.time && <div className="mt-2 text-[10px] text-white/35">step {data.index + 1} • {data.time}</div>}
      <Handle type="source" position={Position.Right} className="!bg-white/30 !w-2 !h-2" />
    </div>
  );
}

const nodeTypes: NodeTypes = { flow: FlowNode };

function formatTime(ts: string | null) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatStamp(ts: string | null) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

const AGENT_NODES = [
  { id: 'coding', name: 'Coding Agent' },
  { id: 'research', name: 'Research Agent' },
  { id: 'writing', name: 'Writing Agent' },
];

export default function WorkflowCanvas() {
  const [flows, setFlows] = useState<FlowSummary[]>([]);
  const [selectedRoot, setSelectedRoot] = useState<string | null>(null);
  const [steps, setSteps] = useState<FlowStep[]>([]);
  const [loadedRoot, setLoadedRoot] = useState<string | null>(null);
  const [loadingFlows, setLoadingFlows] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tools, setTools] = useState<ToolRow[]>([]);
  const [live, setLive] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const [agents, setAgents] = useState<Record<string, { name?: string }>>({});
  const [runAgent, setRunAgent] = useState('coding');
  const [runTask, setRunTask] = useState('');
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadRef = useRef<() => void>(() => undefined);
  const lastFollowedRunning = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ ok: boolean; tools?: ToolRow[] }>('/api/tools')
      .then((res) => {
        if (!cancelled) setTools(res.tools || []);
      })
      .catch(() => undefined);
    fetchJson<{ ok: boolean; agents?: Record<string, { name?: string }> }>('/api/subagents')
      .then((res) => {
        if (!cancelled) setAgents(res.agents || {});
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [flowRes, stepRes] = await Promise.all([
          fetchJson<{ ok: boolean; flows: FlowSummary[] }>('/api/flows?limit=50'),
          selectedRoot
            ? fetchJson<{ ok: boolean; flow: FlowStep[] }>(`/api/flows?root_run_id=${encodeURIComponent(selectedRoot)}`)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        const list = flowRes.flows || [];
        setFlows(list);

        const runningFlows = list.filter((f) => f.any_running);
        let root = selectedRoot;
        if (!root) {
          root = list[0]?.root_run_id || null;
        } else if (live && runningFlows.length > 0) {
          const currentRunning = runningFlows.some((f) => f.root_run_id === root);
          const nextRunning = runningFlows.find((f) => f.root_run_id !== lastFollowedRunning.current);
          if (!currentRunning && nextRunning) {
            root = nextRunning.root_run_id;
            lastFollowedRunning.current = nextRunning.root_run_id;
          }
        }
        if (root !== selectedRoot) setSelectedRoot(root);

        if (stepRes) {
          setSteps(stepRes.flow || []);
          setLoadedRoot(selectedRoot);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoadingFlows(false);
      }
    };

    loadRef.current = load;
    void load();

    if (!live) {
      return () => {
        cancelled = true;
      };
    }

    const id = setInterval(() => void load(), 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [selectedRoot, live]);

  useEffect(() => {
    if (!live) return;
    const socket = getSocket();
    if (!socket) return;
    const handler = () => loadRef.current();
    socket.on('flow:updated', handler);
    return () => {
      socket.off('flow:updated', handler);
    };
  }, [live]);

  const stepsLoading = selectedRoot !== loadedRoot;

  const { nodes, edges } = useMemo(() => {
    if (steps.length === 0) return { nodes: [] as Node[], edges: [] as Edge[] };
    const ordered = [...steps].sort((a, b) => {
      const ai = a.sequence_index ?? 0;
      const bi = b.sequence_index ?? 0;
      if (ai !== bi) return ai - bi;
      return (a.started_at || '').localeCompare(b.started_at || '');
    });

    const layers = new Map<number, FlowStep[]>();
    for (const s of ordered) {
      const layer = s.sequence_index ?? 0;
      if (!layers.has(layer)) layers.set(layer, []);
      layers.get(layer)!.push(s);
    }
    const layerKeys = [...layers.keys()].sort((a, b) => a - b);

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let prevRunIds: string[] = [];

    layerKeys.forEach((layerKey, col) => {
      const rows = layers.get(layerKey)!;
      const rowNodes: string[] = [];
      rows.forEach((step, row) => {
        const id = step.run_id;
        rowNodes.push(id);
        nodes.push({
          id,
          type: 'flow',
          position: { x: col * 250, y: row * 140 },
          data: {
            label: step.task_summary || step.task_type || step.tool_id || step.run_id.slice(0, 8),
            tool: step.tool_id,
            type: step.task_type,
            status: step.status,
            index: col,
            time: formatTime(step.started_at),
          } satisfies FlowNodeData,
        });
        if (col > 0 && prevRunIds.length > 0) {
          edges.push({
            id: `e-${id}`,
            source: prevRunIds[row % prevRunIds.length],
            target: id,
            type: 'smoothstep',
            animated: step.status === 'running',
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#94a3b8' },
            style: { stroke: step.status === 'failed' ? '#f87171' : '#475569', strokeWidth: 1.5 },
          });
        }
      });
      prevRunIds = rowNodes;
    });

    return { nodes, edges };
  }, [steps]);

  const selectedFlow = flows.find((f) => f.root_run_id === selectedRoot);
  const selectedStep = steps.find((s) => s.run_id === selectedRunId) || null;

  const paletteGroups = useMemo(() => {
    const groups = new Map<string, ToolRow[]>();
    for (const t of tools) {
      const key = t.category || 'uncategorized';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    return [...groups.entries()];
  }, [tools]);

  const submitRun = useCallback(async () => {
    const task = runTask.trim();
    if (!task || submitting) return;
    setSubmitting(true);
    setRunMessage(null);
    setError(null);
    try {
      const tenantId = await getTenantId();
      if (!tenantId) {
        setRunMessage('Could not resolve tenant context — are you logged in?');
        return;
      }
      const res = await fetchJson<{ ok: boolean; jobId?: string }>('/api/v1/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          command: task,
          actor: runAgent,
          approvalRequired: false,
          payload: { task },
        }),
      });
      if (res.ok && res.jobId) {
        setRunMessage(`Job ${res.jobId.slice(0, 8)}… queued — watch it run live.`);
        setRunTask('');
        loadRef.current();
      } else {
        setRunMessage('Failed to create job.');
      }
    } catch (e) {
      setRunMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [runTask, submitting, runAgent]);

  return (
    <div className="space-y-4">
      <ShellCard
        title="Live Orchestration"
        subtitle="n8n-style execution graph — nodes light up as the job worker deploys subagents."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-white/55">
              <span className={`h-2 w-2 rounded-full ${live ? 'bg-emerald-400 animate-pulse' : 'bg-white/25'}`} />
              Live
              <input
                type="checkbox"
                checked={live}
                onChange={(e) => setLive(e.target.checked)}
                className="accent-emerald-400"
              />
            </label>
            <button onClick={() => loadRef.current()} className="mc-secondary-button">Refresh</button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="w-full lg:w-44">
            <label className="mc-label">Agent</label>
            <select value={runAgent} onChange={(e) => setRunAgent(e.target.value)} className="mc-input">
              {AGENT_NODES.map((a) => (
                <option key={a.id} value={a.id}>{agents[a.id]?.name || a.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="mc-label">Task</label>
            <input
              value={runTask}
              onChange={(e) => setRunTask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitRun();
              }}
              placeholder="Deploy a subagent task, e.g. summarize today's CRM follow-ups..."
              className="mc-input"
            />
          </div>
          <button onClick={() => void submitRun()} disabled={submitting || !runTask.trim()} className="mc-primary-button lg:w-40">
            {submitting ? 'Queuing…' : 'Run'}
          </button>
        </div>
        {runMessage && <div className={`mt-3 text-sm ${runMessage.startsWith('Job') ? 'text-emerald-100' : 'text-red-100'}`}>{runMessage}</div>}
      </ShellCard>

      {error && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_320px] gap-4">
        <ShellCard title="Node Palette" subtitle="Available tools and agents" right={<span className="text-xs text-white/40">{tools.length}</span>}>
          <div className="max-h-[600px] space-y-4 overflow-y-auto pr-1">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/45">Agents</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {AGENT_NODES.map((a) => (
                  <span key={a.id} className="rounded-full border border-sky-400/25 bg-sky-400/10 px-2.5 py-1 text-[10px] font-semibold text-sky-100">
                    {a.id}
                  </span>
                ))}
              </div>
            </div>
            {paletteGroups.map(([category, rows]) => (
              <div key={category}>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/45">{category}</div>
                <div className="mt-2 space-y-1.5">
                  {rows.slice(0, 12).map((t) => (
                    <div key={t.tool_id} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-2.5 py-1.5">
                      <span className="truncate text-xs text-white/70">{t.display_name || t.tool_id}</span>
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.status === 'active' ? 'bg-emerald-400' : 'bg-white/25'}`} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ShellCard>

        <ShellCard
          title={selectedFlow ? (selectedFlow.root_task_summary || 'Flow trace') : 'Flow trace'}
          subtitle={selectedRoot ? `root_run_id: ${selectedRoot}` : 'Select a flow'}
          right={
            selectedRoot && flows.length > 0 ? (
              <select value={selectedRoot} onChange={(e) => setSelectedRoot(e.target.value)} className="mc-input !py-1 text-xs">
                {flows.map((f) => (
                  <option key={f.root_run_id} value={f.root_run_id}>
                    {f.root_task_summary || f.root_run_id.slice(0, 12)} {f.any_running ? '(running)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex gap-1.5">
                {selectedFlow?.any_running && <StatusChip tone="sky">running</StatusChip>}
                {selectedFlow?.any_failed && <StatusChip tone="red">failed</StatusChip>}
                {selectedFlow?.any_partial && <StatusChip tone="amber">partial</StatusChip>}
                <span className="text-xs text-white/40">{selectedFlow?.runs ?? 0} runs</span>
              </div>
            )
          }
        >
          {loadingFlows ? (
            <div className="flex h-[560px] items-center justify-center text-sm text-white/50">Loading flows...</div>
          ) : stepsLoading ? (
            <div className="flex h-[560px] items-center justify-center text-sm text-white/50">Loading flow trace...</div>
          ) : nodes.length === 0 ? (
            <div className="flex h-[560px] flex-col items-center justify-center gap-2 text-center">
              <div className="text-sm text-white/45">No steps in this flow yet.</div>
              <div className="text-xs text-white/30">Submit a run above — nodes will appear here live.</div>
            </div>
          ) : (
            <div className="h-[560px] rounded-2xl border border-white/10 bg-black/20">
              <ReactFlow
                key={selectedRoot || 'none'}
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.25}
                maxZoom={1.5}
                nodesConnectable={false}
                elementsSelectable
                onNodeClick={(_event, node) => setSelectedRunId(node.id)}
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#334155" gap={24} />
                <Controls />
                <MiniMap pannable zoomable className="!bg-white/5" maskColor="rgba(7,11,24,0.7)" />
              </ReactFlow>
            </div>
          )}
        </ShellCard>

        <ShellCard title="Inspector" subtitle="Selected node details">
          {selectedStep ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[selectedStep.status]?.text || 'text-white/60'} ${STATUS_STYLES[selectedStep.status]?.border || 'border-white/15'}`}>
                  {selectedStep.status}
                </span>
                <span className="font-mono text-[10px] text-white/40">step {selectedStep.sequence_index ?? 0}</span>
              </div>
              <div>
                <div className="text-xs font-semibold text-white/80">{selectedStep.task_summary || 'Untitled step'}</div>
                <div className="mt-0.5 text-[11px] text-white/45">{selectedStep.task_type || 'task'}</div>
              </div>
              <InspectorRow label="tool" value={selectedStep.tool_id} mono />
              <InspectorRow label="initiated by" value={selectedStep.initiated_by} mono />
              <InspectorRow label="started" value={formatStamp(selectedStep.started_at)} />
              <InspectorRow label="completed" value={formatStamp(selectedStep.completed_at)} />
              {selectedStep.failure_reason && (
                <div className="rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-xs leading-relaxed text-red-100">
                  {selectedStep.failure_reason}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-[520px] items-center justify-center text-center text-xs text-white/40">
              Select a node on the canvas to inspect its execution details.
            </div>
          )}
        </ShellCard>
      </div>
    </div>
  );
}

function InspectorRow(props: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-2 last:border-0">
      <span className="text-xs text-white/40">{props.label}</span>
      <span className={`break-words text-right text-xs text-white/70 ${props.mono ? 'font-mono' : ''}`}>{props.value || '—'}</span>
    </div>
  );
}

function StatusChip(props: { children: string; tone: 'green' | 'red' | 'amber' | 'sky' }) {
  const tones = {
    green: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100',
    red: 'border-red-400/25 bg-red-400/10 text-red-100',
    amber: 'border-amber-400/25 bg-amber-400/10 text-amber-100',
    sky: 'border-sky-400/25 bg-sky-400/10 text-sky-100',
  };
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tones[props.tone]}`}>{props.children}</span>;
}

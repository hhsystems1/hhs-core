import { useEffect, useMemo, useState } from 'react';
import { Background, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow } from '@xyflow/react';
import type { Edge, Node, NodeProps, NodeTypes } from '@xyflow/react';
import { fetchJson } from '../../lib/api';
import { ShellCard } from '../../components/ShellCard';

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
    <div className={`w-52 rounded-2xl border ${s.border} ${s.bg} p-3 backdrop-blur-xl`}>
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

export default function WorkflowCanvas() {
  const [flows, setFlows] = useState<FlowSummary[]>([]);
  const [selectedRoot, setSelectedRoot] = useState<string | null>(null);
  const [steps, setSteps] = useState<FlowStep[]>([]);
  const [loadedRoot, setLoadedRoot] = useState<string | null>(null);
  const [loadingFlows, setLoadingFlows] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    setError(null);
    setLoadingFlows(true);
    fetchJson<{ ok: boolean; flows: FlowSummary[] }>('/api/flows?limit=50')
      .then((res) => {
        const list = res.flows || [];
        setFlows(list);
        setSelectedRoot((cur) => cur || list[0]?.root_run_id || null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingFlows(false));
  };

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ ok: boolean; flows: FlowSummary[] }>('/api/flows?limit=50')
      .then((res) => {
        if (cancelled) return;
        const list = res.flows || [];
        setFlows(list);
        setSelectedRoot((cur) => cur || list[0]?.root_run_id || null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoadingFlows(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stepsLoading = selectedRoot !== loadedRoot;

  useEffect(() => {
    if (!selectedRoot) return;
    let cancelled = false;
    fetchJson<{ ok: boolean; flow: FlowStep[] }>(`/api/flows?root_run_id=${encodeURIComponent(selectedRoot)}`)
      .then((res) => {
        if (cancelled) return;
        setSteps(res.flow || []);
        setLoadedRoot(selectedRoot);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRoot]);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Workflow Canvas</div>
          <div className="mt-1 text-xs text-white/55">Visual trace of agent orchestration runs, grouped by root run.</div>
        </div>
        <button onClick={refresh} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10">Refresh</button>
      </div>

      {error && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-4">
        <ShellCard title="Flows" subtitle="Pick a root run to trace." right={<span className="text-xs text-white/40">{flows.length}</span>}>
          {loadingFlows ? (
            <div className="text-sm text-white/50">Loading flows...</div>
          ) : flows.length === 0 ? (
            <div className="text-sm text-white/45">No flows yet.</div>
          ) : (
            <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
              {flows.map((f) => (
                <button
                  key={f.root_run_id}
                  onClick={() => setSelectedRoot(f.root_run_id)}
                  className={`w-full text-left rounded-2xl border p-3 transition ${
                    selectedRoot === f.root_run_id
                      ? 'border-sky-400/40 bg-sky-400/10'
                      : 'border-white/10 bg-black/20 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-white/40">{f.root_run_id.slice(0, 12)}…</span>
                    <span className="text-[10px] text-white/40">{f.runs} runs</span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-white/75">{f.root_task_summary || '—'}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {f.any_running && <StatusChip tone="sky">running</StatusChip>}
                    {f.any_failed && <StatusChip tone="red">failed</StatusChip>}
                    {f.any_partial && <StatusChip tone="amber">partial</StatusChip>}
                    {!f.any_running && !f.any_failed && !f.any_partial && <StatusChip tone="green">clean</StatusChip>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ShellCard>

        <ShellCard
          title={selectedFlow ? (selectedFlow.root_task_summary || 'Flow trace') : 'Flow trace'}
          subtitle={selectedRoot ? `root_run_id: ${selectedRoot}` : 'Select a flow'}
          right={
            selectedFlow && (
              <div className="flex gap-1.5">
                {selectedFlow.any_running && <StatusChip tone="sky">running</StatusChip>}
                {selectedFlow.any_failed && <StatusChip tone="red">failed</StatusChip>}
                {selectedFlow.any_partial && <StatusChip tone="amber">partial</StatusChip>}
                <span className="text-xs text-white/40">{selectedFlow.runs} runs</span>
              </div>
            )
          }
        >
          {stepsLoading ? (
            <div className="flex h-[480px] items-center justify-center text-sm text-white/50">Loading flow trace...</div>
          ) : nodes.length === 0 ? (
            <div className="flex h-[480px] items-center justify-center text-sm text-white/45">No steps in this flow.</div>
          ) : (
            <div className="h-[520px] rounded-2xl border border-white/10 bg-black/20">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.25 }}
                minZoom={0.25}
                maxZoom={1.5}
                nodesConnectable={false}
                elementsSelectable
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#334155" gap={24} />
                <Controls />
                <MiniMap pannable zoomable className="!bg-white/5" maskColor="rgba(7,11,24,0.7)" />
              </ReactFlow>
            </div>
          )}
        </ShellCard>
      </div>
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

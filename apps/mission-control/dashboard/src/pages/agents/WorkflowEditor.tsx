import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import type { Connection, Edge, Node, NodeProps, NodeTypes } from '@xyflow/react';
import { fetchJson, getTenantId } from '../../lib/api';
import { ShellCard } from '../../components/ShellCard';

// ── Types ───────────────────────────────────────────────────────

type ToolRow = { tool_id: string; display_name: string | null; category: string | null; status: string };
type AgentDef = { id: string; name: string; description?: string };

type WorkflowDef = {
  id: string;
  name: string;
  description: string;
  nodes_json: Node[];
  edges_json: Edge[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type AgentNodeData = {
  label: string;
  agentId: string;
  taskPrompt: string;
  timeout: number;
  approvalRequired: boolean;
};

type ToolNodeData = {
  label: string;
  toolId: string;
  params: Record<string, unknown>;
};

type TriggerNodeData = {
  label: string;
  triggerType: 'manual' | 'webhook' | 'schedule';
};

const AGENT_DEFS: AgentDef[] = [
  { id: 'coding', name: 'Coding Agent', description: 'Write code, fix bugs, refactor' },
  { id: 'research', name: 'Research Agent', description: 'Search, analyze, summarize' },
  { id: 'writing', name: 'Writing Agent', description: 'Draft content, edit, format' },
];

// ── Custom Nodes ────────────────────────────────────────────────

function AgentNode({ data, selected }: NodeProps<Node<AgentNodeData>>) {
  return (
    <div className={`w-56 rounded-2xl border ${selected ? 'border-sky-400/60 ring-1 ring-sky-400/30' : 'border-sky-400/25'} bg-sky-400/10 p-3 backdrop-blur-xl transition-all`}>
      <Handle type="target" position={Position.Left} className="!bg-sky-400/50 !w-2.5 !h-2.5 !border-2 !border-sky-400/80" />
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-sky-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-sky-200">agent</span>
      </div>
      <div className="mt-2 text-sm font-semibold leading-snug text-white">{data.label}</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-white/45">
        <span className="rounded-full bg-black/30 px-2 py-0.5 font-mono">{data.agentId}</span>
        {data.timeout > 0 && <span>{data.timeout}s</span>}
        {data.approvalRequired && <span className="text-amber-300">approval</span>}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-sky-400/50 !w-2.5 !h-2.5 !border-2 !border-sky-400/80" />
    </div>
  );
}

function ToolNode({ data, selected }: NodeProps<Node<ToolNodeData>>) {
  return (
    <div className={`w-56 rounded-2xl border ${selected ? 'border-emerald-400/60 ring-1 ring-emerald-400/30' : 'border-emerald-400/25'} bg-emerald-400/10 p-3 backdrop-blur-xl transition-all`}>
      <Handle type="target" position={Position.Left} className="!bg-emerald-400/50 !w-2.5 !h-2.5 !border-2 !border-emerald-400/80" />
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">tool</span>
      </div>
      <div className="mt-2 text-sm font-semibold leading-snug text-white">{data.label}</div>
      <div className="mt-1.5 text-[10px] font-mono text-white/45">{data.toolId}</div>
      <Handle type="source" position={Position.Right} className="!bg-emerald-400/50 !w-2.5 !h-2.5 !border-2 !border-emerald-400/80" />
    </div>
  );
}

function TriggerNode({ data, selected }: NodeProps<Node<TriggerNodeData>>) {
  const icon = data.triggerType === 'webhook' ? 'hook' : data.triggerType === 'schedule' ? 'cron' : 'play';
  return (
    <div className={`w-44 rounded-2xl border ${selected ? 'border-amber-400/60 ring-1 ring-amber-400/30' : 'border-amber-400/25'} bg-amber-400/10 p-3 backdrop-blur-xl transition-all`}>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200">trigger</span>
        <span className="text-[9px] text-amber-300/50">{icon}</span>
      </div>
      <div className="mt-2 text-sm font-semibold leading-snug text-white">{data.label}</div>
      <div className="mt-1 text-[10px] text-white/45">{data.triggerType}</div>
      <Handle type="source" position={Position.Right} className="!bg-amber-400/50 !w-2.5 !h-2.5 !border-2 !border-amber-400/80" />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  agent: AgentNode as NodeTypes['agent'],
  tool: ToolNode as NodeTypes['tool'],
  trigger: TriggerNode as NodeTypes['trigger'],
};

// ── Helpers ─────────────────────────────────────────────────────

function hasCycle(nodes: Node[], edges: Edge[], newEdge: Connection): boolean {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    const src = typeof e.source === 'string' ? e.source : '';
    const tgt = typeof e.target === 'string' ? e.target : '';
    if (src && tgt) adj.get(src)?.push(tgt);
  }
  if (newEdge.source && newEdge.target) {
    adj.get(newEdge.source)?.push(newEdge.target);
  }
  const visited = new Set<string>();
  const stack = [...(adj.keys())];
  while (stack.length) {
    const cur = stack[stack.length - 1];
    if (visited.has(cur)) { stack.pop(); continue; }
    visited.add(cur);
    let fullyVisited = true;
    for (const next of adj.get(cur) || []) {
      if (newEdge.source && next === newEdge.source && cur === newEdge.target) return true;
      if (!visited.has(next)) { stack.push(next); fullyVisited = false; }
    }
    if (fullyVisited) stack.pop();
  }
  return false;
}

function getWorkflowNodeId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Inner editor (needs ReactFlowProvider) ──────────────────────

function WorkflowEditorInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [tools, setTools] = useState<ToolRow[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowDef[]>([]);
  const [currentWorkflow, setCurrentWorkflow] = useState<WorkflowDef | null>(null);
  const [workflowName, setWorkflowName] = useState('Untitled Workflow');
  const [workflowDesc, setWorkflowDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoadMenu, setShowLoadMenu] = useState(false);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();

  // Load tools + workflows on mount
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchJson<{ ok: boolean; tools?: ToolRow[] }>('/api/tools'),
      fetchJson<{ ok: boolean; workflows?: WorkflowDef[] }>('/api/v1/workflows'),
    ])
      .then(([toolRes, wfRes]) => {
        if (cancelled) return;
        setTools(toolRes.tools || []);
        setWorkflows(wfRes.workflows || []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // ── Drag from palette ───────────────────────────────────────

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/xyflow-node');
    if (!raw) return;
    let parsed: { type: string; data: Record<string, unknown> };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const id = getWorkflowNodeId();
    const newNode: Node = {
      id,
      type: parsed.type,
      position: pos,
      data: { ...parsed.data } as Record<string, unknown>,
    };
    setNodes((nds) => [...nds, newNode]);
  }, [screenToFlowPosition, setNodes]);

  // ── Connect edges (with cycle check) ────────────────────────

  const onConnect = useCallback((conn: Connection) => {
    if (!conn.source || !conn.target) return;
    if (conn.source === conn.target) return;
    if (hasCycle(nodes, edges, conn)) return;
    setEdges((eds) => addEdge({ ...conn, type: 'smoothstep', animated: true, style: { stroke: '#475569', strokeWidth: 1.5 } }, eds));
  }, [nodes, edges, setEdges]);

  // ── Select node for inspector ───────────────────────────────

  const onNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // ── Delete selected ─────────────────────────────────────────

  const onDelete = useCallback(() => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
  }, [selectedNode, setNodes, setEdges]);

  // ── Update selected node data ───────────────────────────────

  const updateNodeData = useCallback((id: string, patch: Record<string, unknown>) => {
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n));
    setSelectedNode((prev) => {
      if (prev && prev.id === id) return { ...prev, data: { ...prev.data, ...patch } };
      return prev;
    });
  }, [setNodes]);

  // ── Save workflow ───────────────────────────────────────────

  const saveWorkflow = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: workflowName,
        description: workflowDesc,
        nodes_json: nodes,
        edges_json: edges,
      };
      if (currentWorkflow) {
        const res = await fetchJson<{ ok: boolean; workflow?: WorkflowDef }>(`/api/v1/workflows/${currentWorkflow.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok && res.workflow) {
          setCurrentWorkflow(res.workflow);
          setWorkflows((prev) => prev.map((w) => w.id === res.workflow!.id ? res.workflow! : w));
        }
      } else {
        const res = await fetchJson<{ ok: boolean; workflow?: WorkflowDef }>('/api/v1/workflows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok && res.workflow) {
          setCurrentWorkflow(res.workflow);
          setWorkflows((prev) => [res.workflow!, ...prev]);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [workflowName, workflowDesc, nodes, edges, currentWorkflow]);

  // ── Load workflow ───────────────────────────────────────────

  const loadWorkflow = useCallback(async (wf: WorkflowDef) => {
    try {
      const res = await fetchJson<{ ok: boolean; workflow?: WorkflowDef }>(`/api/v1/workflows/${wf.id}`);
      if (res.ok && res.workflow) {
        setCurrentWorkflow(res.workflow);
        setWorkflowName(res.workflow.name);
        setWorkflowDesc(res.workflow.description);
        setNodes((res.workflow.nodes_json || []) as Node[]);
        setEdges((res.workflow.edges_json || []) as Edge[]);
        setSelectedNode(null);
        setShowLoadMenu(false);
        setTimeout(() => fitView({ padding: 0.2 }), 100);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [setNodes, setEdges, fitView]);

  // ── New workflow (reset canvas) ─────────────────────────────

  const newWorkflow = useCallback(() => {
    setCurrentWorkflow(null);
    setWorkflowName('Untitled Workflow');
    setWorkflowDesc('');
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    setShowLoadMenu(false);
  }, [setNodes, setEdges]);

  // ── Delete workflow ─────────────────────────────────────────

  const deleteWorkflow = useCallback(async () => {
    if (!currentWorkflow) return;
    if (!confirm(`Delete "${currentWorkflow.name}"?`)) return;
    try {
      await fetchJson(`/api/v1/workflows/${currentWorkflow.id}`, { method: 'DELETE' });
      setWorkflows((prev) => prev.filter((w) => w.id !== currentWorkflow.id));
      newWorkflow();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [currentWorkflow, newWorkflow]);

  // ── Run workflow ────────────────────────────────────────────

  const runWorkflow = useCallback(async () => {
    if (!currentWorkflow || running) return;
    setRunning(true);
    setRunMessage(null);
    setError(null);
    try {
      const tenantId = await getTenantId();
      if (!tenantId) { setRunMessage('Could not resolve tenant context.'); return; }
      const res = await fetchJson<{ ok: boolean; jobId?: string; node_count?: number }>(
        `/api/v1/workflows/${currentWorkflow.id}/run`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actor: 'coding' }),
        }
      );
      if (res.ok && res.jobId) {
        setRunMessage(`Job ${res.jobId.slice(0, 8)}… queued — ${res.node_count ?? 0} nodes.`);
      } else {
        setRunMessage('Failed to queue workflow.');
      }
    } catch (e) {
      setRunMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }, [currentWorkflow, running]);

  // ── Keyboard shortcuts ──────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        void saveWorkflow();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const el = e.target as HTMLElement;
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;
        onDelete();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [saveWorkflow, onDelete]);

  // ── Palette items ───────────────────────────────────────────

  const paletteGroups = useMemo(() => {
    const groups = new Map<string, ToolRow[]>();
    for (const t of tools) {
      const key = t.category || 'uncategorized';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    return [...groups.entries()];
  }, [tools]);

  return (
    <div className="space-y-4">
      {/* ── Toolbar ────────────────────────────────────────────── */}
      <ShellCard
        title="Workflow Editor"
        subtitle="n8n-style visual builder — drag nodes, connect edges, save & run."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={newWorkflow} className="mc-secondary-button text-xs">New</button>

            <div className="relative">
              <button onClick={() => setShowLoadMenu(!showLoadMenu)} className="mc-secondary-button text-xs">
                Load ({workflows.length})
              </button>
              {showLoadMenu && (
                <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-2xl border border-white/15 bg-zinc-900 shadow-2xl">
                  {workflows.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-white/40">No saved workflows</div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto py-1">
                      {workflows.map((wf) => (
                        <button
                          key={wf.id}
                          onClick={() => void loadWorkflow(wf)}
                          className="w-full px-4 py-2 text-left text-xs text-white/70 hover:bg-white/5 transition"
                        >
                          <div className="font-medium">{wf.name}</div>
                          <div className="text-[10px] text-white/35">{wf.updated_at?.slice(0, 10)}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => void saveWorkflow()}
              disabled={saving}
              className="mc-primary-button text-xs"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>

            <button
              onClick={() => void runWorkflow()}
              disabled={!currentWorkflow || running}
              className="rounded-2xl px-4 py-2 text-xs font-semibold border border-emerald-400/30 bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25 transition disabled:opacity-40"
            >
              {running ? 'Queuing…' : 'Run'}
            </button>

            {currentWorkflow && (
              <button onClick={() => void deleteWorkflow()} className="mc-secondary-button text-xs text-red-300 border-red-400/20 hover:bg-red-400/10">
                Delete
              </button>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="mc-label">Workflow name</label>
            <input
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="mc-input"
              placeholder="e.g. CRM follow-up pipeline"
            />
          </div>
          <div className="flex-1">
            <label className="mc-label">Description</label>
            <input
              value={workflowDesc}
              onChange={(e) => setWorkflowDesc(e.target.value)}
              className="mc-input"
              placeholder="Optional description"
            />
          </div>
        </div>
        {runMessage && (
          <div className={`mt-3 text-sm ${runMessage.includes('queued') ? 'text-emerald-100' : 'text-red-100'}`}>
            {runMessage}
          </div>
        )}
        {currentWorkflow && (
          <div className="mt-2 text-[10px] text-white/35">
            ID: {currentWorkflow.id.slice(0, 8)} • saved {currentWorkflow.updated_at?.slice(0, 16).replace('T', ' ')}
          </div>
        )}
      </ShellCard>

      {error && (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">{error}</div>
      )}

      {/* ── 3-pane editor ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_320px] gap-4">

        {/* ── Palette ──────────────────────────────────────────── */}
        <ShellCard title="Node Palette" subtitle="Drag onto canvas">
          <div className="max-h-[640px] space-y-4 overflow-y-auto pr-1">
            {/* Trigger */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/45">Trigger</div>
              <div className="mt-2">
                <PaletteItem
                  label="Manual Trigger"
                  sublabel="Start by clicking Run"
                  color="amber"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/xyflow-node', JSON.stringify({
                      type: 'trigger',
                      data: { label: 'Manual Trigger', triggerType: 'manual' },
                    }));
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                />
              </div>
            </div>

            {/* Agents */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/45">Agents</div>
              <div className="mt-2 space-y-1.5">
                {AGENT_DEFS.map((a) => (
                  <PaletteItem
                    key={a.id}
                    label={a.name}
                    sublabel={a.description || a.id}
                    color="sky"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/xyflow-node', JSON.stringify({
                        type: 'agent',
                        data: { label: a.name, agentId: a.id, taskPrompt: '', timeout: 300, approvalRequired: false },
                      }));
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Tools */}
            {paletteGroups.map(([category, rows]) => (
              <div key={category}>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/45">{category}</div>
                <div className="mt-2 space-y-1.5">
                  {rows.slice(0, 15).map((t) => (
                    <PaletteItem
                      key={t.tool_id}
                      label={t.display_name || t.tool_id}
                      sublabel={t.tool_id}
                      color="emerald"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/xyflow-node', JSON.stringify({
                          type: 'tool',
                          data: { label: t.display_name || t.tool_id, toolId: t.tool_id, params: {} },
                        }));
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ShellCard>

        {/* ── Canvas ───────────────────────────────────────────── */}
        <ShellCard
          title={workflowName}
          subtitle={`${nodes.length} nodes • ${edges.length} edges`}
          right={
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/40">{nodes.length === 0 ? 'Drop nodes from palette' : `${nodes.length} nodes`}</span>
            </div>
          }
        >
          {loading ? (
            <div className="flex h-[640px] items-center justify-center text-sm text-white/50">Loading tools...</div>
          ) : (
            <div ref={reactFlowWrapper} className="h-[640px] rounded-2xl border border-white/10 bg-black/20">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                onDragOver={onDragOver}
                onDrop={onDrop}
                nodeTypes={nodeTypes}
                snapToGrid
                snapGrid={[15, 15]}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.25}
                maxZoom={2}
                deleteKeyCode={null}
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#334155" gap={24} />
                <Controls />
                <MiniMap pannable zoomable className="!bg-white/5" maskColor="rgba(7,11,24,0.7)" />
              </ReactFlow>
            </div>
          )}
        </ShellCard>

        {/* ── Inspector / Config panel ─────────────────────────── */}
        <ShellCard title="Node Config" subtitle={selectedNode ? `Editing ${selectedNode.type} node` : 'Select a node'}>
          {selectedNode ? (
            <NodeConfigPanel node={selectedNode} onUpdate={updateNodeData} onDelete={onDelete} />
          ) : (
            <div className="flex h-[600px] flex-col items-center justify-center gap-3 text-center">
              <div className="text-sm text-white/45">Click a node on the canvas</div>
              <div className="text-xs text-white/30">Drag from palette to add nodes</div>
              <div className="text-[10px] text-white/20">Ctrl+S to save • Delete to remove</div>
            </div>
          )}
        </ShellCard>
      </div>
    </div>
  );
}

// ── Node Config Panel ───────────────────────────────────────────

function NodeConfigPanel({ node, onUpdate, onDelete }: {
  node: Node;
  onUpdate: (id: string, patch: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const d = node.data as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
          node.type === 'agent' ? 'border-sky-400/25 bg-sky-400/10 text-sky-200' :
          node.type === 'tool' ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200' :
          'border-amber-400/25 bg-amber-400/10 text-amber-200'
        }`}>{node.type}</span>
        <button onClick={onDelete} className="text-[10px] text-red-400 hover:text-red-300 transition">Remove</button>
      </div>

      <div>
        <label className="mc-label">Label</label>
        <input
          value={String(d.label || '')}
          onChange={(e) => onUpdate(node.id, { label: e.target.value })}
          className="mc-input"
        />
      </div>

      {node.type === 'agent' && (
        <>
          <div>
            <label className="mc-label">Agent type</label>
            <select
              value={String(d.agentId || 'coding')}
              onChange={(e) => onUpdate(node.id, { agentId: e.target.value })}
              className="mc-input"
            >
              {AGENT_DEFS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mc-label">Task prompt</label>
            <textarea
              value={String(d.taskPrompt || '')}
              onChange={(e) => onUpdate(node.id, { taskPrompt: e.target.value })}
              className="mc-input min-h-[100px]"
              placeholder="What should this agent do?"
            />
          </div>
          <div>
            <label className="mc-label">Timeout (seconds)</label>
            <input
              type="number"
              value={Number(d.timeout || 300)}
              onChange={(e) => onUpdate(node.id, { timeout: Number(e.target.value) })}
              className="mc-input"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-white/60">
            <input
              type="checkbox"
              checked={Boolean(d.approvalRequired)}
              onChange={(e) => onUpdate(node.id, { approvalRequired: e.target.checked })}
              className="accent-amber-400"
            />
            Require approval before running
          </label>
        </>
      )}

      {node.type === 'tool' && (
        <div>
          <label className="mc-label">Tool ID</label>
          <input
            value={String(d.toolId || '')}
            onChange={(e) => onUpdate(node.id, { toolId: e.target.value })}
            className="mc-input font-mono"
          />
        </div>
      )}

      {node.type === 'trigger' && (
        <div>
          <label className="mc-label">Trigger type</label>
          <select
            value={String(d.triggerType || 'manual')}
            onChange={(e) => onUpdate(node.id, { triggerType: e.target.value })}
            className="mc-input"
          >
            <option value="manual">Manual</option>
            <option value="webhook">Webhook</option>
            <option value="schedule">Schedule</option>
          </select>
        </div>
      )}

      <div className="border-t border-white/5 pt-3">
        <div className="text-[10px] text-white/30">Node ID: {node.id}</div>
        <div className="text-[10px] text-white/30">Position: {Math.round(node.position.x)}, {Math.round(node.position.y)}</div>
      </div>
    </div>
  );
}

// ── Palette item ────────────────────────────────────────────────

function PaletteItem({ label, sublabel, color, draggable, onDragStart }: {
  label: string;
  sublabel: string;
  color: 'sky' | 'emerald' | 'amber';
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}) {
  const colorMap = {
    sky: 'border-sky-400/20 bg-sky-400/5 hover:bg-sky-400/10 hover:border-sky-400/35',
    emerald: 'border-emerald-400/20 bg-emerald-400/5 hover:bg-emerald-400/10 hover:border-emerald-400/35',
    amber: 'border-amber-400/20 bg-amber-400/5 hover:bg-amber-400/10 hover:border-amber-400/35',
  };
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      className={`rounded-xl border px-3 py-2 transition-all ${colorMap[color]} ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="text-xs font-medium text-white/80">{label}</div>
      <div className="text-[10px] text-white/40 truncate">{sublabel}</div>
    </div>
  );
}

// ── Exported wrapper (provides ReactFlowProvider) ───────────────

export default function WorkflowEditor() {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner />
    </ReactFlowProvider>
  );
}

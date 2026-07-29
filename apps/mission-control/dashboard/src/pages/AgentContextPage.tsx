import { useCallback, useEffect, useState } from 'react';
import { fetchJson, formatWhen } from '../lib/api';

type ContextEntry = {
  id: string;
  agent_id: string;
  session_id: string;
  context_type: string;
  summary: string | null;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
  expires_at: string | null;
};

type AgentSummary = {
  agent_id: string;
  entry_count: number;
  last_seen: string;
};

const CONTEXT_TYPES = ['state', 'conversation', 'decision', 'observation', 'handoff'];

export default function AgentContextPage() {
  const [entries, setEntries] = useState<ContextEntry[]>([]);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [filterType, setFilterType] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<ContextEntry[] | null>(null);

  const loadAgents = useCallback(async () => {
    try {
      const res = await fetchJson<{ agents: AgentSummary[] }>('/api/context/agents');
      setAgents(res.agents || []);
    } catch {
      // non-critical
    }
  }, []);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (searchText) params.set('q', searchText);
      if (filterAgent) params.set('agent_id', filterAgent);
      if (filterType) params.set('context_type', filterType);
      const res = await fetchJson<{ entries: ContextEntry[] }>(`/api/context?${params.toString()}`);
      setEntries(res.entries || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [searchText, filterAgent, filterType]);

  useEffect(() => { loadAgents(); }, []);
  useEffect(() => { loadEntries(); }, [loadEntries]);

  const loadSession = async (sessionId: string) => {
    try {
      const res = await fetchJson<{ entries: ContextEntry[] }>(`/api/context/${encodeURIComponent(sessionId)}`);
      setSelectedSession(res.entries || []);
    } catch {
      setSelectedSession([]);
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      await fetchJson(`/api/context/${id}`, { method: 'DELETE' });
      loadEntries();
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold">Agent Context Store</h1>
            <p className="mt-1 text-sm text-white/50">Persistent memory for AI agents — search across sessions, pick up where you left off.</p>
          </div>
          <span className="shrink-0 rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-100">{entries.length} entries</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input value={searchText} onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search context content..."
          className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-white outline-none focus:border-sky-300/50 w-64"
        />
        <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)}
          className="rounded-full border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-300/50"
        >
          <option value="">All agents</option>
          {agents.map((a) => <option key={a.agent_id} value={a.agent_id}>{a.agent_id} ({a.entry_count})</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="rounded-full border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-300/50"
        >
          <option value="">All types</option>
          {CONTEXT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {error && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">{error}</div>}

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-white/45 text-center">Loading context...</div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-white/45 text-center">
          No context entries found. Agents can store context via <code className="text-sky-200">POST /api/context</code>.
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-white/10 bg-black/20 p-4 hover:border-white/20 transition">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      entry.context_type === 'state' ? 'bg-sky-400/15 text-sky-200' :
                      entry.context_type === 'decision' ? 'bg-amber-400/15 text-amber-200' :
                      entry.context_type === 'handoff' ? 'bg-purple-400/15 text-purple-200' :
                      entry.context_type === 'observation' ? 'bg-emerald-400/15 text-emerald-200' :
                      'bg-white/10 text-white/50'
                    }`}>{entry.context_type}</span>
                    <span className="text-xs font-mono text-white/40">{entry.agent_id}</span>
                    <button onClick={() => loadSession(entry.session_id)}
                      className="text-xs text-sky-200 hover:text-sky-100 underline underline-offset-2"
                    >{entry.session_id.slice(0, 24)}</button>
                  </div>
                  {entry.summary && <div className="mt-1 text-sm font-semibold">{entry.summary}</div>}
                  <div className={`mt-1 text-xs text-white/60 ${expandedId === entry.id ? '' : 'line-clamp-2'}`}>
                    {entry.content}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-white/35">
                    <span>{formatWhen(entry.created_at)}</span>
                    {entry.expires_at && <span>Expires: {formatWhen(entry.expires_at)}</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-white/60 hover:bg-white/10"
                  >{expandedId === entry.id ? 'Collapse' : 'Expand'}</button>
                  <button onClick={() => deleteEntry(entry.id)}
                    className="rounded-full border border-red-400/20 px-2 py-1 text-[10px] text-red-200 hover:bg-red-400/10"
                  >Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedSession && (
        <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setSelectedSession(null)} />
      )}
      {selectedSession && (
        <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-zinc-900 border-l border-white/10 z-50 shadow-2xl overflow-y-auto">
          <div className="sticky top-0 bg-zinc-900 border-b border-white/10 p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-white/40">Session context</div>
              <div className="text-sm font-semibold truncate">{selectedSession[0]?.session_id || 'Unknown'}</div>
            </div>
            <button onClick={() => setSelectedSession(null)} className="rounded-full p-1.5 hover:bg-white/10 text-white/60">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="p-4 space-y-3">
            {selectedSession.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    entry.context_type === 'state' ? 'bg-sky-400/15 text-sky-200' :
                    entry.context_type === 'decision' ? 'bg-amber-400/15 text-amber-200' :
                    'bg-white/10 text-white/50'
                  }`}>{entry.context_type}</span>
                  <span className="text-[10px] text-white/35">{entry.agent_id}</span>
                  <span className="text-[10px] text-white/35">{formatWhen(entry.created_at)}</span>
                </div>
                {entry.summary && <div className="text-xs font-semibold mb-1">{entry.summary}</div>}
                <div className="text-xs text-white/60 whitespace-pre-wrap line-clamp-6">{entry.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

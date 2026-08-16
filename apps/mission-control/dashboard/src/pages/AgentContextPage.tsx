import { useEffect, useRef, useState } from 'react';
import { BookOpenText, FileUp, FileText, Link2, Loader2, Trash2 } from 'lucide-react';
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

type ContextDocument = {
  id: string;
  title: string;
  filename: string;
  content: string;
  links: string[];
  source: string;
  uploaded_by: string | null;
  artifact_id: string | null;
  knowledge_document_id: string | null;
  created_at: string;
  updated_at: string;
  content_preview?: string;
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

  const [docs, setDocs] = useState<ContextDocument[]>([]);
  const [docTitle, setDocTitle] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ agents: AgentSummary[] }>('/api/context/agents')
      .then((res) => {
        if (!cancelled) setAgents(res.agents || []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ limit: '100' });
    if (searchText) params.set('q', searchText);
    if (filterAgent) params.set('agent_id', filterAgent);
    if (filterType) params.set('context_type', filterType);
    fetchJson<{ entries: ContextEntry[] }>(`/api/context?${params.toString()}`)
      .then((res) => {
        if (!cancelled) {
          setEntries(res.entries || []);
          setError(null);
        }
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
  }, [searchText, filterAgent, filterType]);

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ documents: ContextDocument[] }>('/api/context/documents')
      .then((res) => {
        if (!cancelled) setDocs(res.documents || []);
      })
      .catch((e) => {
        if (!cancelled) setDocError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshEntries() {
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (searchText) params.set('q', searchText);
      if (filterAgent) params.set('agent_id', filterAgent);
      if (filterType) params.set('context_type', filterType);
      const res = await fetchJson<{ entries: ContextEntry[] }>(`/api/context?${params.toString()}`);
      setEntries(res.entries || []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

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
      void refreshEntries();
    } catch {
      // ignore
    }
  };

  async function uploadDoc() {
    if (!docFile) return;
    setUploading(true);
    setDocError(null);
    try {
      const form = new FormData();
      form.append('file', docFile);
      if (docTitle.trim()) form.append('title', docTitle.trim());
      const res = await fetchJson<{ document: ContextDocument }>('/api/context/documents', {
        method: 'POST',
        body: form,
      });
      setDocs((prev) => [res.document, ...prev]);
      setDocFile(null);
      setDocTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e) {
      setDocError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  async function deleteDoc(id: string) {
    setDeletingId(id);
    setDocError(null);
    try {
      await fetchJson(`/api/context/documents/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      setDocError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold">Agent Context</h1>
            <p className="mt-1 text-sm text-white/50">Upload reference material (.md) for agents to read, and browse the agent context store.</p>
          </div>
          <span className="shrink-0 rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-100">{entries.length} entries</span>
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <BookOpenText className="h-4 w-4 text-sky-300" />
          <h2 className="text-sm font-bold">Context documents</h2>
        </div>
        <p className="mt-1 text-sm text-white/50">Upload .md files with information or links you want agents to be able to look at.</p>

        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <input
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            placeholder="Title (optional — defaults to filename)"
            className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white outline-none focus:border-sky-300/50 flex-1"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.markdown,.txt"
            onChange={(e) => setDocFile(e.target.files?.[0] || null)}
            className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white/80 outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:border-white/20 flex-1"
          />
          <button
            onClick={() => void uploadDoc()}
            disabled={!docFile || uploading}
            className="mc-primary-button gap-2"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>

        {docError && <div className="mc-alert mt-3">{docError}</div>}

        {docs.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-6 text-sm text-white/45 text-center">
            No context documents yet. Upload a .md file to give agents shared reference material.
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {docs.map((d) => (
              <div key={d.id} className="rounded-2xl border border-white/10 bg-black/30 p-4 hover:border-white/20 transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-sky-300" />
                      <span className="text-sm font-semibold truncate">{d.title}</span>
                    </div>
                    <div className="mt-1 text-xs text-white/45">{d.filename} • {formatWhen(d.created_at)}{d.uploaded_by ? ` • by ${d.uploaded_by}` : ''}</div>
                    {d.content_preview && (
                      <div className="mt-2 text-xs text-white/60 line-clamp-2 whitespace-pre-wrap">{d.content_preview}</div>
                    )}
                    {d.links.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Link2 className="h-3 w-3 text-white/35" />
                        {d.links.slice(0, 8).map((link) => (
                          <a
                            key={link}
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                            className="max-w-[220px] truncate rounded-full border border-sky-400/20 bg-sky-400/10 px-2 py-0.5 text-[10px] text-sky-200 hover:bg-sky-400/20"
                          >
                            {link}
                          </a>
                        ))}
                        {d.links.length > 8 && <span className="text-[10px] text-white/40">+{d.links.length - 8} more</span>}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => void deleteDoc(d.id)}
                    disabled={deletingId === d.id}
                    className="shrink-0 rounded-full border border-red-400/20 px-2.5 py-1.5 text-[10px] text-red-200 hover:bg-red-400/10 disabled:opacity-50"
                  >
                    {deletingId === d.id ? '…' : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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

import { useEffect, useMemo, useState } from 'react';
import { ShellCard } from '../components/ShellCard';
import { fetchJson, formatWhen } from '../lib/api';

type AgentConfig = {
  name: string;
  model: string;
  fallbacks?: string[];
  description?: string;
};

type AgentsResponse = {
  ok: boolean;
  agents: Record<string, AgentConfig>;
};

type ModelInfo = {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
};

type ModelsResponse = {
  ok: boolean;
  models: ModelInfo[];
};

type SessionRecord = {
  id?: string;
  sessionId?: string;
  title?: string;
  name?: string;
  updatedAt?: string;
  updated_at?: string;
  createdAt?: string;
  created_at?: string;
  summary?: string;
  compressed?: string;
  messages?: unknown[];
  [key: string]: unknown;
};

type ChatTurn = {
  id: string;
  role: 'user' | 'agent';
  text: string;
  meta?: string;
};

function labelForSession(session: SessionRecord) {
  return String(session.title || session.name || session.id || session.sessionId || 'OpenClaw session');
}

function sessionId(session: SessionRecord) {
  return String(session.id || session.sessionId || labelForSession(session));
}

function compressedText(session: SessionRecord) {
  if (session.summary) return String(session.summary);
  if (session.compressed) return String(session.compressed);
  if (Array.isArray(session.messages)) return `${session.messages.length} messages available in session history.`;
  return JSON.stringify(session, null, 2).slice(0, 900);
}

export default function AgentConsolePage() {
  const [agents, setAgents] = useState<Record<string, AgentConfig>>({});
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('coding');
  const [selectedModel, setSelectedModel] = useState('');
  const [message, setMessage] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [activeSession, _setActiveSession] = useState<string | null>(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchJson<AgentsResponse>('/api/subagents'),
      fetchJson<ModelsResponse>('/api/models'),
      fetchJson<{ ok: boolean; sessions?: SessionRecord[]; raw?: string }>('/api/subagents/list').catch((e) => ({
        ok: false,
        sessions: [],
        raw: String(e),
      })),
    ])
      .then(([agentResult, modelResult, sessionResult]) => {
        if (cancelled) return;
        setAgents(agentResult.agents || {});
        setModels(modelResult.models || []);
        setSessions(Array.isArray(sessionResult.sessions) ? sessionResult.sessions : []);
        const firstAgent = Object.keys(agentResult.agents || {})[0] || 'coding';
        setSelectedAgent(firstAgent);
        setSelectedModel(agentResult.agents?.[firstAgent]?.model || modelResult.models?.[0]?.id || '');
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

  useEffect(() => {
    const storedTask = localStorage.getItem('mission-control:task');
    const storedProject = localStorage.getItem('mission-control:project');
    const storedTemplate = localStorage.getItem('mission-control:template');

    if (storedTask && !message.trim()) {
      setMessage(storedTask);
    }
    if (storedProject) {
      setStatusMessage(`Loaded brief for ${storedProject}${storedTemplate ? ` • ${storedTemplate}` : ''}`);
    }
  }, []);

  useEffect(() => {
    const model = agents[selectedAgent]?.model;
    if (model) setSelectedModel(model);
  }, [agents, selectedAgent]);

  const selectedHistory = useMemo(
    () => sessions.find((session) => sessionId(session) === selectedHistoryId) || sessions[0] || null,
    [selectedHistoryId, sessions]
  );

  async function refreshSessions() {
    const result = await fetchJson<{ ok: boolean; sessions?: SessionRecord[] }>('/api/subagents/list');
    setSessions(Array.isArray(result.sessions) ? result.sessions : []);
  }

  async function sendMessage() {
    const task = message.trim();
    if (!task || sending) return;
    setError(null);
    setSending(true);
    const userTurn: ChatTurn = { id: `u-${Date.now()}`, role: 'user', text: task };
    setTurns((current) => [...current, userTurn]);
    setMessage('');

    try {
      if (selectedModel && selectedModel !== agents[selectedAgent]?.model) {
        await fetchJson(`/api/agents/${selectedAgent}/model`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: selectedModel }),
        });
      }

      // Refactored to use the durable Command Gateway
      const result = await fetchJson<{ ok: boolean; jobId?: string; commandId?: string }>(
        '/api/v1/commands',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: '00000000-0000-0000-0000-000000000000', // This should come from a real auth context in prod
            command: task,
            actor: selectedAgent,
            approvalRequired: false, // default to false for console; can be toggled in UI
            payload: { task },
          }),
        }
      );

      if (result.ok) {
        const jobId = result.jobId;
        setTurns((current) => [
          ...current,
          {
            id: `a-${Date.now()}`,
            role: 'agent',
            text: jobId 
              ? `Job created successfully. ID: ${jobId}. You can now track this on the Agent Board.` 
              : 'Command submitted.',
            meta: `${agents[selectedAgent]?.name || selectedAgent} • ${selectedModel}`,
          },
        ]);
        // Optional: window.location.href = `/agents/board`;
      } else {
        throw new Error('Failed to create job');
      }

      localStorage.removeItem('mission-control:task');
      localStorage.removeItem('mission-control:project');
      localStorage.removeItem('mission-control:template');
      refreshSessions().catch(() => undefined);
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      setError(text);
      setTurns((current) => [...current, { id: `e-${Date.now()}`, role: 'agent', text, meta: 'error' }]);
    } finally {
      setSending(false);
    }
  }

  const agentEntries = Object.entries(agents);

  return (
    <div className="mc-page space-y-4 sm:space-y-6">
      <div className="mc-hero">
        <div>
          <div className="mc-eyebrow">Mission Control</div>
          <h2>Agent Console</h2>
          <p>Choose an agent, choose the model, run work, and inspect old OpenClaw sessions from one mobile-friendly surface. This is the control room, not the Telegram workaround.</p>
        </div>
        <div className="mc-hero-status">
          <span className="mc-live-dot" />
          {activeSession ? `Session ${activeSession}` : 'Ready'}
        </div>
      </div>

      {error && <div className="mc-alert">{error}</div>}
      {statusMessage && <div className="mc-alert">{statusMessage}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-[320px,1fr,340px] gap-4">
        <ShellCard title="Controls" subtitle="Agent and model routing">
          <div className="space-y-4">
            <div>
              <label className="mc-label">Agent</label>
              <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)} className="mc-input">
                {agentEntries.map(([key, agent]) => (
                  <option key={key} value={key}>
                    {agent.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-white/45">{agents[selectedAgent]?.description || 'Operational agent'}</p>
            </div>
            <div>
              <label className="mc-label">Model</label>
              <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="mc-input">
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Agents" value={loading ? '...' : agentEntries.length} />
              <Metric label="Models" value={loading ? '...' : models.length} />
            </div>
          </div>
        </ShellCard>

        <ShellCard title="Chat" subtitle="Runs through the local Mission Control API">
          <div className="mc-chat-window">
            {turns.length === 0 ? (
              <div className="mc-empty-state">
                <div className="font-semibold text-white">Start with a concrete task.</div>
                <div className="mt-1 text-sm text-white/50">Example: summarize today&apos;s CRM follow-ups or inspect the solar lead queue.</div>
              </div>
            ) : (
              turns.map((turn) => (
                <div key={turn.id} className={`mc-message ${turn.role === 'user' ? 'mc-message-user' : 'mc-message-agent'}`}>
                  {turn.meta && <div className="mc-message-meta">{turn.meta}</div>}
                  <div className="whitespace-pre-wrap">{turn.text}</div>
                </div>
              ))
            )}
          </div>
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendMessage();
              }}
              placeholder="Ask an agent to do real work..."
              className="mc-input min-h-[88px] sm:min-h-[52px] flex-1"
            />
            <button onClick={sendMessage} disabled={sending || !message.trim()} className="mc-primary-button sm:w-32">
              {sending ? 'Running' : 'Send'}
            </button>
          </div>
        </ShellCard>

        <ShellCard title="Old Chats" subtitle="OpenClaw session history and compressed view">
          <div className="space-y-3">
            <button onClick={refreshSessions} className="mc-secondary-button w-full">Refresh history</button>
            <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
              {sessions.length === 0 ? (
                <div className="mc-empty-state text-sm">No sessions returned yet.</div>
              ) : (
                sessions.slice(0, 30).map((session) => {
                  const id = sessionId(session);
                  return (
                    <button
                      key={id}
                      onClick={() => setSelectedHistoryId(id)}
                      className={`mc-list-row text-left ${selectedHistory && sessionId(selectedHistory) === id ? 'mc-list-row-active' : ''}`}
                    >
                      <div className="truncate font-semibold">{labelForSession(session)}</div>
                      <div className="mt-1 text-xs text-white/45">{formatWhen(String(session.updatedAt || session.updated_at || session.createdAt || session.created_at || ''))}</div>
                    </button>
                  );
                })
              )}
            </div>
            {selectedHistory && (
              <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-white/45">Compressed Info</div>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-white/70">{compressedText(selectedHistory)}</pre>
              </div>
            )}
          </div>
        </ShellCard>
      </div>
    </div>
  );
}

function Metric(props: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="text-xs text-white/45">{props.label}</div>
      <div className="mt-1 text-xl font-bold">{props.value}</div>
    </div>
  );
}

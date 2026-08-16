import { useEffect, useState } from 'react';
import { Bot, Cable, Cloud, Gauge, Radio, RefreshCw, Server, Wrench, Zap } from 'lucide-react';
import { fetchJson } from '../../lib/api';

type Connection = {
  name: string;
  connected?: boolean;
  detail?: string;
  code?: string;
  url?: string;
  cli?: string;
  mode?: string;
};

type ConnectionsResponse = {
  ok?: boolean;
  checked_at?: string;
  gateway?: Connection;
  connections?: Connection[];
};

const AGENT_META: Record<string, { icon: React.ComponentType<{ className?: string }>; blurb: string }> = {
  OpenClaw: { icon: Bot, blurb: 'Local agent runtime — bots, memory, and subagent orchestration.' },
  Hermes: { icon: Radio, blurb: 'Messaging/agent gateway being wired into Mission Control.' },
  Codex: { icon: Wrench, blurb: 'OpenAI coding agent — task execution and code work.' },
};

export default function SystemStatusPage() {
  const [status, setStatus] = useState<ConnectionsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(true);

  async function load() {
    setErr(null);
    setRefreshing(true);
    try {
      setStatus(await fetchJson<ConnectionsResponse>('/api/connections/status'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetchJson<ConnectionsResponse>('/api/connections/status')
      .then((res) => {
        if (!cancelled) setStatus(res);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const connections = status?.connections || [];
  const connectedCount = connections.filter((c) => c.connected).length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
              <Gauge className="h-3.5 w-3.5" />
              Live connections
            </div>
            <h1 className="mt-3 text-xl sm:text-2xl font-bold">What's live and connected</h1>
            <p className="mt-1 text-sm text-white/55">
              Probes the agent runtimes we rely on — OpenClaw, Hermes, and Codex — plus the Mission Control gateway.
            </p>
          </div>
          <button
            onClick={() => void load()}
            disabled={refreshing}
            className="mc-secondary-button shrink-0 gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Checking…' : 'Refresh'}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs text-white/60">
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
            {connectedCount} / {connections.length} agents connected
          </span>
          {status?.checked_at && (
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
              checked {new Date(status.checked_at).toLocaleTimeString()}
            </span>
          )}
        </div>
      </section>

      {err && <div className="mc-alert">{err}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {connections.map((c) => {
          const meta = AGENT_META[c.name] || { icon: Cable, blurb: 'Agent runtime.' };
          const Icon = meta.icon;
          const connected = c.connected === true;
          return (
            <div key={c.name} className={`rounded-3xl border p-4 sm:p-5 transition ${connected ? 'border-emerald-400/20 bg-emerald-400/[0.04]' : 'border-red-400/20 bg-red-400/[0.03]'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`rounded-2xl border p-2.5 ${connected ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200' : 'border-red-400/25 bg-red-400/10 text-red-200'}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{c.name}</span>
                      {c.mode === 'http' && <Cloud className="h-3.5 w-3.5 text-white/30" />}
                      {c.mode === 'cli' && <Server className="h-3.5 w-3.5 text-white/30" />}
                    </div>
                    <p className="mt-0.5 text-xs text-white/45">{meta.blurb}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                  connected ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100' : 'border-red-400/25 bg-red-400/10 text-red-100'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                  {connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="mt-4 rounded-2xl border border-white/5 bg-black/20 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-white/35">
                  {c.mode === 'http' ? `Probe ${c.url}` : c.cli ? `Probe ${c.cli}` : 'Probe'}
                </div>
                <div className="mt-1 text-xs text-white/65 break-words line-clamp-3 font-mono">
                  {c.detail || (connected ? 'Responded OK.' : 'No response captured.')}
                </div>
              </div>
            </div>
          );
        })}

        {status?.gateway && (
          <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.04] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-2.5 text-emerald-200">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold">{status.gateway.name}</div>
                  <p className="mt-0.5 text-xs text-white/45">This dashboard's backend service.</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-100">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Connected
              </span>
            </div>
            <div className="mt-4 rounded-2xl border border-white/5 bg-black/20 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-white/35">Probe</div>
              <div className="mt-1 text-xs text-white/65 break-words font-mono">{status.gateway.detail || 'API live.'}</div>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-white/35">
        Connection probes use environment URLs (<code className="text-white/55">OPENCLAW_URL</code>, <code className="text-white/55">HERMES_URL</code>, <code className="text-white/55">CODEX_URL</code>) when configured, otherwise they fall back to checking the local CLI binaries.
      </p>
    </div>
  );
}

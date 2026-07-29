import { useEffect, useState } from 'react';
import { ShellCard } from '../../components/ShellCard';
import { fetchJson } from '../../lib/api';

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function OpenClawControlPage() {
  const [statusText, setStatusText] = useState('Loading...');
  const [configText, setConfigText] = useState('Loading...');
  const [configData, setConfigData] = useState<any>(null);

  useEffect(() => {
    fetchJson('/api/openclaw/status')
      .then((data) => setStatusText(formatJson(data)))
      .catch((err) => setStatusText(`Failed to load status: ${String(err)}`));

    fetchJson('/api/openclaw/config')
      .then((data) => {
        setConfigData(data);
        setConfigText(formatJson(data));
      })
      .catch((err) => setConfigText(`Failed to load config: ${String(err)}`));
  }, []);

  const primaryModel = configData?.agents?.defaults?.model?.primary || '—';
  const modelFallbacks = Array.isArray(configData?.agents?.defaults?.model?.fallbacks)
    ? configData.agents.defaults.model.fallbacks
    : [];
  const agentRows = Array.isArray(configData?.agents?.list) ? configData.agents.list : [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <ShellCard
        title="OpenClaw Control"
        subtitle="Mission Control for agent routing, model config, and runtime health"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs text-white/55">Primary model</div>
            <div className="mt-2 text-lg font-bold break-words">{primaryModel}</div>
            <div className="mt-1 text-xs text-white/45">Current default in OpenClaw config</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs text-white/55">Fallbacks</div>
            <div className="mt-2 text-lg font-bold">{modelFallbacks.length}</div>
            <div className="mt-1 text-xs text-white/45">{modelFallbacks.join(' • ') || 'None'}</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs text-white/55">Dreaming</div>
            <div className="mt-2 text-lg font-bold">{String(configData?.dreaming?.enabled ? 'On' : 'Off')}</div>
            <div className="mt-1 text-xs text-white/45">Experimental, not enabled</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs text-white/55">Agents</div>
            <div className="mt-2 text-lg font-bold">{agentRows.length}</div>
            <div className="mt-1 text-xs text-white/45">Configured agent list</div>
          </div>
        </div>
      </ShellCard>

      <ShellCard title="Configured agents" subtitle="Current agent/model mapping pulled from live OpenClaw config">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {agentRows.map((agent: any) => (
            <div key={agent.id || agent.name} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-semibold">{agent.name || agent.id}</div>
              <div className="mt-1 text-xs text-white/50">id: {agent.id || '—'}</div>
              <div className="mt-1 text-xs text-white/50 break-words">model: {agent.model || '—'}</div>
              <div className="mt-1 text-xs text-white/50 break-words">workspace: {agent.workspace || '—'}</div>
            </div>
          ))}
        </div>
      </ShellCard>

      <ShellCard title="Runtime status" subtitle="Live OpenClaw status snapshot via Mission Control API">
        <pre className="overflow-x-auto text-xs text-white/80 whitespace-pre-wrap">{statusText}</pre>
      </ShellCard>

      <ShellCard title="Agent config" subtitle="Current orchestration-relevant model config">
        <pre className="overflow-x-auto text-xs text-white/80 whitespace-pre-wrap">{configText}</pre>
      </ShellCard>

      <ShellCard title="Next controls to add" subtitle="Planned operator actions">
        <ul className="list-disc pl-5 space-y-1 text-sm text-white/75">
          <li>Model routing editor for main and subagents</li>
          <li>Active session list and session kill / steer actions</li>
          <li>Cron jobs and dreaming status/actions</li>
          <li>Gateway health and restart controls</li>
          <li>Task retry / cancel for orchestration flows</li>
        </ul>
      </ShellCard>
    </div>
  );
}

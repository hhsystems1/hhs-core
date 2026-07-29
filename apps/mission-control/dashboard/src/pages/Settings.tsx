import { useEffect, useState } from 'react';
import { ShellCard } from '../components/ShellCard';
import { fetchJson } from '../lib/api';

type ModelInfo = {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
};

function Row(props: { label: string; value: string | number | boolean | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 py-3 last:border-0">
      <span className="text-sm text-white/55">{props.label}</span>
      <span className="text-right text-sm font-semibold break-words">{props.value == null || props.value === '' ? '—' : String(props.value)}</span>
    </div>
  );
}

export default function Settings() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [agentConfig, setAgentConfig] = useState<any>(null);
  const [openClaw, setOpenClaw] = useState<any>(null);
  const [twilio, setTwilio] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    try {
      const [modelResult, agentResult, openClawResult, twilioResult] = await Promise.all([
        fetchJson<{ models: ModelInfo[] }>('/api/models'),
        fetchJson('/api/agents/config'),
        fetchJson('/api/openclaw/config'),
        fetchJson('/api/twilio/status'),
      ]);
      setModels(modelResult.models || []);
      setAgentConfig(agentResult);
      setOpenClaw(openClawResult);
      setTwilio(twilioResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const providers = Array.from(new Set(models.map((model) => model.provider))).sort();

  return (
    <div className="space-y-4 sm:space-y-6">
      <ShellCard title="Settings" subtitle="Runtime, model, and integration status" right={<button onClick={refresh} className="mc-secondary-button">Refresh</button>}>
        {error && <div className="mc-alert">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/45">Models</div>
            <div className="mt-1 text-2xl font-bold">{models.length}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/45">Providers</div>
            <div className="mt-1 text-2xl font-bold">{providers.length}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/45">Twilio</div>
            <div className="mt-1 text-2xl font-bold">{twilio?.configured ? 'Ready' : 'Off'}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/45">OpenClaw</div>
            <div className="mt-1 text-2xl font-bold">{openClaw?.ok === false ? 'Check' : 'Loaded'}</div>
          </div>
        </div>
      </ShellCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        <ShellCard title="Agent Defaults" subtitle="Current Mission Control model routing">
          <Row label="Main model" value={agentConfig?.main?.model} />
          <Row label="Main fallbacks" value={(agentConfig?.main?.fallbacks || []).join(', ')} />
          <Row label="Subagent model" value={agentConfig?.subagents?.model} />
          <Row label="Subagent fallbacks" value={(agentConfig?.subagents?.fallbacks || []).join(', ')} />
        </ShellCard>

        <ShellCard title="Twilio" subtitle="Phone integration status">
          <Row label="Configured" value={twilio?.configured ? 'yes' : 'no'} />
          <Row label="Phone number" value={twilio?.phoneNumber} />
          <Row label="Account SID set" value={twilio?.accountSidSet ? 'yes' : 'no'} />
          <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/10 p-4 text-sm text-emerald-100">
            Customer-facing SMS remains blocked from direct send. Use CRM draft tasks and review approval.
          </div>
        </ShellCard>
      </div>

      <ShellCard title="Available Models" subtitle="Pulled from OpenClaw config">
        <div className="overflow-auto rounded-2xl border border-white/10 bg-black/20">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="text-xs text-white/50">
              <tr className="border-b border-white/10">
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Context</th>
                <th className="px-4 py-3">Reasoning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {models.map((model) => (
                <tr key={model.id}>
                  <td className="px-4 py-3 font-semibold">{model.name || model.id}</td>
                  <td className="px-4 py-3 text-white/65">{model.provider}</td>
                  <td className="px-4 py-3 text-white/65">{model.contextWindow || '—'}</td>
                  <td className="px-4 py-3 text-white/65">{model.reasoning ? 'yes' : 'no'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ShellCard>
    </div>
  );
}

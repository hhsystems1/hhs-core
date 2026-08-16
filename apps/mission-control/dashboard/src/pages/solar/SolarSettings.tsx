import { useEffect, useState } from 'react';
import { ShellCard } from '../../components/ShellCard';
import { fetchJson } from '../../lib/api';

function StatusPill(props: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${props.ok ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100' : 'border-white/10 bg-white/5 text-white/60'}`}>
      {props.label}
    </span>
  );
}

type TwilioStatusResponse = {
  configured?: boolean;
  phoneNumber?: string;
  accountSidSet?: boolean;
};

export default function SolarSettings() {
  const [leadStatus, setLeadStatus] = useState<'checking' | 'ready' | 'error'>('checking');
  const [twilio, setTwilio] = useState<TwilioStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLeadStatus('checking');
    setError(null);
    try {
      const [leads, twilioStatus] = await Promise.all([
        fetchJson<{ ok: boolean; leads: unknown[] }>('/api/solar/leads?limit=1'),
        fetchJson<TwilioStatusResponse>('/api/twilio/status'),
      ]);
      setLeadStatus(leads.ok ? 'ready' : 'error');
      setTwilio(twilioStatus);
    } catch (e) {
      setLeadStatus('error');
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchJson<{ ok: boolean; leads: unknown[] }>('/api/solar/leads?limit=1'),
      fetchJson<TwilioStatusResponse>('/api/twilio/status'),
    ])
      .then(([leads, twilioStatus]) => {
        if (cancelled) return;
        setLeadStatus(leads.ok ? 'ready' : 'error');
        setTwilio(twilioStatus);
      })
      .catch((e) => {
        if (!cancelled) {
          setLeadStatus('error');
          setError(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6">
      <ShellCard title="Solar • Settings" subtitle="Workspace health and operational guardrails" right={<button onClick={refresh} className="mc-secondary-button">Refresh</button>}>
        {error && <div className="mc-alert">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/45">Lead API</div>
            <div className="mt-3"><StatusPill ok={leadStatus === 'ready'} label={leadStatus} /></div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/45">Twilio</div>
            <div className="mt-3"><StatusPill ok={Boolean(twilio?.configured)} label={twilio?.configured ? 'connected' : 'not ready'} /></div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/45">Outbound Policy</div>
            <div className="mt-3"><StatusPill ok label="review gated" /></div>
          </div>
        </div>
      </ShellCard>

      <ShellCard title="Lead Inbox Contract" subtitle="Status fields currently used by the UI">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-white/65">
          {['bill_status', 'contact_status', 'appointment_status', 'next_action'].map((field) => (
            <div key={field} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="font-semibold text-white">{field}</div>
              <div className="mt-1 text-xs text-white/45">Provided by /api/solar/leads from CRM contact metadata and latest CRM task.</div>
            </div>
          ))}
        </div>
      </ShellCard>
    </div>
  );
}

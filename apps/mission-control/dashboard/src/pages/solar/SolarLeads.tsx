import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShellCard } from '../../components/ShellCard';
import { fetchJson } from '../../lib/api';

type LeadInboxRow = {
  id: string;
  name: string;
  source: string;
  bill_status: 'missing' | 'received' | 'verified' | 'unknown';
  contact_status: 'new' | 'contacted' | 'unresponsive' | 'closed' | 'unknown';
  appointment_status: 'not_set' | 'scheduled' | 'completed' | 'no_show' | 'unknown';
  next_action: string;
};

type LeadInboxResponse = {
  ok: boolean;
  leads: LeadInboxRow[];
  error?: string;
};

type BadgeTone = 'green' | 'yellow' | 'red' | 'gray';

function Badge(props: { tone: BadgeTone; text: string }) {
  const tone =
    props.tone === 'green'
      ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/20'
      : props.tone === 'yellow'
        ? 'bg-yellow-500/15 text-yellow-100 border-yellow-500/20'
        : props.tone === 'red'
          ? 'bg-red-500/15 text-red-100 border-red-500/20'
          : 'bg-white/10 text-white/70 border-white/10';
  return <span className={`inline-flex items-center rounded-xl border px-2.5 py-1 text-xs font-semibold ${tone}`}>{props.text}</span>;
}

function billTone(s: LeadInboxRow['bill_status']): BadgeTone {
  if (s === 'received' || s === 'verified') return 'green';
  if (s === 'missing') return 'red';
  if (s === 'unknown') return 'gray';
  return 'gray';
}

export default function SolarLeads() {
  const [data, setData] = useState<LeadInboxResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      setData(await fetchJson<LeadInboxResponse>('/api/solar/leads'));
    } catch (e) {
      setData({ ok: false, leads: [], error: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetchJson<LeadInboxResponse>('/api/solar/leads')
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e) => {
        if (!cancelled) setData({ ok: false, leads: [], error: e instanceof Error ? e.message : String(e) });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6">
      <ShellCard
        title="Solar • Lead Inbox"
        subtitle="First operational business page. Real leads only."
        right={
          <button
            onClick={refresh}
            className="rounded-2xl px-4 py-2 text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 transition"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        }
      >
        {data?.ok !== true && (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
            <div className="font-semibold">Lead inbox unavailable.</div>
            <div className="mt-2 text-xs text-white/50">The CRM-backed endpoint did not return lead data. No fake leads are shown.</div>
            {data?.error && <div className="mt-2 text-xs text-white/50">error: {data.error}</div>}
          </div>
        )}

        <div className="mt-4 overflow-auto rounded-2xl border border-white/10 bg-black/20">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="text-xs text-white/60">
              <tr className="border-b border-white/10">
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Bill</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Appointment</th>
                <th className="px-4 py-3">Next action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {(data?.leads || []).map((l) => (
                <tr key={l.id} className="hover:bg-white/5 transition">
                  <td className="px-4 py-3 font-semibold">
                    <Link className="hover:underline" to={`/solar/leads/${encodeURIComponent(l.id)}`}>
                      {l.name}
                    </Link>
                    <div className="mt-1 text-xs text-white/45">id: {l.id}</div>
                  </td>
                  <td className="px-4 py-3 text-white/80">{l.source}</td>
                  <td className="px-4 py-3">
                    <Badge tone={billTone(l.bill_status)} text={l.bill_status} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="gray" text={l.contact_status} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="gray" text={l.appointment_status} />
                  </td>
                  <td className="px-4 py-3 text-white/80">{l.next_action}</td>
                </tr>
              ))}
              {(data?.leads || []).length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-white/55" colSpan={6}>
                    Empty.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ShellCard>

      <ShellCard title="Lead Inbox data contract" subtitle="Current API contract">
        <pre className="text-xs text-white/70 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/20 p-4">
{`GET /api/solar/leads -> 200
{
  "ok": true,
  "leads": [
    {
      "id": "string",
      "name": "string",
      "source": "string",
      "bill_status": "missing|received|verified|unknown",
      "contact_status": "new|contacted|unresponsive|closed|unknown",
      "appointment_status": "not_set|scheduled|completed|no_show|unknown",
      "next_action": "string"
    }
  ]
}`}</pre>
        <div className="mt-3 text-xs text-white/45">
          Links:
          <div>- Row click → <span className="text-white/70">/solar/leads/:id</span></div>
          <div>- Jeremy view: sees inbox, statuses, and next action only (no fake analytics).</div>
        </div>
      </ShellCard>
    </div>
  );
}

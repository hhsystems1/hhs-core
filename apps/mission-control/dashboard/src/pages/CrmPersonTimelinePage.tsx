import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ShellCard } from '../components/ShellCard';
import { fetchJson, formatWhen } from '../lib/api';

type CrmPerson = {
  id: string;
  full_name: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  lifecycle_stage: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  crm_contact?: {
    id: string;
    account_id: string | null;
    status: string | null;
    account_name: string | null;
  } | null;
};

type TimelineItem = {
  id: string;
  item_type: string;
  event_type: string | null;
  event_level: string | null;
  occurred_at: string | null;
  source_channel: string | null;
  source_link_id: string | null;
  title: string | null;
  description: string | null;
  payload: Record<string, unknown> | null;
};

function Pill(props: { children: string | number | null | undefined; tone?: 'green' | 'blue' | 'amber' | 'gray' }) {
  const tone = props.tone || 'gray';
  const classes = {
    green: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100',
    blue: 'border-sky-400/25 bg-sky-400/10 text-sky-100',
    amber: 'border-amber-400/25 bg-amber-400/10 text-amber-100',
    gray: 'border-white/10 bg-white/5 text-white/65',
  }[tone];
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${classes}`}>{props.children || 'unknown'}</span>;
}

function DetailRow(props: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs text-white/45">{props.label}</div>
      <div className="mt-1 break-words text-sm font-medium text-white/85">{props.value || '—'}</div>
    </div>
  );
}

export default function CrmPersonTimelinePage() {
  const { personId } = useParams();
  const [person, setPerson] = useState<CrmPerson | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftStatus, setDraftStatus] = useState<string | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);

  useEffect(() => {
    if (!personId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchJson<{ person: CrmPerson }>(`/api/v1/crm/people/${personId}`),
      fetchJson<{ timeline: TimelineItem[] }>(`/api/v1/crm/people/${personId}/timeline?limit=50`),
    ])
      .then(([personResult, timelineResult]) => {
        if (cancelled) return;
        setPerson(personResult.person || null);
        setTimeline(timelineResult.timeline || []);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [personId]);

  const nextStep = useMemo(() => {
    if (!person) return 'Load the profile before drafting next steps.';
    if (!timeline.length) return 'Review source data and create a follow-up task after human approval.';
    const latest = timeline[0]?.event_type || timeline[0]?.title || 'latest event';
    return `Review ${latest}, then decide whether to create a follow-up task.`;
  }, [person, timeline]);

  useEffect(() => {
    if (person && !draftTitle) setDraftTitle(`Follow up with ${person.full_name || 'CRM contact'}`);
  }, [person, draftTitle]);

  const createDraftTask = async () => {
    if (!personId || !draftTitle.trim()) return;
    setCreatingTask(true);
    setDraftStatus(null);
    setError(null);
    try {
      await fetchJson(`/api/v1/crm/people/${personId}/tasks/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draftTitle.trim(),
          description: nextStep,
          priority: 'normal',
        }),
      });
      setDraftStatus('Draft task queued for approval.');
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setCreatingTask(false);
    }
  };

  if (loading) {
    return <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/55">Loading CRM profile…</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link to="/crm" className="text-sm font-semibold text-sky-200 hover:text-sky-100">
          ← CRM / Entities
        </Link>
        <Pill tone="green">Read-only profile</Pill>
      </div>

      {error && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">{error}</div>}

      <ShellCard
        title={person?.full_name || 'CRM Person'}
        subtitle="Profile + timeline for source-to-outcome traceability. Actions remain draft/approval-gated."
        right={<Pill tone="blue">{person?.lifecycle_stage}</Pill>}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <DetailRow label="Primary email" value={person?.primary_email} />
          <DetailRow label="Primary phone" value={person?.primary_phone} />
          <DetailRow label="CRM contact" value={person?.crm_contact?.id} />
          <DetailRow label="Account" value={person?.crm_contact?.account_name} />
        </div>
        {person?.notes && <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">{person.notes}</div>}
      </ShellCard>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        <div className="xl:col-span-2">
          <ShellCard title="Timeline" subtitle="Existing events normalized into a CRM timeline">
            <div className="space-y-3">
              {timeline.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/45">No timeline events yet.</div>
              ) : (
                timeline.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{item.title || item.event_type || 'event'}</div>
                        <div className="mt-1 text-xs text-white/45">{formatWhen(item.occurred_at)}</div>
                      </div>
                      <Pill tone="amber">{item.source_channel || item.event_level || item.item_type}</Pill>
                    </div>
                    {item.description && <div className="mt-3 text-sm text-white/70">{item.description}</div>}
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/40">
                      <span>ID {item.id}</span>
                      {item.source_link_id && <span>Source {item.source_link_id}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ShellCard>
        </div>

        <ShellCard title="Sidekick draft actions" subtitle="Prepared prompts only. Nothing is sent or executed from here.">
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs font-semibold tracking-wide text-white/50">Recommended next step</div>
              <div className="mt-2 text-sm text-white/75">{nextStep}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs font-semibold tracking-wide text-white/50">Draft task prompt</div>
              <div className="mt-2 text-sm text-white/75">
                Create an internal follow-up task for {person?.full_name || 'this person'} based on the latest CRM timeline. Keep it internal and ask before sending any message.
              </div>
              <div className="mt-3 space-y-2">
                <input
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-300/50"
                  placeholder="Internal task title"
                />
                <button
                  onClick={createDraftTask}
                  disabled={creatingTask || !draftTitle.trim()}
                  className="rounded-full border border-sky-400/25 bg-sky-400/10 px-4 py-2 text-xs font-semibold text-sky-100 disabled:opacity-50"
                >
                  {creatingTask ? 'Queuing…' : 'Queue internal draft task'}
                </button>
                {draftStatus && (
                  <div className="text-xs text-emerald-100">
                    {draftStatus} <Link className="text-sky-200 hover:text-sky-100" to="/crm/tasks?review_status=queued">Open queue →</Link>
                  </div>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
              Open the global Sidekick panel from the top-right button; it now carries this CRM route and record ID as context.
            </div>
          </div>
        </ShellCard>
      </div>
    </div>
  );
}

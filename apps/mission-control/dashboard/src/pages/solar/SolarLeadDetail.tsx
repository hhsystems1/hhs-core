import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ShellCard } from '../../components/ShellCard';
import { fetchJson, formatWhen } from '../../lib/api';

type LeadPerson = {
  id: string;
  full_name: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  lifecycle_stage: string | null;
  notes?: string | null;
  crm_contact?: {
    id: string;
    account_name?: string | null;
    status?: string | null;
  } | null;
};

type TimelineItem = {
  id: string;
  title: string | null;
  event_type: string | null;
  description: string | null;
  occurred_at: string | null;
  source_channel: string | null;
  payload?: Record<string, unknown>;
};

function Detail(props: { label: string; value?: string | null }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs text-white/45">{props.label}</div>
      <div className="mt-1 text-sm font-semibold break-words">{props.value || '—'}</div>
    </div>
  );
}

export default function SolarLeadDetail() {
  const { leadId } = useParams();
  const [person, setPerson] = useState<LeadPerson | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftStatus, setDraftStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!leadId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchJson<{ person: LeadPerson }>(`/api/v1/crm/people/${encodeURIComponent(leadId)}`),
      fetchJson<{ timeline: TimelineItem[] }>(`/api/v1/crm/people/${encodeURIComponent(leadId)}/timeline?limit=50`),
    ])
      .then(([personResult, timelineResult]) => {
        if (cancelled) return;
        setPerson(personResult.person);
        setTimeline(timelineResult.timeline || []);
        setDraftTitle(`Follow up with ${personResult.person?.full_name || 'solar lead'}`);
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
  }, [leadId]);

  async function createTask() {
    if (!leadId || !draftTitle.trim()) return;
    setDraftStatus('Creating draft task...');
    try {
      await fetchJson(`/api/v1/crm/people/${encodeURIComponent(leadId)}/tasks/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draftTitle.trim(),
          description: 'Solar lead follow-up drafted from Mission Control lead detail.',
          priority: 'normal',
        }),
      });
      setDraftStatus('Draft task queued for CRM review.');
    } catch (e) {
      setDraftStatus(e instanceof Error ? e.message : String(e));
    }
  }

  if (loading) {
    return <ShellCard title="Solar Lead" subtitle="Loading"><div className="text-sm text-white/55">Loading lead...</div></ShellCard>;
  }

  if (error || !person) {
    return (
      <ShellCard title="Solar Lead" subtitle="Unable to load">
        <div className="mc-alert">{error || 'Lead not found'}</div>
      </ShellCard>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <ShellCard
        title={person.full_name || 'Unnamed solar lead'}
        subtitle="CRM-backed lead profile"
        right={<Link className="mc-secondary-button" to={`/crm/people/${person.id}/timeline`}>CRM timeline</Link>}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <Detail label="Email" value={person.primary_email} />
          <Detail label="Phone" value={person.primary_phone} />
          <Detail label="Stage" value={person.lifecycle_stage} />
          <Detail label="Account" value={person.crm_contact?.account_name} />
        </div>
        {person.notes && <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">{person.notes}</div>}
      </ShellCard>

      <ShellCard title="Next Action" subtitle="Creates an internal, review-gated CRM task">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} className="mc-input flex-1" />
          <button onClick={createTask} className="mc-primary-button">Queue task</button>
        </div>
        {draftStatus && <div className="mt-3 text-sm text-white/65">{draftStatus}</div>}
      </ShellCard>

      <ShellCard title="Lead Timeline" subtitle="Recent CRM events">
        <div className="space-y-2">
          {timeline.length === 0 ? (
            <div className="mc-empty-state">No timeline events yet.</div>
          ) : (
            timeline.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{item.title || item.event_type || 'Event'}</div>
                    <div className="mt-1 text-xs text-white/45">{item.source_channel || 'mission-control'}</div>
                  </div>
                  <div className="text-xs text-white/45">{formatWhen(item.occurred_at)}</div>
                </div>
                {item.description && <div className="mt-3 text-sm text-white/65">{item.description}</div>}
              </div>
            ))
          )}
        </div>
      </ShellCard>
    </div>
  );
}

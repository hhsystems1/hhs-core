import { useEffect, useMemo, useState } from 'react';
import { Inbox, Link2, MessagesSquare, RefreshCw } from 'lucide-react';
import DemoCard from '@hhs/shared-ui'DemoCard';
import DataTable from '@hhs/shared-ui'DataTable';
import KpiCard from '@hhs/shared-ui'KpiCard';
import { GhostButton } from '@hhs/shared-ui'StatusBadge';
import { fetchFormSubmissions } from '../../lib/queries';
import type { FormSubmission } from '../../types';

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
}

function shorten(value: string | undefined): string {
  if (!value) return '—';
  return value.length > 32 ? `${value.slice(0, 32)}…` : value;
}

export default function FormSubmissionInbox() {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FormSubmission | null>(null);

  const refreshSubmissions = async () => {
    setLoading(true);
    fetchFormSubmissions()
      .then((rows) => {
        setSubmissions(rows);
        setSelected((current) => current ?? rows[0] ?? null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    fetchFormSubmissions()
      .then((rows) => {
        if (cancelled) return;
        setSubmissions(rows);
        setSelected(rows[0] ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = useMemo(() => {
    const linkedLeads = submissions.filter((item) => item.lead_id).length;
    return {
      linkedLeads,
      recent: submissions.slice(0, 5).length,
    };
  }, [submissions]);

  const columns = [
    { key: 'form_name', label: 'Form' },
    { key: 'source_url', label: 'Source' },
    { key: 'lead_id', label: 'Lead' },
    { key: 'created_at', label: 'Received' },
  ];

  const rows = submissions.map((submission) => ({
    form_name: submission.form_name,
    source_url: shorten(submission.source_url),
    lead_id: submission.lead_id ? submission.lead_id.slice(0, 8) : 'Unlinked',
    created_at: formatDate(submission.created_at),
  }));

  return (
    <DemoCard number={10} title="Form Intake Queue" className="xl:col-span-2">
      {loading ? (
        <div className="py-4 text-center text-[11px] text-fusion-text-muted">Loading...</div>
      ) : error ? (
        <div className="py-4 text-center text-[11px] text-red-400">{error}</div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <KpiCard label="Total Submissions" value={String(submissions.length)} icon={<Inbox size={12} />} />
            <KpiCard label="Linked Leads" value={String(metrics.linkedLeads)} icon={<Link2 size={12} />} />
            <KpiCard label="Recent Pull" value={String(metrics.recent)} icon={<MessagesSquare size={12} />} />
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg border border-fusion-border-light bg-fusion-card-soft px-3 py-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-fusion-text-muted">
                Intake queue
              </p>
              <p className="text-[11px] text-fusion-text">
                Website forms land here before the AI agent routes them to the right main or sub-account.
              </p>
            </div>
            <GhostButton onClick={() => void refreshSubmissions()}>
              Refresh
              <RefreshCw size={12} />
            </GhostButton>
          </div>

          <div>
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-fusion-text-muted">
              Recent submissions
            </span>
            {rows.length > 0 ? (
              <DataTable
                columns={columns}
                rows={rows}
                onRowClick={(_, index) => setSelected(submissions[index])}
              />
            ) : (
              <div className="py-2 text-[11px] text-fusion-text-muted">No submissions yet</div>
            )}
          </div>

          {selected && (
            <div className="rounded-lg border border-fusion-border-light bg-fusion-card-soft p-3">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-fusion-text-muted">
                Selected submission
              </span>
              <div className="grid gap-2 text-[11px] text-fusion-text sm:grid-cols-2">
                <div><span className="font-semibold">Form:</span> {selected.form_name}</div>
                <div><span className="font-semibold">Received:</span> {formatDate(selected.created_at)}</div>
                <div className="sm:col-span-2"><span className="font-semibold">Source URL:</span> {selected.source_url ?? '—'}</div>
                <div className="sm:col-span-2"><span className="font-semibold">Lead ID:</span> {selected.lead_id ?? 'Unlinked'}</div>
              </div>
              <pre className="mt-3 max-h-40 overflow-auto rounded-md bg-[#0b1220] p-3 text-[10px] leading-5 text-slate-200">
{JSON.stringify(selected.form_data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </DemoCard>
  );
}

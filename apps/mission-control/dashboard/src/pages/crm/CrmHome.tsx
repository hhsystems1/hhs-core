import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ShellCard } from '../../components/ShellCard';
import { useCrm } from './CrmContext';

function Pill(props: { children: string | number | null | undefined; tone?: 'green' | 'blue' | 'amber' | 'red' | 'gray' }) {
  const tone = props.tone || 'gray';
  const classes = {
    green: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100',
    blue: 'border-sky-400/25 bg-sky-400/10 text-sky-100',
    amber: 'border-amber-400/25 bg-amber-400/10 text-amber-100',
    red: 'border-red-400/25 bg-red-400/10 text-red-100',
    gray: 'border-white/10 bg-white/5 text-white/65',
  }[tone];
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${classes}`}>{props.children || 'unknown'}</span>;
}

export default function CrmHome() {
  const crm = useCrm();

  const totals = useMemo(() => [
    { label: 'People', value: crm.people.length, detail: 'Compatibility people records' },
    { label: 'Accounts', value: crm.accounts.length, detail: 'CRM organizations' },
    { label: 'Contacts', value: crm.contacts.length, detail: 'Customer-facing contacts' },
    { label: 'Deals', value: crm.opportunities.length, detail: 'Pipeline opportunities' },
    { label: 'Safety', value: 'Approval gated', detail: 'Outbound work falls back to internal task review' },
  ], [crm.people.length, crm.accounts.length, crm.contacts.length, crm.opportunities.length]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <ShellCard title="CRM" subtitle="Customers, pipeline, communications, and approval-gated next steps." right={<Pill tone="green">Comprehensive CRM</Pill>}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {totals.map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs text-white/50">{item.label}</div>
              <div className="mt-2 text-2xl font-bold">{item.value}</div>
              <div className="mt-1 text-xs text-white/40">{item.detail}</div>
            </div>
          ))}
        </div>
        {crm.error && <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">{crm.error}</div>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={() => crm.openCreate('contact')} className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-400/20">+ New Contact</button>
          <button onClick={() => crm.openCreate('account')} className="rounded-full border border-purple-400/25 bg-purple-400/10 px-3 py-1.5 text-xs font-semibold text-purple-100 hover:bg-purple-400/20">+ New Account</button>
          <button onClick={() => crm.openCreate('opportunity')} className="rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-400/20">+ New Deal</button>
          <button onClick={() => crm.openCreate('task')} className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-400/20">+ New Task</button>
          <Link className="text-sm font-semibold text-sky-200 hover:text-sky-100" to="/crm/tasks">Open CRM task list</Link>
        </div>
      </ShellCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        <ShellCard title="Where to start" subtitle="The operational surfaces inside CRM.">
          <div className="grid gap-3 sm:grid-cols-2">
            <button onClick={() => crm.openCreate('opportunity')} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-left hover:border-sky-400/30 hover:bg-sky-400/5 transition">
              <div className="text-sm font-semibold">Opportunities</div>
              <div className="mt-1 text-xs text-white/55">Move deals through the pipeline board.</div>
            </button>
            <button onClick={() => crm.openCreate('contact')} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-left hover:border-emerald-400/30 hover:bg-emerald-400/5 transition">
              <div className="text-sm font-semibold">Customers</div>
              <div className="mt-1 text-xs text-white/55">People, contacts, and accounts.</div>
            </button>
            <Link to="/crm/feed" className="rounded-2xl border border-white/10 bg-black/20 p-4 text-left hover:border-sky-400/30 hover:bg-sky-400/5 transition">
              <div className="text-sm font-semibold">Feed</div>
              <div className="mt-1 text-xs text-white/55">Inbound and outbound communication threads.</div>
            </Link>
            <Link to="/crm/tasks" className="rounded-2xl border border-white/10 bg-black/20 p-4 text-left hover:border-amber-400/30 hover:bg-amber-400/5 transition">
              <div className="text-sm font-semibold">Tasks</div>
              <div className="mt-1 text-xs text-white/55">Review-gated internal work queue.</div>
            </Link>
          </div>
        </ShellCard>

        <ShellCard title="Safety posture" subtitle="How customer-facing work stays controlled.">
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-semibold">Approval-gated outbound</div>
              <p className="mt-1 text-sm text-white/60">
                SMS, email, calls, and appointments start as internal draft tasks. Nothing is sent or executed without a human review decision.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-semibold">Tenant scoped</div>
              <p className="mt-1 text-sm text-white/60">
                Every CRM entity is bound to the active tenant. A future customer portal can reuse the same module without exposing internal tooling.
              </p>
            </div>
          </div>
        </ShellCard>
      </div>
    </div>
  );
}

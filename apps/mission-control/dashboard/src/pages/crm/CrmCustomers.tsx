import { useState } from 'react';
import { ShellCard } from '../../components/ShellCard';
import { formatWhen } from '../../lib/api';
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

function LoadingRow({ label }: { label: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">Loading {label}...</div>;
}
function EmptyRow({ label }: { label: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/45">No {label} yet.</div>;
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  return values.find((v) => v && v.trim()) || null;
}

export default function CrmCustomers() {
  const crm = useCrm();
  const [search, setSearch] = useState('');

  const { people, contacts, accounts, loading, openPerson, openDetail, openCreate } = crm;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Customers</div>
          <div className="mt-1 text-xs text-white/55">People, contacts, and accounts in the CRM.</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => openCreate('contact')} className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-400/20">+ New Contact</button>
          <button onClick={() => openCreate('account')} className="rounded-full border border-purple-400/25 bg-purple-400/10 px-3 py-1.5 text-xs font-semibold text-purple-100 hover:bg-purple-400/20">+ New Account</button>
        </div>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search people, contacts, and accounts..."
        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white outline-none focus:border-sky-300/50"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ShellCard title="People" subtitle="Profile records with timeline links." right={<span className="text-xs text-white/40">{people.length} total</span>}>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {loading ? (
              <LoadingRow label="people" />
            ) : people.length === 0 ? (
              <EmptyRow label="people" />
            ) : (
              people
                .filter((p) => !search || (p.full_name || '').toLowerCase().includes(search.toLowerCase()) || (p.primary_email || '').toLowerCase().includes(search.toLowerCase()))
                .map((person) => (
                  <button key={person.id} onClick={() => openPerson(person.id, person.full_name || 'Person')}
                    className="w-full text-left rounded-2xl border border-white/10 bg-black/20 p-4 hover:border-sky-400/30 hover:bg-sky-400/5 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{person.full_name || 'Unnamed person'}</div>
                        <div className="mt-0.5 text-xs text-white/45 break-all">{firstNonEmpty(person.primary_email, person.primary_phone) || 'No primary contact'}</div>
                        {person.primary_email && person.primary_phone && <div className="text-xs text-white/35 break-all">{person.primary_phone}</div>}
                      </div>
                      <Pill tone="blue">{person.lifecycle_stage}</Pill>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/40">
                      <span>Updated {formatWhen(person.updated_at)}</span>
                    </div>
                  </button>
                ))
            )}
          </div>
        </ShellCard>

        <ShellCard title="Contacts" subtitle="Canonical CRM contacts." right={<span className="text-xs text-white/40">{contacts.length} total</span>}>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {loading ? (
              <LoadingRow label="contacts" />
            ) : contacts.length === 0 ? (
              <EmptyRow label="contacts" />
            ) : (
              contacts
                .filter((c) => !search || (c.full_name || '').toLowerCase().includes(search.toLowerCase()) || (c.primary_email || '').toLowerCase().includes(search.toLowerCase()))
                .map((contact) => (
                  <button key={contact.id} onClick={() => openPerson(contact.source_person_id || contact.id, contact.full_name || 'Contact')}
                    className="w-full text-left rounded-2xl border border-white/10 bg-black/20 p-4 hover:border-sky-400/30 hover:bg-sky-400/5 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{contact.full_name || 'Unnamed contact'}</div>
                        <div className="mt-0.5 text-xs text-white/45 break-all">{firstNonEmpty(contact.primary_email, contact.primary_phone) || 'No primary contact'}</div>
                      </div>
                      <Pill tone={contact.status === 'active' ? 'green' : 'gray'}>{contact.status}</Pill>
                    </div>
                    <div className="mt-2 text-[10px] text-white/35">Stage: {contact.lifecycle_stage || 'unknown'} • Updated {formatWhen(contact.updated_at)}</div>
                  </button>
                ))
            )}
          </div>
        </ShellCard>
      </div>

      <ShellCard title="Accounts" subtitle="CRM organizations." right={<span className="text-xs text-white/40">{accounts.length} total</span>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {loading ? (
            <LoadingRow label="accounts" />
          ) : accounts.length === 0 ? (
            <EmptyRow label="accounts" />
          ) : (
            accounts
              .filter((a) => !search || (a.name || '').toLowerCase().includes(search.toLowerCase()) || (a.account_type || '').toLowerCase().includes(search.toLowerCase()))
              .map((account) => (
                <button key={account.id} onClick={() => openDetail({ type: 'account', id: account.id, label: account.name || 'Account' })}
                  className="w-full text-left rounded-2xl border border-white/10 bg-black/20 p-4 hover:border-sky-400/30 hover:bg-sky-400/5 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{account.name || 'Unnamed account'}</div>
                      <div className="mt-0.5 text-xs text-white/45">{account.account_type || 'No type'}</div>
                    </div>
                    <Pill tone={account.status === 'active' ? 'green' : 'gray'}>{account.status}</Pill>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/40">
                    <span>Stage: {account.lifecycle_stage || 'unknown'}</span>
                    <span>Updated {formatWhen(account.updated_at)}</span>
                  </div>
                </button>
              ))
          )}
        </div>
      </ShellCard>
    </div>
  );
}

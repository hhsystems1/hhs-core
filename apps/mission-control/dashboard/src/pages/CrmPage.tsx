import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShellCard } from '../components/ShellCard';
import { fetchJson, formatWhen } from '../lib/api';
import { useSocket } from '../lib/useSocket';
import CrmKanbanBoard from './crm/CrmKanbanBoard';
import CrmInboxTab from './crm/CrmInboxTab';
import CrmTasksTab from './crm/CrmTasksTab';
import RecordDetailPanel from './crm/RecordDetailPanel';
import CreateRecordModal from './crm/CreateRecordModal';
import CommandPalette from '../components/CommandPalette';
import QuickActionsBar from '../components/QuickActionsBar';

type CrmPerson = { id: string; full_name: string | null; primary_email: string | null; primary_phone: string | null; lifecycle_stage: string | null; updated_at: string | null };
type CrmAccount = { id: string; name: string | null; account_type: string | null; lifecycle_stage: string | null; status: string | null; updated_at: string | null };
type CrmContact = { id: string; source_person_id?: string | null; full_name: string | null; primary_email: string | null; primary_phone: string | null; lifecycle_stage: string | null; status: string | null; updated_at: string | null };
type CrmOpportunity = { id: string; name: string | null; pipeline: string | null; stage: string | null; status: string | null; estimated_value_cents: number | null; expected_close_date: string | null; account_name: string | null; contact_name: string | null; updated_at: string | null };

const TABS = [
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'people', label: 'People' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'inbox', label: 'Inbox' },
];

function Pill(props: { children: string | number | null | undefined; tone?: 'green' | 'blue' | 'amber' | 'red' | 'gray' }) {
  const tone = props.tone || 'gray';
  const classes = { green: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100', blue: 'border-sky-400/25 bg-sky-400/10 text-sky-100', amber: 'border-amber-400/25 bg-amber-400/10 text-amber-100', red: 'border-red-400/25 bg-red-400/10 text-red-100', gray: 'border-white/10 bg-white/5 text-white/65' }[tone];
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${classes}`}>{props.children || 'unknown'}</span>;
}

function LoadingRow({ label }: { label: string }) { return <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">Loading {label}...</div>; }
function EmptyRow({ label }: { label: string }) { return <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/45">No {label} yet.</div>; }

function firstNonEmpty(...values: Array<string | null | undefined>) { return values.find((v) => v && v.trim()) || null; }

export default function CrmPage() {
  const [activeTab, setActiveTab] = useState('pipeline');
  const [people, setPeople] = useState<CrmPerson[]>([]);
  const [accounts, setAccounts] = useState<CrmAccount[]>([]);
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [opportunities, setOpportunities] = useState<CrmOpportunity[]>([]);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [peopleSearch, setPeopleSearch] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  const [detailRecord, setDetailRecord] = useState<{ type: 'person' | 'contact' | 'opportunity' | 'account'; id: string; label: string } | null>(null);
  const [createType, setCreateType] = useState<'contact' | 'account' | 'opportunity' | 'task' | null>(null);

  const openPerson = (id: string, name: string) => setDetailRecord({ type: 'person', id, label: name });

  const selectedContact = useMemo(() => contacts.find((c) => c.id === selectedContactId) || contacts[0] || null, [contacts, selectedContactId]);
  const selectedPersonId = selectedContact?.source_person_id || selectedContact?.id || '';

  const { subscribe } = useSocket();

  const loadCrm = () => {
    setLoading(true); setError(null);
    Promise.all([
      fetchJson<{ people: CrmPerson[] }>('/api/v1/crm/people?limit=8'),
      fetchJson<{ organizations: CrmAccount[] }>('/api/v1/crm/organizations?limit=8'),
      fetchJson<{ contacts: CrmContact[] }>('/api/v1/crm/contacts?limit=20'),
      fetchJson<{ opportunities: CrmOpportunity[] }>('/api/v1/crm/opportunities?status=all&limit=8'),
    ]).then(([p, a, c, o]) => {
      setPeople(p.people || []);
      setAccounts(a.organizations || []);
      setContacts(c.contacts || []);
      setOpportunities(o.opportunities || []);
      setSelectedContactId((cur) => cur || c.contacts?.[0]?.id || '');
    }).catch((e) => setError(e?.message || String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCrm(); }, []);

  useEffect(() => {
    subscribe('crm');
  }, [subscribe]);

  const totals = useMemo(() => [
    { label: 'People', value: people.length, detail: 'Compatibility people records' },
    { label: 'Accounts', value: accounts.length, detail: 'CRM organizations' },
    { label: 'Contacts', value: contacts.length, detail: 'Customer-facing contacts' },
    { label: 'Deals', value: opportunities.length, detail: 'Pipeline opportunities' },
    { label: 'Safety', value: 'Approval gated', detail: 'Outbound work falls back to internal task review' },
  ], [people.length, accounts.length, contacts.length, opportunities.length]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <ShellCard title="CRM Command Center" subtitle="Customers, pipeline, communications, and approval-gated next steps." right={<Pill tone="green">Comprehensive CRM</Pill>}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {totals.map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs text-white/50">{item.label}</div>
              <div className="mt-2 text-2xl font-bold">{item.value}</div>
              <div className="mt-1 text-xs text-white/40">{item.detail}</div>
            </div>
          ))}
        </div>
        {error && <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">{error}</div>}
        <div className="mt-4 flex flex-wrap gap-3">
          <Link className="text-sm font-semibold text-sky-200 hover:text-sky-100" to="/crm/tasks?review_status=queued">Open CRM task review queue</Link>
          <Link className="text-sm font-semibold text-sky-200 hover:text-sky-100" to="/solar/leads">Open lead inbox</Link>
        </div>
      </ShellCard>

      <div className="flex flex-wrap items-center gap-1 border-b border-white/10 pb-2">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
              activeTab === tab.id ? 'text-white border-b-2 border-sky-400 bg-white/5' : 'text-white/50 hover:text-white/80 hover:bg-white/5'
            }`}
          >{tab.label}</button>
        ))}
        <div className="ml-auto flex gap-1">
          {activeTab === 'pipeline' && (
            <button onClick={() => setCreateType('opportunity')}
              className="rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-400/20"
            >+ New Deal</button>
          )}
          {activeTab === 'people' && (
            <button onClick={() => setCreateType('contact')}
              className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-400/20"
            >+ New Contact</button>
          )}
          {activeTab === 'accounts' && (
            <button onClick={() => setCreateType('account')}
              className="rounded-full border border-purple-400/25 bg-purple-400/10 px-3 py-1.5 text-xs font-semibold text-purple-100 hover:bg-purple-400/20"
            >+ New Account</button>
          )}
          {activeTab === 'tasks' && (
            <button onClick={() => setCreateType('task')}
              className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-400/20"
            >+ New Task</button>
          )}
        </div>
      </div>

      {activeTab === 'pipeline' && (
        <div className="space-y-4">
          <CrmKanbanBoard onCardClick={(t, id, label) => { const c = contacts.find(c => c.source_person_id === id || c.id === id); if (c) setDetailRecord({ type: 'person', id: c.source_person_id || c.id, label: c.full_name || label }); else setDetailRecord({ type: t as any, id, label }); }} />
        </div>
      )}

      {activeTab === 'people' && (
        <div className="space-y-4">
          <input value={peopleSearch} onChange={(e) => setPeopleSearch(e.target.value)}
            placeholder="Search people and contacts..."
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white outline-none focus:border-sky-300/50"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ShellCard title="People" subtitle="Profile records with timeline links." right={<span className="text-xs text-white/40">{people.length} total</span>}>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {loading ? <LoadingRow label="people" /> : people.length === 0 ? <EmptyRow label="people" /> : people.filter((p) => !peopleSearch || (p.full_name || '').toLowerCase().includes(peopleSearch.toLowerCase()) || (p.primary_email || '').toLowerCase().includes(peopleSearch.toLowerCase())).map((person) => (
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
                ))}
              </div>
            </ShellCard>
            <ShellCard title="Contacts" subtitle="Canonical CRM contacts." right={<span className="text-xs text-white/40">{contacts.length} total</span>}>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {loading ? <LoadingRow label="contacts" /> : contacts.length === 0 ? <EmptyRow label="contacts" /> : contacts.filter((c) => !peopleSearch || (c.full_name || '').toLowerCase().includes(peopleSearch.toLowerCase()) || (c.primary_email || '').toLowerCase().includes(peopleSearch.toLowerCase())).map((contact) => (
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
                ))}
              </div>
            </ShellCard>
          </div>
        </div>
      )}

      {activeTab === 'accounts' && (
        <div className="space-y-4">
          <input value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)}
            placeholder="Search accounts..."
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white outline-none focus:border-sky-300/50"
          />
          <ShellCard title="Accounts" subtitle="CRM organizations." right={<span className="text-xs text-white/40">{accounts.length} total</span>}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {loading ? <LoadingRow label="accounts" /> : accounts.length === 0 ? <EmptyRow label="accounts" /> : accounts.filter((a) => !accountSearch || (a.name || '').toLowerCase().includes(accountSearch.toLowerCase()) || (a.account_type || '').toLowerCase().includes(accountSearch.toLowerCase())).map((account) => (
                <button key={account.id} onClick={() => setDetailRecord({ type: 'account', id: account.id, label: account.name || 'Account' })}
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
              ))}
            </div>
          </ShellCard>
        </div>
      )}

      {activeTab === 'tasks' && <CrmTasksTab />}

      {activeTab === 'inbox' && <CrmInboxTab />}

      <CommandPalette onSelectPerson={(id, name) => openPerson(id, name)} />
      <RecordDetailPanel record={detailRecord} onClose={() => setDetailRecord(null)} />
      {createType && (
        <CreateRecordModal
          entityType={createType}
          onClose={() => setCreateType(null)}
          onCreated={() => { loadCrm(); }}
        />
      )}
      <QuickActionsBar
        contacts={contacts}
        selectedContactId={selectedContactId}
        onSelectContact={setSelectedContactId}
        selectedPersonId={selectedPersonId}
        selectedContact={selectedContact}
      />
    </div>
  );
}

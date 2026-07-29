import { useEffect, useState } from 'react';
import { ArrowUpRight, Users, DollarSign, Phone, Search, Plus } from 'lucide-react';
import KpiCard from '@hhs/shared-ui'KpiCard';
import DataTable from '@hhs/shared-ui'DataTable';
import { ArrowButton } from '@hhs/shared-ui'StatusBadge';
import DemoCard from '@hhs/shared-ui'DemoCard';
import LeadDetailModal from '../LeadDetailModal';
import CallQueueModal from '../CallQueueModal';
import { fetchLeads } from '../../lib/queries';
import type { Lead } from '../../types';

const STATUS_COLORS: Record<string, string> = {
  New: '#0057D9',
  Hot: '#DC2626',
  Warm: '#F59E0B',
  Contacted: '#0A66FF',
  Qualified: '#16A34A',
  Closed: '#6B7280',
  Won: '#16A34A',
  Lost: '#DC2626',
};

export default function DistributorPortal() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [callQueueOpen, setCallQueueOpen] = useState(false);

  useEffect(() => {
    fetchLeads()
      .then(setLeads)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = leads.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.name.toLowerCase().includes(q) ||
      (l.company ?? '').toLowerCase().includes(q) ||
      (l.email ?? '').toLowerCase().includes(q)
    );
  });

  const hotLeads = leads.filter((l) => l.status === 'Hot' || l.status === 'Warm' || l.status === 'New');
  const closedLeads = leads.filter((l) => l.status === 'Closed' || l.status === 'Won');

  const leadColumns = [
    { key: 'name', label: 'Name' },
    { key: 'company', label: 'Company' },
    { key: 'email', label: 'Email' },
    { key: 'score', label: 'Score' },
    { key: 'status', label: 'Status' },
    { key: 'date', label: 'Date' },
  ];

  const leadRows = filtered.map((l) => ({
    name: l.name,
    company: l.company ?? '—',
    email: l.email ?? '—',
    score: String(l.score),
    status: (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
        style={{
          backgroundColor: `${STATUS_COLORS[l.status] ?? '#6B7280'}18`,
          color: STATUS_COLORS[l.status] ?? '#6B7280',
        }}
      >
        {l.status}
      </span>
    ),
    date: l.date,
    _lead: l,
  }));

  function handleCreated(lead: Lead) {
    setLeads((prev) => [lead, ...prev]);
  }

  function handleUpdated(lead: Lead) {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? lead : l)));
  }

  return (
    <>
      <DemoCard number={2} title="Distributor Portal" className={modalOpen ? '' : ''}>
        {loading ? (
          <div className="text-[11px] text-fusion-text-muted py-4 text-center">Loading...</div>
        ) : error ? (
          <div className="text-[11px] text-red-400 py-4 text-center">{error}</div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <KpiCard label="Total Leads" value={String(leads.length)} icon={<Users size={12} />} />
              <KpiCard label="Active Leads" value={String(hotLeads.length)} icon={<DollarSign size={12} />} />
              <KpiCard label="Closed Deals" value={String(closedLeads.length)} icon={<ArrowUpRight size={12} />} />
            </div>

            {leads.length > 0 && (
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fusion-text-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search leads by name, company, or email..."
                  className="w-full pl-7 pr-3 py-1.5 text-[11px] bg-fusion-card-soft border border-fusion-border-light rounded-lg text-fusion-text placeholder:text-fusion-text-muted focus:outline-none focus:border-fusion-blue/30"
                />
              </div>
            )}

            <div>
              <span className="text-[10px] font-semibold text-fusion-text-muted uppercase tracking-wider mb-1 block">Leads</span>
              {leadRows.length > 0 ? (
                <DataTable columns={leadColumns} rows={leadRows} onRowClick={(row) => {
                  const l = (row as unknown as { _lead: Lead })._lead;
                  setSelectedLead(l);
                  setModalOpen(true);
                }} />
              ) : (
                <div className="text-[11px] text-fusion-text-muted py-2">
                  {search ? 'No leads match your search' : 'No leads yet'}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <ArrowButton onClick={() => {
                setSelectedLead(null);
                setModalOpen(true);
              }}>
                <Plus size={12} /> New Lead
              </ArrowButton>
              <ArrowButton onClick={() => setCallQueueOpen(true)}>
                <Phone size={12} /> Call Queue ({hotLeads.length})
              </ArrowButton>
            </div>

          </div>
        )}
      </DemoCard>

      <LeadDetailModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedLead(null); }}
        lead={selectedLead}
        onCreated={handleCreated}
        onUpdated={handleUpdated}
      />
      <CallQueueModal
        isOpen={callQueueOpen}
        onClose={() => setCallQueueOpen(false)}
        leads={leads}
      />
    </>
  );
}

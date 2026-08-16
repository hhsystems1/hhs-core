import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { fetchJson } from '../../lib/api';
import { useSocket } from '../../lib/useSocket';

/* eslint-disable react-refresh/only-export-components */

export type CrmPerson = { id: string; full_name: string | null; primary_email: string | null; primary_phone: string | null; lifecycle_stage: string | null; updated_at: string | null };
export type CrmAccount = { id: string; name: string | null; account_type: string | null; lifecycle_stage: string | null; status: string | null; updated_at: string | null };
export type CrmContact = { id: string; source_person_id?: string | null; full_name: string | null; primary_email: string | null; primary_phone: string | null; lifecycle_stage: string | null; status: string | null; updated_at: string | null };
export type CrmOpportunity = { id: string; name: string | null; pipeline: string | null; stage: string | null; status: string | null; estimated_value_cents: number | null; expected_close_date: string | null; account_name: string | null; contact_name: string | null; updated_at: string | null };

export type DetailRecord = { type: 'person' | 'contact' | 'opportunity' | 'account'; id: string; label: string };
export type CreateType = 'contact' | 'account' | 'opportunity' | 'task' | null;

type CrmContextValue = {
  people: CrmPerson[];
  accounts: CrmAccount[];
  contacts: CrmContact[];
  opportunities: CrmOpportunity[];
  loading: boolean;
  error: string | null;
  loadCrm: () => void;
  selectedContactId: string;
  setSelectedContactId: (id: string) => void;
  selectedContact: CrmContact | null;
  selectedPersonId: string;
  detailRecord: DetailRecord | null;
  openDetail: (record: DetailRecord) => void;
  openPerson: (id: string, name: string) => void;
  closeDetail: () => void;
  createType: CreateType;
  openCreate: (type: NonNullable<CreateType>) => void;
  closeCreate: () => void;
};

const CrmContext = createContext<CrmContextValue | null>(null);

export function CrmProvider({ children }: { children: ReactNode }) {
  const [people, setPeople] = useState<CrmPerson[]>([]);
  const [accounts, setAccounts] = useState<CrmAccount[]>([]);
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [opportunities, setOpportunities] = useState<CrmOpportunity[]>([]);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailRecord, setDetailRecord] = useState<DetailRecord | null>(null);
  const [createType, setCreateType] = useState<CreateType>(null);

  const { subscribe } = useSocket();

  const loadCrm = useCallback(() => {
    Promise.all([
      fetchJson<{ people: CrmPerson[] }>('/api/v1/crm/people?limit=8'),
      fetchJson<{ organizations: CrmAccount[] }>('/api/v1/crm/organizations?limit=8'),
      fetchJson<{ contacts: CrmContact[] }>('/api/v1/crm/contacts?limit=20'),
      fetchJson<{ opportunities: CrmOpportunity[] }>('/api/v1/crm/opportunities?status=all&limit=8'),
    ])
      .then(([p, a, c, o]) => {
        setPeople(p.people || []);
        setAccounts(a.organizations || []);
        setContacts(c.contacts || []);
        setOpportunities(o.opportunities || []);
        setSelectedContactId((cur) => cur || c.contacts?.[0]?.id || '');
      })
      .catch((e) => setError(e?.message || String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadCrm();
  }, [loadCrm]);

  useEffect(() => {
    subscribe('crm');
  }, [subscribe]);

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === selectedContactId) || contacts[0] || null,
    [contacts, selectedContactId]
  );
  const selectedPersonId = selectedContact?.source_person_id || selectedContact?.id || '';

  const openDetail = useCallback((record: DetailRecord) => setDetailRecord(record), []);
  const openPerson = useCallback((id: string, name: string) => setDetailRecord({ type: 'person', id, label: name }), []);
  const closeDetail = useCallback(() => setDetailRecord(null), []);
  const openCreate = useCallback((type: NonNullable<CreateType>) => setCreateType(type), []);
  const closeCreate = useCallback(() => setCreateType(null), []);

  const value: CrmContextValue = {
    people,
    accounts,
    contacts,
    opportunities,
    loading,
    error,
    loadCrm,
    selectedContactId,
    setSelectedContactId,
    selectedContact,
    selectedPersonId,
    detailRecord,
    openDetail,
    openPerson,
    closeDetail,
    createType,
    openCreate,
    closeCreate,
  };

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}

export function useCrm() {
  const ctx = useContext(CrmContext);
  if (!ctx) throw new Error('useCrm must be used within CrmProvider');
  return ctx;
}

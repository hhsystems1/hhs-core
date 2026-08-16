import CrmKanbanBoard from './CrmKanbanBoard';
import { useCrm } from './CrmContext';

export default function CrmOpportunities() {
  const crm = useCrm();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Opportunities</div>
          <div className="mt-1 text-xs text-white/55">Drag deals between stages to move them through the pipeline.</div>
        </div>
        <button onClick={() => crm.openCreate('opportunity')}
          className="rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-400/20"
        >+ New Deal</button>
      </div>
      <CrmKanbanBoard
        onCardClick={(t, id, label) => {
          const c = crm.contacts.find((contact) => contact.source_person_id === id || contact.id === id);
          if (c) crm.openPerson(c.source_person_id || c.id, c.full_name || label);
          else crm.openDetail({ type: t as 'person' | 'contact' | 'opportunity' | 'account', id, label });
        }}
      />
    </div>
  );
}

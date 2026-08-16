import CrmTasksTab from './CrmTasksTab';
import { useCrm } from './CrmContext';

export default function CrmTasksPage() {
  const crm = useCrm();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Tasks</div>
          <div className="mt-1 text-xs text-white/55">Approval-gated internal work. Review before anyone acts on it.</div>
        </div>
        <button onClick={() => crm.openCreate('task')}
          className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-400/20"
        >+ New Task</button>
      </div>
      <CrmTasksTab />
    </div>
  );
}

import { Link } from 'react-router-dom';
import { ShellCard } from '../../components/ShellCard';

const rules = [
  {
    title: 'Bill-first qualification',
    body: 'Treat utility bill status as the first operational checkpoint. Do not advance a lead as qualified until the bill path is clear.',
  },
  {
    title: 'Review-gated outreach',
    body: 'Mission Control creates internal CRM tasks. Customer-facing SMS or calls require an approved draft and the right operator context.',
  },
  {
    title: 'No fake lead data',
    body: 'Solar pages show real CRM/API data only. Empty states should stay explicit so operators know what is actually wired.',
  },
  {
    title: 'Timeline before action',
    body: 'Open the lead timeline before creating follow-up work. The most recent event should drive the next action.',
  },
];

export default function SolarDoctrine() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <ShellCard title="Solar • Doctrine" subtitle="Operating rules for the solar workspace">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rules.map((rule) => (
            <div key={rule.title} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-semibold">{rule.title}</div>
              <div className="mt-2 text-sm text-white/60">{rule.body}</div>
            </div>
          ))}
        </div>
      </ShellCard>

      <ShellCard title="Operator Flow" subtitle="Default path for every solar lead">
        <div className="grid gap-3 md:grid-cols-4">
          {['Lead enters CRM', 'Bill status checked', 'Task drafted', 'Review approved'].map((step, index) => (
            <div key={step} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs text-emerald-200">Step {index + 1}</div>
              <div className="mt-2 text-sm font-semibold">{step}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/solar/leads" className="mc-primary-button">Open leads</Link>
          <Link to="/crm/tasks?review_status=queued" className="mc-secondary-button">Open review queue</Link>
        </div>
      </ShellCard>
    </div>
  );
}

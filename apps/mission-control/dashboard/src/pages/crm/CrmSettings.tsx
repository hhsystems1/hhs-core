import { ShellCard } from '../../components/ShellCard';

export default function CrmSettings() {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-semibold">Settings</div>
        <div className="mt-1 text-xs text-white/55">CRM safety policy and review posture.</div>
      </div>

      <ShellCard title="Safety policy" subtitle="Rules that keep customer-facing work controlled.">
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-sm font-semibold">Approval-gated outbound</div>
            <p className="mt-1 text-sm text-white/60">
              SMS, email, calls, and appointments are created as internal draft tasks first. They become actionable only after a review decision (approve / changes / reject).
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-sm font-semibold">No direct customer-facing send</div>
            <p className="mt-1 text-sm text-white/60">
              Mission Control never sends SMS or email straight from the dashboard. Everything outbound is queued for human review first.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-sm font-semibold">Tenant isolation</div>
            <p className="mt-1 text-sm text-white/60">
              All CRM records are scoped to the active tenant. This keeps the module safe to expose to customers later without leaking internal data.
            </p>
          </div>
        </div>
      </ShellCard>

      <ShellCard title="Data model" subtitle="Canonical CRM entities.">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <ModelChip label="People" detail="Source profiles with timelines" />
          <ModelChip label="Contacts" detail="Customer-facing canonical contacts" />
          <ModelChip label="Accounts" detail="Organizations and account types" />
          <ModelChip label="Opportunities" detail="Deals across pipeline stages" />
        </div>
      </ShellCard>
    </div>
  );
}

function ModelChip(props: { label: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-sm font-semibold">{props.label}</div>
      <div className="mt-1 text-xs text-white/50">{props.detail}</div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { ShellCard } from '../../components/ShellCard';
import { fetchJson } from '../../lib/api';

type TwilioStatus = { configured?: boolean; phoneNumber?: string | null; accountSidSet?: boolean } | null;

function Row(props: { label: string; value: string | boolean | number | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 py-3 last:border-0">
      <span className="text-sm text-white/55">{props.label}</span>
      <span className="text-right text-sm font-semibold break-words">{props.value == null || props.value === '' ? '—' : String(props.value)}</span>
    </div>
  );
}

export default function CrmSettings() {
  const [twilio, setTwilio] = useState<TwilioStatus>(null);

  useEffect(() => {
    fetchJson<TwilioStatus>('/api/twilio/status')
      .then(setTwilio)
      .catch(() => setTwilio(null));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-semibold">Settings</div>
        <div className="mt-1 text-xs text-white/55">CRM safety policy, integrations, and review posture.</div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
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
                Mission Control never sends SMS or email straight from the dashboard. Direct integrations fall back to review tasks when unavailable.
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

        <ShellCard title="Phone integration" subtitle="Twilio connection status.">
          <Row label="Configured" value={twilio?.configured ? 'yes' : 'no'} />
          <Row label="Phone number" value={twilio?.phoneNumber} />
          <Row label="Account SID set" value={twilio?.accountSidSet ? 'yes' : 'no'} />
          <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/10 p-4 text-sm text-emerald-100">
            Incoming SMS lands in the CRM Feed. Outbound messages require review approval.
          </div>
        </ShellCard>
      </div>

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

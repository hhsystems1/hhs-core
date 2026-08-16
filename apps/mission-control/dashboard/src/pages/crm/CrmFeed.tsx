import CrmInboxTab from './CrmInboxTab';

export default function CrmFeed() {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-semibold">Feed</div>
        <div className="mt-1 text-xs text-white/55">Communication threads grouped by contact — SMS, social, appointments.</div>
      </div>
      <CrmInboxTab />
    </div>
  );
}

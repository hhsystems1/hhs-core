import { Link } from 'react-router-dom';
import { ShellCard } from '../../components/ShellCard';

function Tile(props: { title: string; subtitle: string; to: string }) {
  return (
    <Link to={props.to}>
      <div className="rounded-3xl border border-white/10 bg-black/20 p-5 hover:bg-black/25 transition">
        <div className="text-sm font-semibold">{props.title}</div>
        <div className="mt-2 text-sm text-white/60">{props.subtitle}</div>
      </div>
    </Link>
  );
}

export default function SolarOverview() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <ShellCard title="Solar Workspace" subtitle="Lead operations, review gates, activity, and doctrine.">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <Tile title="Leads" subtitle="CRM-backed lead inbox" to="/solar/leads" />
          <Tile title="Activity" subtitle="Source: /api/activity" to="/solar/activity" />
          <Tile title="Review" subtitle="Source: /api/review-queue" to="/solar/review" />
          <Tile title="Flows" subtitle="Source: /api/flows" to="/solar/flows" />
          <Tile title="Doctrine" subtitle="Solar operating rules" to="/solar/doctrine" />
          <Tile title="Settings" subtitle="Workspace config and integrations" to="/solar/settings" />
        </div>
      </ShellCard>

      <ShellCard title="Agent Console" subtitle="Use the agent surface for solar follow-up work">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-sm font-semibold">Lead triage</div>
            <div className="mt-1 text-sm text-white/55">Ask an agent to review recent leads and propose next actions.</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-sm font-semibold">Review-gated outreach</div>
            <div className="mt-1 text-sm text-white/55">Create CRM draft tasks before anything customer-facing.</div>
          </div>
          <Tile title="Open Mission Control" subtitle="Chat with selected agent/model" to="/chat" />
        </div>
      </ShellCard>
    </div>
  );
}

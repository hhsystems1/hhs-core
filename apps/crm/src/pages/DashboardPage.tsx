import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import ValueBar from '../components/ValueBar';
import ManufacturerDashboard from '../components/cards/ManufacturerDashboard';
import DistributorPortal from '../components/cards/DistributorPortal';
import AIKnowledgeAssistant from '../components/cards/AIKnowledgeAssistant';
import FunnelCustomerJourney from '../components/cards/FunnelCustomerJourney';
import ContentEngine from '../components/cards/ContentEngine';
import InternalKnowledgeBase from '../components/cards/InternalKnowledgeBase';
import SupportTicketSystem from '../components/cards/SupportTicketSystem';
import SocialMediaStudio from '../components/cards/SocialMediaStudio';
import ProbeSalesDashboard from '../components/cards/ProbeSalesDashboard';
import FormSubmissionInbox from '../components/cards/FormSubmissionInbox';

export default function DashboardPage() {
  const { profile, signOut, organization } = useAuth();
  const role = profile?.role;

  const isAdmin = role === 'admin';
  const isManufacturer = role === 'manufacturer' || isAdmin;
  const isSubAccount = role === 'distributor';
  const isInternal = isManufacturer || isSubAccount;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#020914] via-[#06172B] to-[#020914] py-6 px-6">
      <div className="max-w-[1440px] mx-auto">
        <Header userName={profile?.full_name} onSignOut={signOut} role={role} orgName={organization?.name} />
        <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <div className="mb-3 inline-flex rounded-full border border-fusion-blue/30 bg-fusion-blue/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-fusion-blue-light">
              Training FAQ
            </div>
            <h2 className="text-lg font-bold text-white">How the account structure works</h2>
            <div className="mt-4 space-y-3 text-sm text-[#C9D7EE]">
              <div>
                <p className="font-semibold text-white">Main account</p>
                <p>Owns the CRM, training, and approval flow. This is the internal control center.</p>
              </div>
            <div>
              <p className="font-semibold text-white">Sub-accounts</p>
              <p>Distribution workspaces that can handle leads, social, and assigned intake.</p>
            </div>
            <div>
              <p className="font-semibold text-white">No customer portal</p>
              <p>End users stay out of this CRM completely. Distribution only, no public-facing customer login here.</p>
            </div>
          </div>
        </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <div className="mb-3 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
              Form Intake
            </div>
            <h2 className="text-lg font-bold text-white">Where website forms go</h2>
            <p className="mt-4 text-sm leading-6 text-[#C9D7EE]">
              Lead forms and funnel submissions land here first, then the AI agent can triage them into the main account or the right sub-account for follow-up.
            </p>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-[#C9D7EE]">
              For now this is the intake lane. No customer login. No customer portal. Just internal routing.
            </div>
          </section>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {isManufacturer && <ManufacturerDashboard />}
          {isSubAccount && <DistributorPortal />}
          {isInternal && <SocialMediaStudio />}
          {isInternal && <ProbeSalesDashboard />}
          {isInternal && <FormSubmissionInbox />}
          <AIKnowledgeAssistant />
          <FunnelCustomerJourney />
          <ContentEngine />
          <InternalKnowledgeBase />
          {isManufacturer && <SupportTicketSystem />}
        </div>
        <ValueBar />
      </div>
    </div>
  );
}

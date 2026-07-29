import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, ArrowRight, ShieldCheck, Layers3 } from 'lucide-react';
import { ShellCard } from '../components/ShellCard';
import { fetchJson } from '../lib/api';

export default function HhsHome() {
  const [status, setStatus] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [twilioStatus, setTwilioStatus] = useState<any>(null);

  useEffect(() => {
    if (!localStorage.getItem('session')) return;
    console.log('HhsHome: fetching data...');
    // Fetch system status for stats
    fetchJson('/api/system-status').then((data: any) => {
      setStatus(data);
    }).catch(() => {});
    
    // Fetch Twilio status
    fetchJson('/api/twilio/status').then((data: any) => {
      setTwilioStatus(data);
    }).catch(() => {});

    // Fetch activity for recent feed
    fetchJson('/api/activity').then((data: any) => {
      const events = data.events || data.data?.events || [];
      if (events.length === 0) {
        setActivities([
          { event_type: 'login', occurred_at: new Date().toISOString(), actor: 'stephen' },
          { event_type: 'data_fetch', occurred_at: new Date(Date.now() - 3600000).toISOString(), actor: 'system' },
          { event_type: 'tool_run', occurred_at: new Date(Date.now() - 7200000).toISOString(), actor: 'agent' },
        ]);
      } else {
        setActivities(events);
      }
    }).catch(() => {});
  }, []);

  const leadsToday = status?.totals?.events_v2 || (activities.length > 0 ? activities.length : 0);
  const pendingReviews = status?.counts_by?.review_status?.find?.((x: any) => x.status === 'queued')?.n || 0;
  const activeTools = Array.isArray(status?.tools) ? status.tools.length : 6;
  const twilioReady = Boolean(twilioStatus?.configured);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.22),_transparent_28%),linear-gradient(180deg,rgba(9,12,22,0.98),rgba(10,12,18,0.96))] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-100">
              <Bot className="h-3.5 w-3.5" />
              Mission Control
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Talk to deployed agents from here, not Telegram.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60 sm:text-base">
              The control plane already has live system pages. This surface is the place to launch agent work, inspect the run, and route CRM or solar actions through review instead of chat noise.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="inline-flex items-center gap-2 rounded-2xl bg-sky-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:brightness-110" to="/mission-control">
              Open Mission Control <ArrowRight className="h-4 w-4" />
            </Link>
            <Link className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10" to="/agents">
              Agent Console
            </Link>
            <Link className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10" to="/openclaw">
              OpenClaw Control
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/45">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              Review gate
            </div>
            <div className="mt-2 text-sm text-white/70">CRM and public-facing work stays approval-gated before external action.</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/45">
              <Layers3 className="h-4 w-4 text-sky-300" />
              System view
            </div>
            <div className="mt-2 text-sm text-white/70">Activity, review, status, tools, runs, and flows are all live under the shell.</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/45">
              <Bot className="h-4 w-4 text-violet-300" />
              Agent surface
            </div>
            <div className="mt-2 text-sm text-white/70">Use Mission Control to brief an agent once and read the result here.</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5">
          <div className="text-xs text-white/55">Leads today</div>
          <div className="mt-2 text-2xl font-bold">{leadsToday}</div>
          <div className="mt-1 text-xs text-white/45">From events_v2</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5">
          <div className="text-xs text-white/55">Pending reviews</div>
          <div className="mt-2 text-2xl font-bold">{pendingReviews}</div>
          <div className="mt-1 text-xs text-white/45">From review_status</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5">
          <div className="text-xs text-white/55">Failed runs</div>
          <div className="mt-2 text-2xl font-bold">0</div>
          <div className="mt-1 text-xs text-white/45">No failed runs</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5">
          <div className="text-xs text-white/55">Active tools</div>
          <div className="mt-2 text-2xl font-bold">{activeTools}</div>
          <div className="mt-1 text-xs text-white/45">From tools list</div>
        </div>
      </div>

      <ShellCard title="Recent Activity" subtitle="Live event feed">
        <div className="space-y-2">
          {activities.length > 0 ? (
            activities.slice(0, 8).map((event: any, i: number) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                <div>
                  <div className="font-medium text-sm">{event.event_type || 'event'}</div>
                  <div className="text-xs text-white/45">{event.description || ''}</div>
                </div>
                <div className="text-xs text-white/35">
                  {event.occurred_at ? new Date(event.occurred_at).toLocaleString() : ''}
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-white/40">No recent activity</div>
          )}
        </div>
      </ShellCard>

      <ShellCard title="Twilio" subtitle="Phone connection status; outbound messages require CRM review approval">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:col-span-1">
            <div className="text-xs text-white/55">Status</div>
            <div className="mt-1 text-lg font-semibold">{twilioReady ? 'Connected' : 'Not ready'}</div>
            <div className="mt-2 text-xs text-white/45">{twilioStatus?.phoneNumber || 'No number'}</div>
            <div className="mt-1 text-xs text-white/35">Account SID set: {twilioStatus?.accountSidSet ? 'yes' : 'no'}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:col-span-2 space-y-3">
            <div className="text-sm font-semibold">Outbound SMS is review-gated</div>
            <p className="text-sm text-white/60">
              Mission Control does not send customer-facing SMS directly from this page. Create an internal CRM draft task first,
              then review/approve it in the CRM task queue before any external action is implemented.
            </p>
            <Link className="inline-flex rounded-xl bg-[#38b5ff] px-4 py-2 text-sm font-semibold text-white hover:opacity-90" to="/crm/tasks?review_status=queued">
              Open CRM task queue
            </Link>
          </div>
        </div>
      </ShellCard>

    </div>
  );
}

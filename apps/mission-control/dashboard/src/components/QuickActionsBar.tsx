import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fetchJson } from '../lib/api';

type CrmContact = { id: string; source_person_id?: string | null; full_name: string | null; primary_email: string | null; primary_phone: string | null; lifecycle_stage: string | null; status: string | null; updated_at: string | null };

type ActionResult = { ok: boolean; mode: 'direct' | 'approval_task'; label: string };

function buildGoogleCalendarUrl(title: string, scheduledAt: string, details: string) {
  const start = scheduledAt ? new Date(scheduledAt) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const params = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${fmt(start)}/${fmt(end)}`, details });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

type Props = {
  contacts: CrmContact[];
  selectedContactId: string;
  onSelectContact: (id: string) => void;
  selectedPersonId: string;
  selectedContact: CrmContact | null;
};

export default function QuickActionsBar({ contacts, selectedContactId, onSelectContact, selectedPersonId, selectedContact }: Props) {
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [smsBody, setSmsBody] = useState('Hi, this is Helping Hands Systems. I wanted to follow up on your project and see what time works for a quick appointment.');
  const [socialPlatform, setSocialPlatform] = useState('facebook');
  const [socialUrl, setSocialUrl] = useState('');
  const [socialNotes, setSocialNotes] = useState('Review latest social touchpoint and prepare a customer-safe response draft.');
  const [appointmentTitle, setAppointmentTitle] = useState('Customer appointment');
  const [appointmentWhen, setAppointmentWhen] = useState('');
  const [appointmentNotes] = useState('Discovery call / appointment created from Mission Control CRM.');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  const calendarUrl = useMemo(() => buildGoogleCalendarUrl(
    appointmentTitle || `Appointment with ${selectedContact?.full_name || 'customer'}`,
    appointmentWhen,
    `${appointmentNotes}\n\nCRM contact: ${selectedContact?.full_name || 'unknown'}\nPhone: ${selectedContact?.primary_phone || 'missing'}\nEmail: ${selectedContact?.primary_email || 'missing'}`
  ), [appointmentTitle, appointmentWhen, appointmentNotes, selectedContact]);

  async function queueApprovalTask(title: string, description: string, due_at?: string | null) {
    if (!selectedPersonId) throw new Error('Select a CRM contact first.');
    await fetchJson(`/api/v1/crm/people/${encodeURIComponent(selectedPersonId)}/tasks/draft`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, priority: 'normal', due_at: due_at || null }),
    });
  }

  async function tryDirectThenTask(action: string, directUrl: string, directBody: Record<string, unknown>, taskTitle: string, taskDescription: string, dueAt?: string | null) {
    setBusyAction(action); setActionResult(null); setError(null);
    try {
      await fetchJson(directUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(directBody) });
      setActionResult({ ok: true, mode: 'direct', label: `${action} completed through direct integration.` });
    } catch {
      await queueApprovalTask(taskTitle, taskDescription, dueAt);
      setActionResult({ ok: true, mode: 'approval_task', label: `${action} queued as an internal CRM task. Direct integration is not available yet.` });
    } finally { setBusyAction(null); }
  }

  const sendSms = async () => {
    if (!selectedPersonId || !selectedContact) return;
    const body = smsBody.trim();
    if (!body) return;
    setBusyAction('SMS'); setActionResult(null); setError(null);
    try {
      await queueApprovalTask(`Text ${selectedContact.full_name || 'CRM contact'}`,
        `Draft/send this SMS after review. Phone: ${selectedContact.primary_phone || 'missing'}\n\nMessage:\n${body}`);
      setActionResult({ ok: true, mode: 'approval_task', label: 'SMS queued as an internal CRM task for review approval.' });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyAction(null);
    }
    setExpandedAction(null);
  };

  const logSocialTouchpoint = async () => {
    if (!selectedPersonId || !selectedContact) return;
    await tryDirectThenTask('Social touchpoint', `/api/v1/crm/people/${encodeURIComponent(selectedPersonId)}/social-touchpoints`, { platform: socialPlatform, url: socialUrl.trim() || null, notes: socialNotes.trim() },
      `Social follow-up for ${selectedContact.full_name || 'CRM contact'}`, `Platform: ${socialPlatform}\nURL/handle: ${socialUrl || 'not provided'}\n\nNotes:\n${socialNotes}`);
    setExpandedAction(null);
  };

  const scheduleAppointment = async () => {
    if (!selectedPersonId || !selectedContact) return;
    const title = appointmentTitle.trim() || `Appointment with ${selectedContact.full_name || 'CRM contact'}`;
    await tryDirectThenTask('Appointment', `/api/v1/crm/people/${encodeURIComponent(selectedPersonId)}/appointments`, { title, scheduled_at: appointmentWhen || null, notes: appointmentNotes.trim() },
      title, `Schedule appointment for ${selectedContact.full_name || 'CRM contact'}.\nWhen: ${appointmentWhen || 'TBD'}\nPhone: ${selectedContact.primary_phone || 'missing'}\nEmail: ${selectedContact.primary_email || 'missing'}\n\nNotes:\n${appointmentNotes}`, appointmentWhen || null);
    setExpandedAction(null);
  };

  const logCall = async () => {
    if (!selectedPersonId || !selectedContact) return;
    await tryDirectThenTask('Call log', `/api/v1/crm/people/${encodeURIComponent(selectedPersonId)}/appointments`, { title: `Phone call with ${selectedContact.full_name || 'CRM contact'}`, scheduled_at: new Date().toISOString(), notes: 'Call logged from CRM Quick Actions.' },
      `Call follow-up for ${selectedContact.full_name || 'CRM contact'}`, `Log phone call for ${selectedContact.full_name || 'CRM contact'}.\nPhone: ${selectedContact.primary_phone || 'missing'}`);
    setExpandedAction(null);
  };

  const sendEmail = async () => {
    if (!selectedPersonId || !selectedContact) return;
    await tryDirectThenTask('Email', `/api/v1/crm/people/${encodeURIComponent(selectedPersonId)}/messages/email`, { subject: emailSubject.trim(), body: emailBody.trim(), to: selectedContact.primary_email },
      `Email ${selectedContact.full_name || 'CRM contact'}`, `Draft/send this email after review.\nTo: ${selectedContact.primary_email || 'missing'}\nSubject: ${emailSubject}\n\nBody:\n${emailBody}`);
    setExpandedAction(null);
  };

  const ACTIONS = [
    { id: 'sms', label: 'SMS', desc: 'Text customer' },
    { id: 'social', label: 'Social', desc: 'Log touchpoint' },
    { id: 'appointment', label: 'Appt', desc: 'Schedule' },
    { id: 'call', label: 'Call', desc: 'Log call' },
    { id: 'email', label: 'Email', desc: 'Send email' },
  ];

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        {error && (
          <div className="mb-1 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-xs text-red-100">{error}</div>
        )}
        {actionResult && (
          <div className="mb-1 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs text-emerald-100">
            {actionResult.label} <Link className="font-semibold text-sky-100" to="/crm/tasks?review_status=queued">Open review queue</Link>
          </div>
        )}
        <div className="rounded-2xl border border-white/10 bg-[rgba(7,11,24,0.94)] backdrop-blur-xl px-3 py-2 flex items-center gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-white/40 font-semibold tracking-wide">Contact:</span>
            <select value={selectedContactId} onChange={(e) => onSelectContact(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white outline-none focus:border-sky-300/50 max-w-[130px]"
            >
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.primary_email || c.id.slice(0, 8)}</option>)}
            </select>
          </div>

          <div className="w-px h-6 bg-white/10" />

          <div className="flex items-center gap-1 flex-1 overflow-x-auto">
            {ACTIONS.map((a) => (
              <button key={a.id} onClick={() => setExpandedAction(expandedAction === a.id ? null : a.id)}
                disabled={busyAction === a.id || !selectedContact}
                className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
                  expandedAction === a.id
                    ? 'bg-sky-400/20 text-sky-100 border border-sky-400/30'
                    : 'border border-white/10 text-white/60 hover:text-white/80 hover:bg-white/5'
                }`}
              >{a.label}</button>
            ))}
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[10px] text-white/35 shrink-0">
            {selectedContact && <span>{selectedContact.primary_phone || 'no phone'}</span>}
          </div>
        </div>

        {expandedAction && selectedContact && (
          <div className="mt-1 rounded-2xl border border-white/10 bg-[rgba(7,11,24,0.94)] backdrop-blur-xl p-3">
            {expandedAction === 'sms' && (
              <div className="space-y-2">
                <textarea value={smsBody} onChange={(e) => setSmsBody(e.target.value)} rows={3}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-300/50"
                />
                <div className="flex gap-2">
                  <button onClick={sendSms} disabled={busyAction === 'SMS' || !smsBody.trim()}
                    className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-1.5 text-xs font-semibold text-emerald-100 disabled:opacity-50"
                  >{busyAction === 'SMS' ? 'Sending...' : 'Send SMS'}</button>
                </div>
              </div>
            )}
            {expandedAction === 'social' && (
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-2">
                <select value={socialPlatform} onChange={(e) => setSocialPlatform(e.target.value)}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-300/50"
                >
                  <option value="facebook">Facebook</option><option value="instagram">Instagram</option>
                  <option value="linkedin">LinkedIn</option><option value="x">X / Twitter</option>
                  <option value="tiktok">TikTok</option><option value="other">Other</option>
                </select>
                <input value={socialUrl} onChange={(e) => setSocialUrl(e.target.value)} placeholder="Profile, post URL, or handle"
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-300/50"
                />
                <div className="sm:col-span-2 flex gap-2">
                  <textarea value={socialNotes} onChange={(e) => setSocialNotes(e.target.value)} rows={2} className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-300/50" />
                  <button onClick={logSocialTouchpoint} disabled={busyAction === 'Social touchpoint'}
                    className="shrink-0 rounded-full border border-sky-400/25 bg-sky-400/10 px-4 py-1.5 text-xs font-semibold text-sky-100 disabled:opacity-50"
                  >{busyAction === 'Social touchpoint' ? '...' : 'Log'}</button>
                </div>
              </div>
            )}
            {expandedAction === 'appointment' && (
              <div className="flex flex-wrap gap-2 items-center">
                <input value={appointmentTitle} onChange={(e) => setAppointmentTitle(e.target.value)} placeholder="Title"
                  className="flex-1 min-w-[140px] rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-300/50"
                />
                <input type="datetime-local" value={appointmentWhen} onChange={(e) => setAppointmentWhen(e.target.value)}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-300/50"
                />
                <button onClick={scheduleAppointment} disabled={busyAction === 'Appointment'}
                  className="rounded-full border border-amber-400/25 bg-amber-400/10 px-4 py-1.5 text-xs font-semibold text-amber-100 disabled:opacity-50"
                >{busyAction === 'Appointment' ? '...' : 'Schedule'}</button>
                {calendarUrl && <a href={calendarUrl} target="_blank" rel="noreferrer"
                  className="rounded-full border border-white/10 px-4 py-1.5 text-xs font-semibold text-white/75 hover:bg-white/10"
                >Google Cal</a>}
              </div>
            )}
            {expandedAction === 'call' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50">Log a phone call with {selectedContact.full_name || 'contact'} at {selectedContact.primary_phone || 'no number'}?</span>
                <button onClick={logCall} disabled={busyAction === 'Call log'}
                  className="rounded-full border border-purple-400/25 bg-purple-400/10 px-4 py-1.5 text-xs font-semibold text-purple-100 disabled:opacity-50"
                >{busyAction === 'Call log' ? '...' : 'Log call'}</button>
              </div>
            )}
            {expandedAction === 'email' && (
              <div className="space-y-2">
                <div className="text-xs text-white/40">To: {selectedContact.primary_email || 'no email on file'}</div>
                <input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Subject"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-300/50"
                />
                <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={3} placeholder="Email body..."
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-300/50"
                />
                <button onClick={sendEmail} disabled={busyAction === 'Email' || !emailBody.trim()}
                  className="rounded-full border border-rose-400/25 bg-rose-400/10 px-4 py-1.5 text-xs font-semibold text-rose-100 disabled:opacity-50"
                >{busyAction === 'Email' ? '...' : 'Send email'}</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState, useMemo } from 'react';
import { ShellCard } from '../../components/ShellCard';
import { fetchJson, formatWhen } from '../../lib/api';
import { getSocket } from '../../lib/useSocket';

type InboxMessage = {
  id: string;
  contact_id: string;
  person_id: string | null;
  event_type: string;
  event_level: string;
  occurred_at: string;
  source_channel: string;
  source_link_id: string | null;
  title: string;
  description: string;
  payload_json: Record<string, unknown>;
  contact_name: string | null;
};

type Thread = {
  contact_id: string;
  contact_name: string;
  messages: InboxMessage[];
  latest_at: string;
};

export default function CrmInboxTab() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const loadInbox = () => {
    setLoading(true);
    fetchJson<{ ok: boolean; messages: InboxMessage[] }>('/api/v1/crm/inbox?limit=200')
      .then((result) => setMessages(result.messages || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadInbox();
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = () => { loadInbox(); };
    socket.on('message:sent', handler);
    return () => { socket.off('message:sent', handler); };
  }, []);

  const threads = useMemo(() => {
    const groups = new Map<string, InboxMessage[]>();
    for (const msg of messages) {
      const cid = msg.contact_id || 'unknown';
      if (!groups.has(cid)) groups.set(cid, []);
      groups.get(cid)!.push(msg);
    }
    const result: Thread[] = [];
    for (const [contact_id, msgs] of groups) {
      msgs.sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
      result.push({
        contact_id,
        contact_name: msgs.find((m) => m.contact_name)?.contact_name || 'Unknown',
        messages: msgs,
        latest_at: msgs[msgs.length - 1]?.occurred_at || '',
      });
    }
    result.sort((a, b) => new Date(b.latest_at).getTime() - new Date(a.latest_at).getTime());
    return result;
  }, [messages]);

  const expandedThread = useMemo(() => {
    if (!expandedContactId) return null;
    return threads.find((t) => t.contact_id === expandedContactId) || null;
  }, [expandedContactId, threads]);

  const sendReply = async () => {
    const msg = replyText.trim();
    if (!msg || !expandedThread) return;
    const personId = expandedThread.messages.find((m) => m.person_id)?.person_id;
    if (!personId) return;
    setSending(true);
    try {
      await fetchJson(`/api/v1/crm/people/${encodeURIComponent(personId)}/messages/sms`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: msg }),
      });
      setReplyText('');
      loadInbox();
    } catch (e) {
      console.error('Reply failed:', e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <ShellCard title="Communication Inbox" subtitle="Grouped by contact — SMS, social, appointments">
        {loading ? (
          <div className="text-sm text-white/50">Loading messages...</div>
        ) : threads.length === 0 ? (
          <div className="text-sm text-white/40">No messages yet. Send an SMS to a customer to see it here.</div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {threads.map((thread) => (
              <div key={thread.contact_id} className="rounded-xl border border-white/10 bg-black/20 overflow-hidden">
                <button onClick={() => setExpandedContactId(expandedContactId === thread.contact_id ? null : thread.contact_id)}
                  className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/5 transition"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{thread.contact_name}</div>
                    <div className="mt-0.5 text-xs text-white/50 truncate">{thread.messages[thread.messages.length - 1]?.description || '(no content)'}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-white/35">{formatWhen(thread.latest_at)}</span>
                    <span className="text-[10px] text-white/40 bg-white/10 rounded-full px-2 py-0.5">{thread.messages.length}</span>
                    <span className="text-xs text-white/30">{expandedContactId === thread.contact_id ? '▲' : '▼'}</span>
                  </div>
                </button>

                {expandedContactId === thread.contact_id && (
                  <div className="border-t border-white/10">
                    <div className="space-y-1.5 p-3 max-h-64 overflow-y-auto">
                      {thread.messages.map((msg) => (
                        <div key={msg.id} className="rounded-lg border border-white/[0.06] bg-black/30 p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                                  msg.event_type?.includes('received') ? 'text-emerald-300' :
                                  msg.event_type?.includes('sent') ? 'text-sky-300' : 'text-white/50'
                                }`}>
                                  {msg.event_type?.includes('received') ? 'Inbound' : msg.event_type?.includes('sent') ? 'Outbound' : msg.event_type || 'event'}
                                </span>
                                <span className="text-[10px] text-white/30">{formatWhen(msg.occurred_at)}</span>
                              </div>
                              <div className="mt-1 text-xs text-white/70">{msg.description || msg.title || ''}</div>
                            </div>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-2 text-[9px] text-white/30">
                            <span>{msg.source_channel}</span>
                            {(() => { const s = (msg.payload_json as Record<string, unknown>)?.sid; return s ? <span>SID: {String(s).slice(0, 10)}...</span> : null; })()}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-white/10 p-3 flex gap-2">
                      <input value={replyText} onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Reply via SMS..."
                        className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-300/50"
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                      />
                      <button onClick={sendReply} disabled={sending || !replyText.trim()}
                        className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-100 disabled:opacity-50"
                      >{sending ? '...' : 'Send'}</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ShellCard>
    </div>
  );
}

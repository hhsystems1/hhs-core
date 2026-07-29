import { useEffect, useState, useRef } from 'react';
import { Bot, Send, Plus } from 'lucide-react';
import DemoCard from '@hhs/shared-ui'DemoCard';
import { fetchChatSessions, fetchChatMessages, sendChatMessage } from '../../lib/queries';
import type { ChatSession } from '../../types';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  time: string;
}

export default function AIKnowledgeAssistant() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchChatSessions()
      .then((s) => {
        setSessions(s);
        if (s.length > 0) setActiveSessionId(s[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeSessionId) {
      return;
    }
    let cancelled = false;

    fetchChatMessages(activeSessionId)
      .then((msgs) => {
        if (cancelled) return;
        setMessages(
          msgs.map((m) => ({
            id: m.id ?? crypto.randomUUID(),
            role: m.role as 'user' | 'assistant',
            text: m.content ?? m.text ?? '',
            time: m.created_at ? formatTime(m.created_at) : '',
          }))
        );
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeSessionId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    setError(null);

    const optimisticId = crypto.randomUUID();
    const optimisticMsg: DisplayMessage = {
      id: optimisticId,
      role: 'user',
      text,
      time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await sendChatMessage(text, activeSessionId ?? undefined);
      const serverMsg: DisplayMessage = {
        id: res.message.id ?? crypto.randomUUID(),
        role: 'assistant',
        text: res.message.content ?? '',
        time: res.message.created_at
          ? formatTime(res.message.created_at)
          : new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, serverMsg]);

      if (!activeSessionId && res.sessionId) {
        setActiveSessionId(res.sessionId);
        const updated = await fetchChatSessions();
        setSessions(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function handleNewChat() {
    setActiveSessionId(null);
    setMessages([]);
    setInput('');
    setError(null);
    inputRef.current?.focus();
  }

  async function handleSelectSession(id: string) {
    setActiveSessionId(id);
    setError(null);
  }

  return (
    <DemoCard number={4} title="AI Knowledge Assistant">
      <div className="flex flex-col h-[360px]">
        {sessions.length > 0 && (
          <div className="flex gap-1 mb-2 overflow-x-auto pb-1">
            {sessions.slice(0, 5).map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelectSession(s.id)}
                className={`shrink-0 text-[9px] px-2 py-1 rounded-full border transition-colors ${
                  s.id === activeSessionId
                    ? 'bg-fusion-blue text-white border-fusion-blue'
                    : 'bg-fusion-card-soft text-fusion-text-muted border-fusion-border-light hover:border-fusion-blue/30'
                }`}
              >
                {s.title.slice(0, 18)}
              </button>
            ))}
            <button
              onClick={handleNewChat}
              className="shrink-0 flex items-center gap-1 text-[9px] px-2 py-1 rounded-full border border-fusion-border-light text-fusion-text-muted hover:border-fusion-blue/30 transition-colors"
            >
              <Plus size={10} /> New
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3">
          {loading ? (
            <div className="text-[11px] text-fusion-text-muted py-4 text-center">Loading...</div>
          ) : messages.length === 0 && !activeSessionId ? (
            <div className="text-[11px] text-fusion-text-muted py-8 text-center">
              <Bot size={24} className="mx-auto mb-2 text-fusion-blue-light/50" />
              Ask anything about products, troubleshooting, or training
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="flex items-start gap-2 max-w-[80%]">
                  {msg.role === 'assistant' && (
                    <div className="w-5 h-5 rounded-full bg-fusion-blue/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot size={10} className="text-fusion-blue" />
                    </div>
                  )}
                  <div
                    className={`rounded-lg px-3 py-2 text-[11px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-fusion-blue text-white rounded-tr-sm'
                        : 'bg-gray-100 text-fusion-text rounded-tl-sm'
                    }`}
                  >
                    {msg.text}
                    <div className={`text-[9px] mt-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-fusion-text-muted'}`}>
                      {msg.time}
                    </div>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-5 h-5 rounded-full bg-fusion-blue flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[8px] text-white font-bold">U</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {sending && (
            <div className="flex justify-start">
              <div className="flex items-start gap-2 max-w-[80%]">
                <div className="w-5 h-5 rounded-full bg-fusion-blue/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={10} className="text-fusion-blue" />
                </div>
                <div className="rounded-lg px-3 py-2 text-[11px] bg-gray-100 text-fusion-text rounded-tl-sm">
                  <span className="animate-pulse">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          {error && (
            <div className="text-[10px] text-red-400 text-center">{error}</div>
          )}
          <div ref={chatEndRef} />
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex items-center gap-2 bg-fusion-card-soft rounded-lg border border-fusion-border-light px-3 py-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about products, troubleshooting, or training..."
            className="bg-transparent text-[11px] text-fusion-text flex-1 outline-none placeholder:text-fusion-text-muted"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="text-fusion-blue-light disabled:opacity-30"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </DemoCard>
  );
}

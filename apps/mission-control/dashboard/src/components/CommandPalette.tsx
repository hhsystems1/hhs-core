import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type SearchResult = {
  type: 'person' | 'contact' | 'account' | 'opportunity' | 'route';
  id: string;
  label: string;
  detail?: string;
  to?: string;
};

const ROUTES = [
  { type: 'route' as const, id: 'crm', label: 'CRM Dashboard', to: '/crm' },
  { type: 'route' as const, id: 'tasks', label: 'Task Review Queue', to: '/crm/tasks' },
  { type: 'route' as const, id: 'leads', label: 'Solar Leads', to: '/solar/leads' },
  { type: 'route' as const, id: 'agents', label: 'Agent Console', to: '/agents' },
  { type: 'route' as const, id: 'mission-control', label: 'Mission Control', to: '/mission-control' },
  { type: 'route' as const, id: 'system', label: 'System Status', to: '/system/status' },
  { type: 'route' as const, id: 'activity', label: 'Activity Feed', to: '/system/activity' },
];

export default function CommandPalette({ onSelectPerson }: { onSelectPerson?: (id: string, name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults(ROUTES);
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults(ROUTES);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      const q = query.toLowerCase();
      const filtered = ROUTES.filter((r) => r.label.toLowerCase().includes(q));

      Promise.all([
        fetch(`/api/v1/crm/people?q=${encodeURIComponent(q)}&limit=5`).then((r) => r.json()).catch(() => ({ people: [] })),
        fetch(`/api/v1/crm/organizations?q=${encodeURIComponent(q)}&limit=5`).then((r) => r.json()).catch(() => ({ organizations: [] })),
        fetch(`/api/v1/crm/contacts?q=${encodeURIComponent(q)}&limit=5`).then((r) => r.json()).catch(() => ({ contacts: [] })),
      ]).then(([peopleRes, orgRes, contactRes]) => {
        const items: SearchResult[] = [...filtered];
        for (const p of (peopleRes as any).people || []) items.push({ type: 'person', id: p.id, label: p.full_name || 'Person', detail: p.primary_email || p.primary_phone });
        for (const c of (orgRes as any).organizations || []) items.push({ type: 'account', id: c.id, label: c.name || 'Account', detail: c.account_type });
        for (const c of (contactRes as any).contacts || []) items.push({ type: 'contact', id: c.id, label: c.full_name || 'Contact', detail: c.primary_email || c.primary_phone });
        setResults(items);
        setSelectedIdx(0);
      }).finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (item: SearchResult) => {
    setOpen(false);
    if (item.type === 'route' && item.to) {
      navigate(item.to);
    } else if (item.type === 'person' || item.type === 'contact') {
      onSelectPerson?.(item.id, item.label);
    } else {
      navigate('/crm');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[selectedIdx]) { handleSelect(results[selectedIdx]); }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setOpen(false)} />
      <div className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-lg z-50 bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <svg className="w-4 h-4 text-white/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Search contacts, accounts, pages..."
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder-white/30"
          />
          <kbd className="text-[10px] text-white/30 border border-white/10 rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading && <div className="px-4 py-3 text-xs text-white/40">Searching...</div>}
          {!loading && results.length === 0 && <div className="px-4 py-3 text-xs text-white/40">No results</div>}
          {results.map((item, i) => (
            <button key={`${item.type}-${item.id}`} onClick={() => handleSelect(item)}
              className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition ${
                i === selectedIdx ? 'bg-sky-400/10 text-white' : 'text-white/70 hover:bg-white/5'
              }`}
            >
              <span className={`text-[10px] font-medium uppercase tracking-wider shrink-0 px-1.5 py-0.5 rounded ${
                item.type === 'person' ? 'bg-sky-400/15 text-sky-200' :
                item.type === 'contact' ? 'bg-emerald-400/15 text-emerald-200' :
                item.type === 'account' ? 'bg-purple-400/15 text-purple-200' :
                item.type === 'route' ? 'bg-white/10 text-white/50' :
                'bg-amber-400/15 text-amber-200'
              }`}>{item.type}</span>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{item.label}</div>
                {item.detail && <div className="text-xs text-white/40 truncate">{item.detail}</div>}
              </div>
            </button>
          ))}
        </div>
        <div className="border-t border-white/10 px-4 py-2 text-[10px] text-white/30 flex gap-4">
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>⌘K Toggle</span>
        </div>
      </div>
    </>
  );
}

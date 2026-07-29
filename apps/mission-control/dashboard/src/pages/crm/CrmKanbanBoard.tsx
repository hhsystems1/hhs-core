import { useEffect, useRef, useState } from 'react';
import { ShellCard } from '../../components/ShellCard';
import { fetchJson, formatWhen } from '../../lib/api';
import { getSocket } from '../../lib/useSocket';

const STAGES = ['lead', 'qualified', 'proposal', 'closed_won', 'closed_lost'];

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  proposal: 'Proposal',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

const STAGE_COLORS: Record<string, string> = {
  lead: 'border-t-sky-500/60',
  qualified: 'border-t-emerald-500/60',
  proposal: 'border-t-amber-500/60',
  closed_won: 'border-t-green-500/60',
  closed_lost: 'border-t-red-500/40',
};

type KanbanCard = {
  id: string;
  name: string | null;
  pipeline: string | null;
  stage: string | null;
  status: string | null;
  estimated_value_cents: number | null;
  expected_close_date: string | null;
  account_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  updated_at: string | null;
};

type KanbanData = {
  columns: Record<string, KanbanCard[]>;
  stages: string[];
};

function valueLabel(cents: number | null) {
  if (cents == null) return null;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);
}

function KanbanCardView({ card, onDragStart, onClick }: { card: KanbanCard; onDragStart: (e: React.DragEvent, id: string) => void; onClick: () => void }) {
  const didDrag = useRef(false);
  return (
    <div
      draggable
      onDragStart={(e) => { didDrag.current = true; onDragStart(e, card.id); }}
      onClick={() => { if (!didDrag.current) onClick(); didDrag.current = false; }}
      onDragEnd={() => { setTimeout(() => { didDrag.current = false; }, 0); }}
      className="rounded-xl border border-white/10 bg-black/30 p-3 cursor-pointer hover:border-sky-400/30 hover:bg-sky-400/5 transition space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold truncate">{card.name || 'Unnamed'}</div>
        {card.status && (
          <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
            card.status === 'open' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' :
            card.status === 'won' ? 'border-green-400/30 bg-green-400/10 text-green-200' :
            'border-white/10 bg-white/5 text-white/50'
          }`}>{card.status}</span>
        )}
      </div>
      <div className="text-xs text-white/50 space-y-0.5">
        {card.contact_name && <div>{card.contact_name}</div>}
        {card.account_name && <div className="text-white/35">{card.account_name}</div>}
      </div>
      <div className="flex items-center justify-between text-xs">
        {valueLabel(card.estimated_value_cents) && (
          <span className="font-medium text-white/70">{valueLabel(card.estimated_value_cents)}</span>
        )}
        <span className="text-white/35">{card.expected_close_date ? formatWhen(card.expected_close_date) : card.updated_at ? formatWhen(card.updated_at) : ''}</span>
      </div>
    </div>
  );
}

export default function CrmKanbanBoard({ onCardClick }: { onCardClick?: (type: string, id: string, label: string) => void }) {
  const [data, setData] = useState<KanbanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [_draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const dragCard = useRef<{ id: string; fromStage: string } | null>(null);

  const loadKanban = () => {
    setLoading(true);
    fetchJson<{ ok: boolean; columns: Record<string, KanbanCard[]>; stages: string[] }>('/api/v1/crm/kanban')
      .then((result) => {
        setData({ columns: result.columns, stages: result.stages });
      })
      .catch((e) => setError(e?.message || String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadKanban();
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handler = (ev: unknown) => {
      const event = ev as { id: string; stage: string };
      if (event?.id && event?.stage) {
        loadKanban();
      }
    };
    socket.on('opportunity:stage_changed', handler);
    return () => { socket.off('opportunity:stage_changed', handler); };
  }, []);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (!data) return;
    dragCard.current = null;
    for (const [stage, cards] of Object.entries(data.columns)) {
      const found = cards.find((c) => c.id === id);
      if (found) {
        dragCard.current = { id, fromStage: stage };
        break;
      }
    }
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(stage);
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = async (e: React.DragEvent, toStage: string) => {
    e.preventDefault();
    setDropTarget(null);
    setDraggingId(null);

    const id = e.dataTransfer.getData('text/plain');
    if (!id || !dragCard.current) return;
    if (dragCard.current.fromStage === toStage) return;

    try {
      await fetchJson(`/api/v1/crm/opportunities/${id}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: toStage }),
      });
    } catch (err) {
      console.error('stage update failed', err);
      loadKanban();
    }
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropTarget(null);
    dragCard.current = null;
  };

  if (loading) {
    return <ShellCard title="Pipeline" subtitle="Loading opportunities..."><div className="text-sm text-white/50">Loading pipeline...</div></ShellCard>;
  }

  if (error) {
    return <ShellCard title="Pipeline" subtitle="Error loading"><div className="text-sm text-red-200">{error}</div></ShellCard>;
  }

  if (!data) {
    return <ShellCard title="Pipeline" subtitle="No data"><div className="text-sm text-white/50">No pipeline data available.</div></ShellCard>;
  }

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3"
      onDragEnd={handleDragEnd}
    >
      {STAGES.map((stage) => {
        const cards = data.columns[stage] || [];
        const isOver = dropTarget === stage;
        return (
          <div
            key={stage}
            onDragOver={(e) => handleDragOver(e, stage)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, stage)}
            className={`rounded-2xl border border-white/10 bg-black/15 flex flex-col transition-all duration-150 ${
              isOver ? 'border-sky-400/40 bg-sky-400/5 ring-1 ring-sky-400/20' : ''
            }`}
          >
            <div className={`rounded-t-2xl border-t-4 ${STAGE_COLORS[stage] || 'border-t-white/10'} px-3 py-2.5 flex items-center justify-between`}>
              <span className="text-sm font-semibold">{STAGE_LABELS[stage] || stage}</span>
              <span className="text-xs text-white/40 rounded-full bg-white/10 px-2 py-0.5">{cards.length}</span>
            </div>
            <div className="p-2 space-y-2 min-h-[120px] flex-1">
              {cards.length === 0 && (
                <div className="text-xs text-white/30 text-center py-6">Drop opportunities here</div>
              )}
              {cards.map((card) => (
                <KanbanCardView key={card.id} card={card} onDragStart={handleDragStart} onClick={() => onCardClick?.('opportunity', card.id, card.name || card.contact_name || 'Deal')} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

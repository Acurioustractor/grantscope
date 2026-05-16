'use client';

import { useCallback, useMemo, useState } from 'react';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import {
  AGE_BUCKET_COLORS,
  AGE_BUCKET_LABELS,
  AGE_BUCKET_ORDER,
  DECISION_COLORS,
  DECISION_LABELS,
  PAYABLE_DECISION_COLUMNS,
  type AgeBucket,
  type OrgPayablesData,
  type PayableCard,
  type PayableDecision,
} from '@/lib/services/org-payables-service';
import {
  PAYEE_CATEGORY_COLORS,
  PAYEE_CATEGORY_LABELS,
} from '@/lib/services/org-income-service';

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `$${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' });
}

export function PayablesKanban({
  cards: initialCards,
  totals,
}: {
  cards: PayableCard[];
  totals: OrgPayablesData['totals'];
}) {
  const [cards, setCards] = useState<PayableCard[]>(initialCards);
  const [bucketFilter, setBucketFilter] = useState<AgeBucket | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bulk-select: track selected invoice_ids; floating bar appears when non-empty.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const filtered = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    return cards.filter((c) => {
      if (bucketFilter !== 'all' && c.age_bucket !== bucketFilter) return false;
      if (categoryFilter !== 'all' && c.payee_category !== categoryFilter) return false;
      if (search) {
        const hay = `${c.payee_name} ${c.invoice_number ?? ''} ${c.reference ?? ''} ${c.project_code ?? ''}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  }, [cards, bucketFilter, categoryFilter, searchQuery]);

  const byColumn = useMemo(() => {
    const m = new Map<PayableDecision, PayableCard[]>();
    for (const col of PAYABLE_DECISION_COLUMNS) m.set(col, []);
    for (const c of filtered) m.get(c.decision)!.push(c);
    for (const list of m.values()) list.sort((a, b) => b.days_old - a.days_old);
    return m;
  }, [filtered]);

  const columnTotals = useMemo(() => {
    const m = new Map<PayableDecision, number>();
    for (const col of PAYABLE_DECISION_COLUMNS) m.set(col, 0);
    for (const c of filtered) m.set(c.decision, (m.get(c.decision) ?? 0) + c.total);
    return m;
  }, [filtered]);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const c of cards) set.add(c.payee_category);
    return Array.from(set).sort();
  }, [cards]);

  const selectedTotal = useMemo(() => {
    let sum = 0;
    for (const c of cards) if (selectedIds.has(c.invoice_id)) sum += c.total;
    return sum;
  }, [cards, selectedIds]);

  const toggleColumnSelection = useCallback(
    (col: PayableDecision) => {
      const colCards = byColumn.get(col) ?? [];
      const allSelected = colCards.every((c) => selectedIds.has(c.invoice_id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (allSelected) {
          for (const c of colCards) next.delete(c.invoice_id);
        } else {
          for (const c of colCards) next.add(c.invoice_id);
        }
        return next;
      });
    },
    [byColumn, selectedIds],
  );

  const bulkDecide = useCallback(
    async (decision: PayableDecision) => {
      const invoiceIds = Array.from(selectedIds);
      if (invoiceIds.length === 0) return;
      setError(null);
      setBulkPending(true);

      const previous = cards;
      const nowIso = new Date().toISOString();
      setCards(previous.map((c) =>
        selectedIds.has(c.invoice_id) ? { ...c, decision, decided_at: nowIso } : c,
      ));

      try {
        const res = await fetch('/api/ops/payables/decide-bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invoice_ids: invoiceIds, decision }),
        });
        if (!res.ok) throw new Error(await res.text());
        clearSelection();
      } catch (err) {
        console.error('bulk decision failed', err);
        setError(`Bulk decision failed: ${(err as Error).message}`);
        setCards(previous);
      } finally {
        setBulkPending(false);
      }
    },
    [cards, selectedIds, clearSelection],
  );

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      setError(null);
      if (!result.destination) return;
      const next = result.destination.droppableId as PayableDecision;
      const cardKey = result.draggableId;
      const card = cards.find((c) => c.key === cardKey);
      if (!card || card.decision === next) return;
      if (!PAYABLE_DECISION_COLUMNS.includes(next)) return;

      const previous = cards;
      const nowIso = new Date().toISOString();
      setCards(previous.map((c) => (c.key === cardKey ? { ...c, decision: next, decided_at: nowIso } : c)));
      setPendingKey(cardKey);

      fetch('/api/ops/payables/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: card.invoice_id, decision: next }),
      })
        .then(async (r) => {
          if (!r.ok) throw new Error(await r.text());
          return r.json();
        })
        .catch((err) => {
          console.error('payable decision failed', err);
          setError(`Decision write failed: ${(err as Error).message}`);
          setCards(previous);
        })
        .finally(() => setPendingKey(null));
    },
    [cards],
  );

  return (
    <div>
      {/* Top totals strip */}
      <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-0 border-4 border-bauhaus-black bg-white">
        <div className="border-r-4 border-bauhaus-black px-4 py-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Total payables</div>
          <div className="text-2xl font-black tabular-nums text-bauhaus-black">{fmtMoney(totals.total)}</div>
          <div className="text-[10px] font-mono text-bauhaus-muted mt-0.5">{totals.bill_count} bills</div>
        </div>
        <div className="border-r-4 border-bauhaus-black px-4 py-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Decided</div>
          <div className="text-2xl font-black tabular-nums text-green-700">{totals.decided_count}</div>
          <div className="text-[10px] font-mono text-bauhaus-muted mt-0.5">{Math.round((totals.decided_count / Math.max(1, totals.bill_count)) * 100)}% triaged</div>
        </div>
        <div className="border-r-4 border-bauhaus-black px-4 py-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Overdue 60d+</div>
          <div className="text-2xl font-black tabular-nums text-bauhaus-red">{fmtMoney(totals.overdue_60d_total)}</div>
          <div className="text-[10px] font-mono text-bauhaus-muted mt-0.5">{totals.overdue_60d_count} bills</div>
        </div>
        <div className="px-4 py-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Showing</div>
          <div className="text-2xl font-black tabular-nums text-bauhaus-black">{filtered.length}</div>
          <div className="text-[10px] font-mono text-bauhaus-muted mt-0.5">of {cards.length} bills</div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 border-4 border-bauhaus-black bg-bauhaus-canvas p-3 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search payee, invoice, project…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-[220px] border-2 border-bauhaus-black bg-white px-3 py-1.5 text-sm font-mono placeholder:text-bauhaus-muted"
        />
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-black uppercase tracking-widest">Age</label>
          <select
            value={bucketFilter}
            onChange={(e) => setBucketFilter(e.target.value as typeof bucketFilter)}
            className="border-2 border-bauhaus-black bg-white px-2 py-1 text-xs font-mono"
          >
            <option value="all">All</option>
            {AGE_BUCKET_ORDER.map((b) => (
              <option key={b} value={b}>{AGE_BUCKET_LABELS[b]}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-black uppercase tracking-widest">Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border-2 border-bauhaus-black bg-white px-2 py-1 text-xs font-mono"
          >
            <option value="all">All</option>
            {allCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-3 border-2 border-bauhaus-red bg-bauhaus-red/5 px-3 py-2 text-xs font-mono text-bauhaus-red">
          {error}
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-6">
          {PAYABLE_DECISION_COLUMNS.map((col) => {
            const colCards = byColumn.get(col) ?? [];
            const colSum = columnTotals.get(col) ?? 0;
            return (
              <Droppable key={col} droppableId={col}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-shrink-0 w-72 min-h-[400px] border-4 border-bauhaus-black ${
                      snapshot.isDraggingOver ? 'bg-bauhaus-yellow/10' : 'bg-bauhaus-canvas'
                    }`}
                  >
                    <div className={`${DECISION_COLORS[col]} px-3 py-2 border-b-4 border-bauhaus-black`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-widest">{DECISION_LABELS[col]}</span>
                        <span className="text-xs font-bold tabular-nums">{colCards.length}</span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[10px] font-mono tabular-nums opacity-80">{fmtMoney(colSum)}</span>
                        {colCards.length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleColumnSelection(col)}
                            className="text-[9px] font-black uppercase tracking-wider underline underline-offset-2 hover:no-underline opacity-90 hover:opacity-100"
                            title="Toggle select all in this column"
                          >
                            {colCards.every((c) => selectedIds.has(c.invoice_id)) ? 'Deselect all' : 'Select all'}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="p-2 space-y-2">
                      {colCards.length === 0 && (
                        <div className="text-[10px] font-mono text-bauhaus-muted italic px-1 py-3 text-center">
                          {col === 'undecided' ? 'All decided.' : `Drag bills here to mark ${DECISION_LABELS[col]}.`}
                        </div>
                      )}
                      {colCards.map((card, idx) => (
                        <Draggable key={card.key} draggableId={card.key} index={idx}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={`border-2 bg-white p-2 transition-colors ${
                                dragSnapshot.isDragging ? 'border-bauhaus-red shadow-lg' : selectedIds.has(card.invoice_id) ? 'border-bauhaus-red' : 'border-bauhaus-black'
                              } ${pendingKey === card.key ? 'opacity-50' : ''} ${
                                selectedIds.has(card.invoice_id) ? 'bg-bauhaus-red/5' : ''
                              }`}
                            >
                              <div className="flex items-start gap-1 flex-wrap mb-1">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(card.invoice_id)}
                                  onChange={(e) => { e.stopPropagation(); toggleSelected(card.invoice_id); }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-3.5 h-3.5 border-2 border-bauhaus-black cursor-pointer mr-1"
                                  aria-label={`Select ${card.payee_name}`}
                                />
                                <span className={`px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${AGE_BUCKET_COLORS[card.age_bucket]}`}>
                                  {card.days_old}d
                                </span>
                                <span className={`px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${PAYEE_CATEGORY_COLORS[card.payee_category]}`}>
                                  {PAYEE_CATEGORY_LABELS[card.payee_category]}
                                </span>
                                {card.project_code && (
                                  <span className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider border-2 border-bauhaus-black bg-bauhaus-black text-white">
                                    {card.project_code}
                                  </span>
                                )}
                              </div>

                              <div className="text-sm font-black text-bauhaus-black leading-snug line-clamp-2">
                                {card.payee_name}
                              </div>
                              {card.invoice_number && (
                                <div className="text-[10px] font-mono text-bauhaus-muted mt-0.5">
                                  {card.invoice_number}
                                  {card.reference && ` · ${card.reference}`}
                                </div>
                              )}

                              <div className="flex items-center justify-between mt-2 text-[10px] font-mono">
                                <span className="text-bauhaus-muted">{fmtDate(card.invoice_date)}</span>
                                <span className="font-black text-bauhaus-black tabular-nums">{fmtMoney(card.total)}</span>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>

      {/* Floating bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t-4 border-bauhaus-red bg-bauhaus-black text-white shadow-2xl">
          <div className="mx-auto max-w-[1600px] px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 text-xs font-black uppercase tracking-widest bg-bauhaus-red text-white">
                {selectedIds.size} selected
              </span>
              <span className="text-sm font-mono tabular-nums">{fmtMoney(selectedTotal)} total</span>
              <button
                type="button"
                onClick={clearSelection}
                className="text-[11px] font-mono text-gray-400 hover:text-white underline underline-offset-2"
              >
                clear selection
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mr-1 self-center">
                Mark as:
              </span>
              {PAYABLE_DECISION_COLUMNS.filter((c) => c !== 'undecided').map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => bulkDecide(col)}
                  disabled={bulkPending}
                  className={`px-3 py-1.5 text-xs font-black uppercase tracking-widest border-2 border-white ${DECISION_COLORS[col]} hover:bg-white hover:text-bauhaus-black disabled:opacity-50`}
                >
                  {DECISION_LABELS[col]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

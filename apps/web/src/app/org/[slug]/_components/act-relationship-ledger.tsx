'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildActRelationshipTimeline, type ActRelationshipBalance, type ActRelationshipExchangeSuggestion, type ActRelationshipLedger as LedgerData, type ActRelationshipLedgerItem } from '@/lib/services/act-relationship-ledger';

type Filter = 'action' | 'repeat' | 'exchange' | 'all';

const BALANCE_LABELS: Record<ActRelationshipBalance, string> = {
  awaiting_payment: 'Awaiting payment',
  mutual_flow: 'Money moved both ways',
  repeat_paid: 'Repeat paid work',
  paid_once: 'Paid work',
  exchange_only: 'Relationship exchange',
  not_realised: 'Not yet realised',
};

export function ActRelationshipLedger({ data, orgProfileId, initialSelectedKey }: { data: LedgerData | null; orgProfileId: string; initialSelectedKey?: string }) {
  const [filter, setFilter] = useState<Filter>('action');
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState(initialSelectedKey && data?.items.some((item) => item.key === initialSelectedKey) ? initialSelectedKey : data?.items[0]?.key ?? '');
  const visible = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    return data.items.filter((item) => {
      if (filter === 'action' && item.outstandingTotal <= 0 && item.followUp?.status !== 'planned' && !item.contributions.some((contribution) => contribution.payment === 'unpaid')) return false;
      if (filter === 'repeat' && item.paidInvoiceCount <= 1) return false;
      if (filter === 'exchange' && item.contributions.length === 0) return false;
      if (!needle) return true;
      return [item.organisation, ...item.projectCodes, ...item.work, ...item.people.map((person) => person.name), ...item.contributions.flatMap((contribution) => [contribution.summary, contribution.person ?? ''])]
        .join(' ').toLowerCase().includes(needle);
    });
  }, [data, filter, query]);
  const selected = visible.find((item) => item.key === selectedKey) ?? visible[0] ?? null;

  if (!data) return <div className="p-6 text-sm text-[var(--ws-text-secondary)]">Relationship ledger is unavailable.</div>;

  return (
    <div className="min-w-0">
      <div className="grid grid-cols-2 divide-x divide-y divide-[var(--ws-border)] border-b border-[var(--ws-border)] sm:grid-cols-4 sm:divide-y-0">
        <LedgerMetric label="Received" value={money(data.summary.receivedTotal)} />
        <LedgerMetric label="Still owed" value={money(data.summary.outstandingTotal)} warning />
        <LedgerMetric label="Organisations" value={String(data.summary.organisations)} />
        <LedgerMetric label="Paid invoices" value={String(data.summary.paidInvoices)} />
      </div>
      <div className="border-b border-[var(--ws-border)] bg-[#f8f9f5] px-4 py-3 sm:px-6">
        <ContributionRecorder orgProfileId={orgProfileId} buttonLabel="New relationship exchange" testId="new-relationship-exchange" className="mt-0" />
        <SuggestedExchangeQueue initialSuggestions={data.suggestions} orgProfileId={orgProfileId} />
      </div>

      <div className="grid min-w-0 lg:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-[var(--ws-border)] bg-[var(--ws-surface-2)] lg:border-b-0 lg:border-r">
          <div className="border-b border-[var(--ws-border)] p-4">
            <label className="block">
              <span className="sr-only">Search organisations, people, projects, and work</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search relationships"
                className="min-h-11 w-full rounded-md border border-[var(--ws-border)] bg-white px-3 text-sm outline-none focus:border-[#2f6b4a] focus:ring-2 focus:ring-[#2f6b4a]/15"
              />
            </label>
            <div className="mt-3 flex gap-1" aria-label="Relationship ledger filters">
              {([['action', 'Needs action'], ['repeat', 'Repeat'], ['exchange', 'Exchange'], ['all', 'All']] as Array<[Filter, string]>).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setFilter(value)} className={`min-h-10 rounded-md px-3 text-xs font-semibold ${filter === value ? 'bg-[#183426] text-white' : 'text-[var(--ws-text-secondary)] hover:bg-white'}`}>{label}</button>
              ))}
            </div>
            <div className="mt-3 font-mono text-[9px] uppercase text-[var(--ws-text-tertiary)]">{visible.length} relationships</div>
          </div>
          <div className="max-h-[760px] divide-y divide-[var(--ws-border)] overflow-y-auto">
            {visible.map((item) => (
              <button key={item.key} type="button" onClick={() => setSelectedKey(item.key)} className={`block min-h-[96px] w-full px-4 py-4 text-left ${selected?.key === item.key ? 'bg-white shadow-[inset_3px_0_0_#2f6b4a]' : 'hover:bg-white/80'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="line-clamp-2 min-w-0 text-sm font-semibold leading-snug text-[var(--ws-text)]">{item.organisation}</div>
                  <span className="shrink-0 font-mono text-xs font-semibold text-[var(--ws-text)]">{money(item.receivedTotal)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <BalancePill balance={item.balance} />
                  <span className={`font-mono text-[9px] ${item.outstandingTotal > 0 ? 'font-semibold text-red-700' : 'text-[var(--ws-text-tertiary)]'}`}>
                    {item.outstandingTotal > 0 ? `${money(item.outstandingTotal)} owed` : item.followUp?.status === 'planned' ? `follow-up ${date(item.followUp.dueAt)}` : item.contributions.length > 0 ? `${item.contributions.length} exchange${item.contributions.length === 1 ? '' : 's'}` : `${item.paidInvoiceCount} paid`}
                  </span>
                </div>
              </button>
            ))}
            {visible.length === 0 ? <div className="p-5 text-sm text-[var(--ws-text-secondary)]">No relationships match this view.</div> : null}
          </div>
        </aside>

        <main className="min-w-0 bg-white">
          {selected ? (
            <div>
              <header className="border-b border-[var(--ws-border)] px-5 py-6 sm:px-7">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <BalancePill balance={selected.balance} />
                    <h3 className="mt-3 text-xl font-semibold leading-tight text-[var(--ws-text)]">{selected.organisation}</h3>
                    <p className="mt-2 text-xs text-[var(--ws-text-secondary)]">
                      {selected.firstInvoiceAt ? `Since ${date(selected.firstInvoiceAt)} · ${selected.invoiceCount} invoices` : `No invoice yet · ${selected.contributions.length} exchange${selected.contributions.length === 1 ? '' : 's'}`} · {selected.projectCodes.join(' · ') || 'No project code'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-y divide-[var(--ws-border)] border border-[var(--ws-border)] sm:grid-cols-4 sm:divide-y-0">
                    <CompactMetric label="Received" value={money(selected.receivedTotal)} />
                    <CompactMetric label="Owed" value={money(selected.outstandingTotal)} warning={selected.outstandingTotal > 0} />
                    <CompactMetric label="ACT paid" value={money(selected.actPaidThemTotal)} />
                    <CompactMetric label="Conversations" value={String(selected.conversations.length)} />
                  </div>
                </div>
              </header>

              <section className="border-b border-[var(--ws-border)] bg-[#edf3ee] px-5 py-5 sm:px-7">
                <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#2f6b4a]">Next relationship move</div>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-[#183426]">{selected.nextMove}</p>
                <RelationshipFollowUpPlanner key={selected.key} organisation={selected.organisation} followUp={selected.followUp} suggestedAction={selected.nextMove} orgProfileId={orgProfileId} />
                <ContributionRecorder organisation={selected.organisation} orgProfileId={orgProfileId} />
              </section>

              <RelationshipHistory key={selected.key} item={selected} />

              <section className="border-b border-[var(--ws-border)] px-5 py-6 sm:px-7">
                <SectionHeading title="People" value={`${selected.people.length} known`} />
                {selected.people.length > 0 ? <div className="mt-3 grid gap-x-6 sm:grid-cols-2">{selected.people.slice(0, 8).map((person) => (
                  <div key={person.id} className="border-b border-[var(--ws-border)] py-3">
                    <div className="text-sm font-semibold">{person.name}</div>
                    <div className="mt-1 text-xs text-[var(--ws-text-secondary)]">{person.role || person.email || person.source}</div>
                  </div>
                ))}</div> : <EmptyLine text="No named relationship person is linked." />}
              </section>

              <footer className="border-t border-[var(--ws-border)] bg-[#f8f9f5] px-5 py-4 text-xs text-[var(--ws-text-secondary)] sm:px-7">
                {selected.evidenceGaps.length > 0 ? `Missing: ${selected.evidenceGaps.join(' · ')}` : 'Relationship evidence connected.'}
              </footer>
            </div>
          ) : <div className="p-8 text-sm text-[var(--ws-text-secondary)]">Select a relationship.</div>}
        </main>
      </div>
    </div>
  );
}

function RelationshipFollowUpPlanner({ organisation, followUp, suggestedAction, orgProfileId }: { organisation: string; followUp: ActRelationshipLedgerItem['followUp']; suggestedAction: string; orgProfileId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState(followUp?.action ?? suggestedAction);
  const [owner, setOwner] = useState(followUp?.owner === 'Unassigned' ? '' : followUp?.owner ?? '');
  const [dueAt, setDueAt] = useState(followUp?.dueAt ?? futureDateValue(7));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action.trim() || !owner.trim() || !dueAt) return;
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/org/${encodeURIComponent(orgProfileId)}/relationship-follow-ups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organisation, action: action.trim(), owner: owner.trim(), due_at: dueAt }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not save the follow-up');
      setOpen(false);
      setMessage('Follow-up planned.');
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not save the follow-up');
    } finally {
      setPending(false);
    }
  }

  async function complete() {
    if (!followUp) return;
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/org/${encodeURIComponent(orgProfileId)}/relationship-follow-ups`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follow_up_id: followUp.id, status: 'completed' }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not complete the follow-up');
      setMessage('Follow-up completed.');
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not complete the follow-up');
    } finally {
      setPending(false);
    }
  }

  const active = followUp?.status === 'planned';
  return (
    <div className="mt-4 border-t border-[#cbd9ce] pt-4" data-testid="relationship-follow-up">
      {active && !open ? (
        <div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-relaxed text-[#183426]">{followUp.action}</p>
              <p className="mt-1 font-mono text-[9px] uppercase text-[#56715f]">{followUp.owner} · {date(followUp.dueAt)}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" disabled={pending} onClick={() => setOpen(true)} className="min-h-10 rounded-md border border-[#aac0af] bg-white px-3 text-xs font-semibold text-[#183426] disabled:opacity-50">Edit plan</button>
              <button type="button" disabled={pending} onClick={() => void complete()} className="min-h-10 rounded-md bg-[#183426] px-3 text-xs font-semibold text-white disabled:opacity-50">Complete</button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <button type="button" onClick={() => setOpen((value) => !value)} className="min-h-10 rounded-md border border-[#aac0af] bg-white px-3 text-xs font-semibold text-[#183426] hover:bg-[#f8faf8]">{open ? 'Close plan' : followUp ? 'Plan next follow-up' : 'Plan follow-up'}</button>
          {open ? <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_150px]">
            <label className="text-xs font-semibold text-[#4f6657]">Next action
              <textarea required rows={2} value={action} onChange={(event) => setAction(event.target.value)} className="mt-1 w-full rounded-md border border-[#cbd9ce] bg-white px-3 py-2 text-sm text-[#183426]" />
            </label>
            <label className="text-xs font-semibold text-[#4f6657]">Owner
              <input required value={owner} onChange={(event) => setOwner(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-[#cbd9ce] bg-white px-3 text-sm text-[#183426]" />
            </label>
            <label className="text-xs font-semibold text-[#4f6657]">Due
              <input required type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-[#cbd9ce] bg-white px-3 text-sm text-[#183426]" />
            </label>
            <button type="submit" disabled={pending || !action.trim() || !owner.trim() || !dueAt} className="min-h-11 rounded-md bg-[#183426] px-4 text-xs font-semibold text-white disabled:opacity-50 sm:col-span-3 sm:justify-self-start">{pending ? 'Saving...' : 'Save follow-up'}</button>
          </form> : null}
        </div>
      )}
      {message ? <div role="status" className="mt-2 text-xs text-[#4f6657]">{message}</div> : null}
    </div>
  );
}

function RelationshipHistory({ item }: { item: ActRelationshipLedgerItem }) {
  const [tab, setTab] = useState<'story' | 'invoices'>('story');
  const timeline = useMemo(() => buildActRelationshipTimeline(item), [item]);

  return (
    <section className="border-b border-[var(--ws-border)] px-5 py-6 sm:px-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading title="Relationship history" value={`${timeline.length} moments`} />
        <div role="tablist" aria-label="Relationship history views" className="flex gap-1 rounded-md bg-[var(--ws-surface-2)] p-1">
          {([['story', 'Story'], ['invoices', `Invoices ${item.invoiceCount}`]] as const).map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`min-h-9 rounded px-3 text-xs font-semibold ${tab === value ? 'bg-white text-[var(--ws-text)] shadow-sm' : 'text-[var(--ws-text-secondary)]'}`}>{label}</button>
          ))}
        </div>
      </div>

      {tab === 'story' ? (
        timeline.length > 0 ? <div className="mt-4 divide-y divide-[var(--ws-border)] border-y border-[var(--ws-border)]">
          {timeline.map((event) => (
            <div key={event.id} className="grid gap-2 py-4 sm:grid-cols-[90px_minmax(0,1fr)_120px]">
              <div>
                <div className="font-mono text-[9px] text-[var(--ws-text-tertiary)]">{date(event.happenedAt)}</div>
                <div className={`mt-2 inline-block rounded border px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase ${timelineKindClass(event.kind)}`}>{event.kind}</div>
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-semibold leading-snug text-[var(--ws-text)]">{event.title}</h4>
                <p className="mt-1 text-xs leading-relaxed text-[var(--ws-text-secondary)]">{event.summary}</p>
                <p className="mt-2 font-mono text-[9px] uppercase text-[var(--ws-text-tertiary)]">{[event.source, event.person].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="sm:text-right">
                {event.amount != null ? <div className={`font-mono text-xs font-semibold ${event.kind === 'payment' ? 'text-emerald-700' : 'text-[var(--ws-text)]'}`}>{money(event.amount)}</div> : null}
                {event.status ? <div className={`mt-1 font-mono text-[9px] uppercase ${event.status === 'unpaid' || event.status === 'AUTHORISED' ? 'text-red-700' : 'text-[var(--ws-text-tertiary)]'}`}>{event.status.replaceAll('_', ' ')}</div> : null}
              </div>
            </div>
          ))}
        </div> : <EmptyLine text="No invoices, exchanges, or conversations are connected yet." />
      ) : (
        item.invoices.length > 0 ? <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left">
            <thead>
              <tr className="border-y border-[var(--ws-border)] font-mono text-[9px] uppercase text-[var(--ws-text-tertiary)]">
                <th className="py-2 pr-3">Invoice</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3 text-right">Total</th><th className="py-2 pr-3 text-right">Paid</th><th className="py-2 text-right">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ws-border)]">
              {item.invoices.map((invoice) => (
                <tr key={invoice.id} className="text-xs">
                  <td className="py-3 pr-3 font-mono font-semibold">{invoice.number || 'No number'}{invoice.projectCode ? <div className="mt-1 text-[9px] font-normal text-[var(--ws-text-tertiary)]">{invoice.projectCode}</div> : null}</td>
                  <td className="py-3 pr-3 text-[var(--ws-text-secondary)]">{date(invoice.date)}</td>
                  <td className="py-3 pr-3"><InvoiceStatus status={invoice.status} overdue={invoice.daysOverdue} /></td>
                  <td className="py-3 pr-3 text-right font-mono">{money(invoice.total)}</td>
                  <td className="py-3 pr-3 text-right font-mono text-emerald-700">{money(invoice.paid)}</td>
                  <td className={`py-3 text-right font-mono ${invoice.due > 0 ? 'font-semibold text-red-700' : 'text-[var(--ws-text-tertiary)]'}`}>{money(invoice.due)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div> : <EmptyLine text="No invoice has been sent for this relationship yet." />
      )}
    </section>
  );
}

function timelineKindClass(kind: ReturnType<typeof buildActRelationshipTimeline>[number]['kind']): string {
  if (kind === 'payment') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (kind === 'invoice') return 'border-stone-200 bg-stone-50 text-stone-700';
  if (kind === 'exchange') return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-violet-200 bg-violet-50 text-violet-700';
}

function SuggestedExchangeQueue({ initialSuggestions, orgProfileId }: { initialSuggestions: ActRelationshipExchangeSuggestion[]; orgProfileId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function updateSuggestion(id: string, updates: Partial<ActRelationshipExchangeSuggestion>) {
    setSuggestions((current) => current.map((suggestion) => suggestion.id === id ? { ...suggestion, ...updates } : suggestion));
  }

  async function review(suggestion: ActRelationshipExchangeSuggestion, decision: 'confirmed' | 'dismissed') {
    setPendingId(suggestion.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/org/${encodeURIComponent(orgProfileId)}/relationship-contributions`, {
        method: decision === 'confirmed' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(decision === 'confirmed' ? {
          organisation: suggestion.organisation,
          direction: suggestion.direction,
          contribution_type: suggestion.kind,
          payment_state: suggestion.payment,
          summary: suggestion.summary,
          person: suggestion.person,
          amount: null,
          happened_at: suggestion.happenedAt?.slice(0, 10) || localDateValue(),
          source_event_id: suggestion.id,
        } : {
          source_event_id: suggestion.id,
          decision: 'dismissed',
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not review the suggestion');
      setSuggestions((current) => current.filter((item) => item.id !== suggestion.id));
      setMessage(decision === 'confirmed' ? 'Exchange confirmed.' : 'Suggestion dismissed.');
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not review the suggestion');
    } finally {
      setPendingId(null);
    }
  }

  if (initialSuggestions.length === 0 && suggestions.length === 0) return null;
  const suggestion = suggestions[0] ?? null;

  return (
    <div className="mt-2 min-w-0" data-testid="suggested-exchange-queue">
      <button type="button" onClick={() => setOpen((value) => !value)} className="min-h-10 rounded-md border border-[#d3d8d0] bg-white px-3 text-xs font-semibold text-[#183426] hover:bg-[#f3f6f2]">
        {open ? 'Close suggestions' : `Review ${suggestions.length} suggested exchange${suggestions.length === 1 ? '' : 's'}`}
      </button>
      {message ? <span role="status" className="ml-3 text-xs text-[#4f6657]">{message}</span> : null}
      {open ? (
        <div className="mt-4 divide-y divide-[#d9ded7] border-t border-[#d9ded7]" aria-label="Suggested exchanges">
          {suggestion ? (
            <article key={suggestion.id} className="py-4">
              <div className="mb-3 font-mono text-[9px] font-semibold uppercase text-[#6d7b70]">Review 1 of {suggestions.length}</div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="font-mono text-[9px] font-semibold uppercase text-[#56715f]">{suggestion.source} · {date(suggestion.happenedAt)}</div>
                  <h4 className="mt-1 text-sm font-semibold text-[#183426]">{suggestion.organisation}</h4>
                  <p className="mt-1 text-xs font-semibold text-[#344a3b]">{suggestion.title}</p>
                  <p className="mt-2 max-w-3xl text-xs leading-relaxed text-[#5d6b61]">{suggestion.summary}</p>
                  <p className="mt-2 font-mono text-[9px] uppercase text-[#6d7b70]">{suggestion.reason}</p>
                </div>
                <div className="grid shrink-0 grid-cols-3 gap-2 sm:w-[360px]">
                  <label className="text-[10px] font-semibold text-[#4f6657]">Direction
                    <select aria-label={`Direction for ${suggestion.organisation}`} value={suggestion.direction} onChange={(event) => updateSuggestion(suggestion.id, { direction: event.target.value as ActRelationshipExchangeSuggestion['direction'] })} className="mt-1 min-h-10 w-full rounded-md border border-[#cbd9ce] bg-white px-2 text-xs text-[#183426]">
                      <option value="given">Given</option><option value="received">Received</option>
                    </select>
                  </label>
                  <label className="text-[10px] font-semibold text-[#4f6657]">Type
                    <select aria-label={`Type for ${suggestion.organisation}`} value={suggestion.kind} onChange={(event) => updateSuggestion(suggestion.id, { kind: event.target.value })} className="mt-1 min-h-10 w-full rounded-md border border-[#cbd9ce] bg-white px-2 text-xs text-[#183426]">
                      {['work', 'introduction', 'advice', 'space', 'art', 'event', 'support', 'other'].map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
                    </select>
                  </label>
                  <label className="text-[10px] font-semibold text-[#4f6657]">Payment
                    <select aria-label={`Payment for ${suggestion.organisation}`} value={suggestion.payment} onChange={(event) => updateSuggestion(suggestion.id, { payment: event.target.value as ActRelationshipExchangeSuggestion['payment'] })} className="mt-1 min-h-10 w-full rounded-md border border-[#cbd9ce] bg-white px-2 text-xs text-[#183426]">
                      <option value="not_expected">Not expected</option><option value="unpaid">Unpaid</option><option value="paid">Paid</option><option value="unknown">Unknown</option>
                    </select>
                  </label>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" disabled={pendingId === suggestion.id} onClick={() => review(suggestion, 'confirmed')} className="min-h-10 rounded-md bg-[#183426] px-3 text-xs font-semibold text-white disabled:opacity-50">Confirm exchange</button>
                <button type="button" disabled={pendingId === suggestion.id} onClick={() => review(suggestion, 'dismissed')} className="min-h-10 rounded-md px-3 text-xs font-semibold text-[#5d6b61] hover:bg-white disabled:opacity-50">Dismiss</button>
              </div>
            </article>
          ) : null}
          {suggestions.length === 0 ? <p className="py-4 text-xs text-[#5d6b61]">No suggested exchanges remain.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function ContributionRecorder({ organisation, orgProfileId, buttonLabel = 'Record exchange', testId, className = 'mt-4' }: { organisation?: string; orgProfileId: string; buttonLabel?: string; testId?: string; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<'given' | 'received'>('given');
  const [kind, setKind] = useState('work');
  const [payment, setPayment] = useState('unpaid');
  const [summary, setSummary] = useState('');
  const [organisationName, setOrganisationName] = useState('');
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [happenedAt, setHappenedAt] = useState(localDateValue);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedOrganisation = (organisation ?? organisationName).trim();
    if (!summary.trim() || !submittedOrganisation) return;
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/org/${encodeURIComponent(orgProfileId)}/relationship-contributions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organisation: submittedOrganisation,
          direction,
          contribution_type: kind,
          payment_state: payment,
          summary: summary.trim(),
          person: person.trim() || null,
          amount: amount || null,
          happened_at: happenedAt,
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not record the exchange');
      setSummary('');
      if (!organisation) setOrganisationName('');
      setPerson('');
      setAmount('');
      setHappenedAt(localDateValue());
      setOpen(false);
      setMessage('Exchange recorded.');
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not record the exchange');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={className} data-testid={testId}>
      <button type="button" onClick={() => setOpen((value) => !value)} className="min-h-10 rounded-md border border-[#aac0af] bg-white px-3 text-xs font-semibold text-[#183426] hover:bg-[#f8faf8]">{open ? 'Close exchange' : buttonLabel}</button>
      {message ? <span role="status" className="ml-3 text-xs text-[#4f6657]">{message}</span> : null}
      {open ? (
        <form onSubmit={submit} className="mt-4 border-t border-[#cbd9ce] pt-4">
          {!organisation ? <label className="mb-3 block text-xs font-semibold text-[#4f6657]">Organisation
            <input required value={organisationName} onChange={(event) => setOrganisationName(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-[#cbd9ce] bg-white px-3 text-sm text-[#183426]" />
          </label> : null}
          <div className="flex gap-1" aria-label="Exchange direction">
            {(['given', 'received'] as const).map((value) => <button key={value} type="button" onClick={() => setDirection(value)} className={`min-h-10 rounded-md px-3 text-xs font-semibold capitalize ${direction === value ? 'bg-[#183426] text-white' : 'bg-white text-[#4f6657]'}`}>{value}</button>)}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="block text-xs font-semibold text-[#4f6657]">Contribution
              <select value={kind} onChange={(event) => setKind(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-[#cbd9ce] bg-white px-3 text-sm text-[#183426]">
                {['work', 'introduction', 'advice', 'space', 'art', 'event', 'support', 'other'].map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-[#4f6657]">Payment
              <select value={payment} onChange={(event) => setPayment(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-[#cbd9ce] bg-white px-3 text-sm text-[#183426]">
                <option value="unpaid">Unpaid</option><option value="paid">Paid</option><option value="not_expected">Not expected</option><option value="unknown">Unknown</option>
              </select>
            </label>
            <label className="block text-xs font-semibold text-[#4f6657]">Amount
              <input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Optional" className="mt-1 min-h-11 w-full rounded-md border border-[#cbd9ce] bg-white px-3 text-sm text-[#183426]" />
            </label>
          </div>
          <label className="mt-3 block text-xs font-semibold text-[#4f6657]">What happened
            <textarea required value={summary} onChange={(event) => setSummary(event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-[#cbd9ce] bg-white px-3 py-2 text-sm text-[#183426]" />
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-[#4f6657]">Person
              <input value={person} onChange={(event) => setPerson(event.target.value)} placeholder="Optional" className="mt-1 min-h-11 w-full rounded-md border border-[#cbd9ce] bg-white px-3 text-sm text-[#183426]" />
            </label>
            <label className="block text-xs font-semibold text-[#4f6657]">Date
              <input required type="date" value={happenedAt} onChange={(event) => setHappenedAt(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-[#cbd9ce] bg-white px-3 text-sm text-[#183426]" />
            </label>
          </div>
          <button type="submit" disabled={pending || !summary.trim() || !(organisation ?? organisationName).trim()} className="mt-3 min-h-11 rounded-md bg-[#183426] px-4 text-xs font-semibold text-white disabled:opacity-50">{pending ? 'Recording...' : 'Save exchange'}</button>
        </form>
      ) : null}
    </div>
  );
}

function LedgerMetric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div className="min-w-0 px-4 py-4 text-center"><div className={`font-mono text-lg font-semibold ${warning ? 'text-red-700' : 'text-[var(--ws-text)]'}`}>{value}</div><div className="mt-1 font-mono text-[8px] font-semibold uppercase text-[var(--ws-text-tertiary)]">{label}</div></div>;
}

function CompactMetric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div className="min-w-[92px] px-3 py-3 text-center"><div className={`font-mono text-sm font-semibold ${warning ? 'text-red-700' : 'text-[var(--ws-text)]'}`}>{value}</div><div className="mt-1 font-mono text-[8px] uppercase text-[var(--ws-text-tertiary)]">{label}</div></div>;
}

function BalancePill({ balance }: { balance: ActRelationshipBalance }) {
  const classes = balance === 'awaiting_payment' ? 'border-red-200 bg-red-50 text-red-700' : balance === 'mutual_flow' || balance === 'exchange_only' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return <span className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase ${classes}`}>{BALANCE_LABELS[balance]}</span>;
}

function InvoiceStatus({ status, overdue }: { status: string; overdue: number }) {
  const classes = status === 'PAID' ? 'text-emerald-700' : status === 'AUTHORISED' ? 'text-red-700' : 'text-[var(--ws-text-tertiary)]';
  return <span className={`font-mono text-[9px] font-semibold ${classes}`}>{status}{overdue > 0 ? ` · ${overdue}d` : ''}</span>;
}

function SectionHeading({ title, value }: { title: string; value: string }) {
  return <div className="flex items-center justify-between gap-4"><h4 className="text-sm font-semibold text-[var(--ws-text)]">{title}</h4><span className="font-mono text-[9px] uppercase text-[var(--ws-text-tertiary)]">{value}</span></div>;
}

function EmptyLine({ text }: { text: string }) {
  return <p className="mt-3 border-y border-dashed border-[var(--ws-border)] py-4 text-xs text-[var(--ws-text-tertiary)]">{text}</p>;
}

function money(value: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(value || 0);
}

function date(value: string | null): string {
  if (!value) return 'Unknown';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function localDateValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function futureDateValue(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

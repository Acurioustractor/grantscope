'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  ActContactResolutionItem,
  ActFunderDossier,
  ActFunderEvidenceStatus,
  ActFunderIntelligence,
  ActFunderRelationshipState,
} from '@/lib/services/act-funder-intelligence';
import type { ActFunderOutcome } from '@/lib/services/act-funder-learning';
import {
  buildActRelationshipBrief,
  isDirectFunderPerson,
  type ActRelationshipBrief,
} from '@/lib/services/act-relationship-brief';
import type { ActRelationshipLedger as ActRelationshipLedgerData } from '@/lib/services/act-relationship-ledger';
import { ActPeopleDirectory } from './act-people-directory';
import { ActRelationshipLedger as ActRelationshipLedgerView } from './act-relationship-ledger';

type Filter = 'action' | 'connected' | 'research' | 'all';
type Surface = 'funders' | 'ledger' | 'people' | 'resolution';

export function ActFunderIntelligenceDesk({
  intelligence,
  relationshipLedger,
  orgProfileId,
  initialFoundationId,
  initialLedgerKey,
}: {
  intelligence: ActFunderIntelligence;
  relationshipLedger?: ActRelationshipLedgerData | null;
  orgProfileId: string;
  initialFoundationId?: string;
  initialLedgerKey?: string;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('action');
  const [surface, setSurface] = useState<Surface>('funders');
  const [selectedId, setSelectedId] = useState(initialFoundationId || intelligence.dossiers[0]?.foundationId || '');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return intelligence.dossiers.filter((dossier) => {
      const matchesQuery = !needle || [
        dossier.name,
        dossier.abn,
        ...dossier.projects,
        ...dossier.thematicFocus,
        ...dossier.people.map((person) => `${person.name} ${person.email ?? ''}`),
      ].join(' ').toLowerCase().includes(needle);
      if (!matchesQuery) return false;
      const directPeople = dossier.people.filter(isDirectFunderPerson);
      if (filter === 'connected') return directPeople.length > 0 || dossier.interactions.length > 0;
      if (filter === 'research') return dossier.evidenceGaps.length > 0 || directPeople.length === 0;
      if (filter === 'action') return dossier.active || dossier.relationshipState === 'active' || dossier.relationshipState === 'warm' || Boolean(dossier.nextTouchAt);
      return true;
    });
  }, [filter, intelligence.dossiers, query]);

  const selected = intelligence.dossiers.find((dossier) => dossier.foundationId === selectedId)
    ?? visible[0]
    ?? intelligence.dossiers[0]
    ?? null;
  const selectedBrief = useMemo(
    () => selected ? buildActRelationshipBrief(selected, relationshipLedger) : null,
    [relationshipLedger, selected],
  );

  return (
    <section id="relationships" className="my-6 min-w-0 scroll-mt-24 overflow-hidden rounded-md border border-[var(--ws-border)] bg-[var(--ws-surface-1)]">
      <header className="border-b border-[var(--ws-border)] bg-[#183426] px-5 py-5 text-white sm:px-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#b8c8bd]">Relationship brief</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-normal">Everything ACT knows, in one place</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#c7d3cb]">
              Review people, prior work, money, conversations, funding history, unknowns, and the next concrete follow-up.
            </p>
          </div>
          <div className="grid grid-cols-2 divide-x divide-y divide-white/15 border border-white/15 sm:grid-cols-4 sm:divide-y-0 xl:min-w-[480px]">
            <HeaderMetric label="Organisations" value={intelligence.summary.candidates} />
            <HeaderMetric label="With contacts" value={intelligence.summary.withContacts} />
            <HeaderMetric label="Funding histories" value={intelligence.summary.withFundingHistory} />
            <HeaderMetric label="Need research" value={intelligence.summary.needingEnrichment} warning />
          </div>
        </div>
      </header>

      <div className="flex border-b border-[var(--ws-border)] bg-white px-4 pt-2" aria-label="Relationship workspace">
        <button type="button" onClick={() => setSurface('funders')} className={`min-h-11 border-b-2 px-4 text-sm font-semibold ${surface === 'funders' ? 'border-[#2f6b4a] text-[#183426]' : 'border-transparent text-[var(--ws-text-secondary)]'}`}>Funders</button>
        <button type="button" onClick={() => setSurface('ledger')} className={`min-h-11 border-b-2 px-4 text-sm font-semibold ${surface === 'ledger' ? 'border-[#2f6b4a] text-[#183426]' : 'border-transparent text-[var(--ws-text-secondary)]'}`}>
          Ledger <span className="ml-1 font-mono text-[10px]">{relationshipLedger?.summary.organisations ?? 0}</span>
        </button>
        <button type="button" onClick={() => setSurface('people')} className={`min-h-11 border-b-2 px-4 text-sm font-semibold ${surface === 'people' ? 'border-[#2f6b4a] text-[#183426]' : 'border-transparent text-[var(--ws-text-secondary)]'}`}>People</button>
        <button type="button" onClick={() => setSurface('resolution')} className={`min-h-11 border-b-2 px-4 text-sm font-semibold ${surface === 'resolution' ? 'border-[#2f6b4a] text-[#183426]' : 'border-transparent text-[var(--ws-text-secondary)]'}`}>
          Resolve contacts <span className="ml-1 font-mono text-[10px]">{intelligence.contactResolution.total}</span>
        </button>
      </div>

      {surface === 'funders' ? (
        <div className="grid min-w-0 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="min-w-0 border-b border-[var(--ws-border)] bg-[var(--ws-surface-2)] xl:border-b-0 xl:border-r">
            <div className="border-b border-[var(--ws-border)] p-4">
              <label className="block">
                <span className="sr-only">Search funders, people, projects, and focus areas</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search funders or people"
                  className="min-h-11 w-full rounded-md border border-[var(--ws-border)] bg-white px-3 text-sm text-[var(--ws-text)] outline-none focus:border-[#2f6b4a] focus:ring-2 focus:ring-[#2f6b4a]/15"
                />
              </label>
              <div className="mt-3 flex gap-1 overflow-x-auto" aria-label="Funder filters">
                {([
                  ['action', 'Act now'],
                  ['connected', 'Connected'],
                  ['research', 'Research'],
                  ['all', 'All'],
                ] as Array<[Filter, string]>).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    className={`min-h-9 shrink-0 rounded-md px-3 text-xs font-semibold ${filter === value ? 'bg-[#183426] text-white' : 'text-[var(--ws-text-secondary)] hover:bg-white'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-3 font-mono text-[9px] uppercase text-[var(--ws-text-tertiary)]">{visible.length} funders shown</div>
            </div>
            <div className="max-h-[760px] divide-y divide-[var(--ws-border)] overflow-y-auto">
              {visible.map((dossier) => (
                <FunderListRow
                  key={dossier.foundationId}
                  dossier={dossier}
                  selected={selected?.foundationId === dossier.foundationId}
                  onSelect={() => setSelectedId(dossier.foundationId)}
                />
              ))}
              {visible.length === 0 ? <p className="p-5 text-sm text-[var(--ws-text-secondary)]">No funders match this view.</p> : null}
            </div>
          </aside>

          <main className="min-w-0 border-b border-[var(--ws-border)] xl:border-b-0">
            {selected && selectedBrief ? <FunderDossierView key={selected.foundationId} dossier={selected} brief={selectedBrief} intelligence={intelligence} orgProfileId={orgProfileId} /> : <EmptyDossier />}
          </main>
        </div>
      ) : surface === 'ledger' ? (
        <ActRelationshipLedgerView data={relationshipLedger ?? null} orgProfileId={orgProfileId} initialSelectedKey={initialLedgerKey} />
      ) : surface === 'people' ? (
        <ActPeopleDirectory orgProfileId={orgProfileId} />
      ) : <ContactResolutionQueue items={intelligence.contactResolution.items} orgProfileId={orgProfileId} />}
    </section>
  );
}

function ContactResolutionQueue({ items: initialItems, orgProfileId }: { items: ActContactResolutionItem[]; orgProfileId: string }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [selected, setSelected] = useState<Record<string, string>>(() => Object.fromEntries(
    initialItems.filter((item) => item.candidates[0]).map((item) => [item.contactId, item.candidates[0].entityId]),
  ));
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const counts = {
    suggested: items.filter((item) => item.status === 'suggested').length,
    ambiguous: items.filter((item) => item.status === 'ambiguous').length,
    research: items.filter((item) => item.status === 'research').length,
  };

  async function linkEntity(item: ActContactResolutionItem) {
    const entityId = selected[item.contactId];
    if (!entityId) return;
    setPending(item.contactId);
    setError(null);
    try {
      const response = await fetch(`/api/org/${orgProfileId}/contact-resolution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: item.contactId, entity_id: entityId }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not link the contact');
      setItems((current) => current.filter((entry) => entry.contactId !== item.contactId));
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not link the contact');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="min-w-0 bg-[#fbfcfa]">
      <header className="grid border-b border-[var(--ws-border)] sm:grid-cols-[minmax(0,1fr)_repeat(3,120px)]">
        <div className="px-5 py-5 sm:px-7">
          <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#2f6b4a]">CRM identity review</div>
          <h3 className="mt-2 text-lg font-semibold text-[var(--ws-text)]">Unlinked ACT contacts</h3>
        </div>
        <ResolutionMetric label="Suggested" value={counts.suggested} />
        <ResolutionMetric label="Ambiguous" value={counts.ambiguous} />
        <ResolutionMetric label="Research" value={counts.research} />
      </header>
      {error ? <div role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700 sm:px-7">{error}</div> : null}
      <div className="max-h-[820px] divide-y divide-[var(--ws-border)] overflow-y-auto">
        {items.map((item) => (
          <div key={item.contactId} className="grid min-w-0 gap-4 px-5 py-5 sm:px-7 lg:grid-cols-[minmax(180px,0.8fr)_minmax(280px,1.2fr)_120px] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold text-[var(--ws-text)]">{item.name}</h4>
                <ResolutionStatus status={item.status} />
              </div>
              <p className="mt-1 truncate text-xs text-[var(--ws-text-secondary)]">{item.organisation}</p>
              {item.email ? <p className="mt-1 truncate font-mono text-[9px] text-[var(--ws-text-tertiary)]">{item.email}</p> : null}
            </div>
            <div className="min-w-0">
              {item.candidates.length > 0 ? (
                <label className="block">
                  <span className="sr-only">CivicGraph entity for {item.name}</span>
                  <select
                    value={selected[item.contactId] || ''}
                    onChange={(event) => setSelected((current) => ({ ...current, [item.contactId]: event.target.value }))}
                    className="min-h-11 w-full rounded-md border border-[var(--ws-border)] bg-white px-3 text-xs text-[var(--ws-text)] outline-none focus:border-[#2f6b4a] focus:ring-2 focus:ring-[#2f6b4a]/15"
                  >
                    {item.candidates.map((candidate) => (
                      <option key={candidate.entityId} value={candidate.entityId}>
                        {candidate.name} · {candidate.abn ? `ABN ${candidate.abn}` : candidate.entityType} · {candidate.nameScore}% name match
                      </option>
                    ))}
                  </select>
                </label>
              ) : <span className="text-xs text-[var(--ws-text-tertiary)]">No credible CivicGraph candidate</span>}
            </div>
            <div className="lg:text-right">
              {item.candidates.length > 0 ? (
                <button
                  type="button"
                  onClick={() => linkEntity(item)}
                  disabled={pending === item.contactId}
                  className="min-h-11 rounded-md bg-[#183426] px-4 text-xs font-semibold text-white hover:bg-[#245139] disabled:cursor-wait disabled:opacity-60"
                >
                  {pending === item.contactId ? 'Linking…' : 'Link entity'}
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {items.length === 0 ? <div className="p-8 text-center text-sm text-[var(--ws-text-secondary)]">All ACT contacts are linked.</div> : null}
      </div>
    </div>
  );
}

function ResolutionMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-t border-[var(--ws-border)] px-4 py-4 text-center sm:border-l sm:border-t-0">
      <div className="font-mono text-lg font-semibold text-[var(--ws-text)]">{value}</div>
      <div className="mt-1 font-mono text-[8px] font-semibold uppercase text-[var(--ws-text-tertiary)]">{label}</div>
    </div>
  );
}

function ResolutionStatus({ status }: { status: ActContactResolutionItem['status'] }) {
  const classes = status === 'suggested'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : status === 'ambiguous'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-gray-200 bg-gray-50 text-gray-600';
  return <span className={`rounded border px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase ${classes}`}>{status}</span>;
}

function HeaderMetric({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return (
    <div className="min-w-0 px-3 py-3 text-center">
      <div className={`font-mono text-xl font-semibold ${warning && value > 0 ? 'text-[#f1bd72]' : 'text-white'}`}>{value.toLocaleString()}</div>
      <div className="mt-1 text-[9px] font-semibold uppercase text-[#b8c8bd]">{label}</div>
    </div>
  );
}

function FunderListRow({ dossier, selected, onSelect }: { dossier: ActFunderDossier; selected: boolean; onSelect: () => void }) {
  const directPeople = dossier.people.filter(isDirectFunderPerson);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`block min-h-[92px] w-full px-4 py-4 text-left transition-colors ${selected ? 'bg-white shadow-[inset_3px_0_0_#2f6b4a]' : 'hover:bg-white/80'}`}
    >
      <div className="min-w-0">
        <div className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--ws-text)]">{cleanFoundationName(dossier.name)}</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <RelationshipPill state={dossier.relationshipState} />
          {dossier.nextTouchAt ? <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase text-blue-700">follow-up {formatDate(dossier.nextTouchAt)}</span> : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] text-[var(--ws-text-secondary)]">
        <span>{directPeople.length} direct {directPeople.length === 1 ? 'contact' : 'contacts'}</span>
        <span>{dossier.granteeCount.toLocaleString()} grantees</span>
        <span>{dossier.openProgramCount} open {dossier.openProgramCount === 1 ? 'route' : 'routes'}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-[var(--ws-text-secondary)]">{dossier.nextStep || dossier.recommendedAction}</p>
    </button>
  );
}

function FunderDossierView({
  dossier,
  brief,
  intelligence,
  orgProfileId,
}: {
  dossier: ActFunderDossier;
  brief: ActRelationshipBrief;
  intelligence: ActFunderIntelligence;
  orgProfileId: string;
}) {
  return (
    <div>
      <header className="border-b border-[var(--ws-border)] px-5 py-6 sm:px-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <RelationshipPill state={dossier.relationshipState} />
              {dossier.stages.map((stage) => <StagePill key={stage} value={stage} />)}
            </div>
            <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-normal text-[var(--ws-text)]">{cleanFoundationName(dossier.name)}</h2>
            <p className="mt-2 text-xs text-[var(--ws-text-secondary)]">
              {dossier.abn ? `ABN ${dossier.abn}` : 'ABN not resolved'} · {dossier.projects.join(' · ') || 'No project assigned'}
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold">
              <a href={`/foundations/${dossier.foundationId}`} className="text-[#2f6b4a] hover:underline">Open CivicGraph dossier</a>
              {dossier.website ? <a href={dossier.website} target="_blank" rel="noreferrer" className="text-[#2f6b4a] hover:underline">Open funder website</a> : null}
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-2 divide-x divide-y divide-[var(--ws-border)] border border-[var(--ws-border)] bg-[#fbfcfa] sm:grid-cols-4 sm:divide-y-0">
            <CompactMetric label="Direct contacts" value={`${brief.directPeople.length}`} />
            <CompactMetric label="Research people" value={`${brief.researchPeople.length}`} />
            <CompactMetric label="Grantees found" value={dossier.granteeCount.toLocaleString()} />
            <CompactMetric label="Last contact" value={brief.lastKnownContactAt ? formatShortDate(brief.lastKnownContactAt) : 'None'} />
          </div>
        </div>
      </header>

      <section className="border-b border-[var(--ws-border)] bg-[#edf3ee] px-5 py-5 sm:px-7">
        <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#2f6b4a]">Concrete follow-up</div>
        <ol className="mt-3 divide-y divide-[#c9d9cd] border-y border-[#c9d9cd]">
          {brief.actions.map((action, index) => (
            <li key={action.id} className="grid gap-2 py-4 sm:grid-cols-[28px_minmax(0,1fr)]">
              <span className="font-mono text-[10px] font-semibold text-[#607668]">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <p className="text-sm font-semibold leading-relaxed text-[#183426]">{action.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-[#4f6657]">{action.detail}</p>
              </div>
            </li>
          ))}
        </ol>
        {dossier.nextTouchAt ? <div className="mt-3 font-mono text-[9px] uppercase text-[#607668]">Planned follow-up: {formatDate(dossier.nextTouchAt)}</div> : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <FunderNextMove dossier={dossier} orgProfileId={orgProfileId} />
          <FunderOutcome dossier={dossier} orgProfileId={orgProfileId} />
        </div>
      </section>

      <section className="border-b border-[var(--ws-border)] px-5 py-6 sm:px-7">
        <SectionHeader title="ACT history with this organisation" value={brief.ledgerItem ? 'ledger linked' : 'not linked'} />
        {brief.ledgerItem ? (
          <>
            <div className="mt-4 grid grid-cols-2 divide-x divide-y divide-[var(--ws-border)] border border-[var(--ws-border)] sm:grid-cols-4 sm:divide-y-0">
              <Fact label="Received" value={formatMoney(brief.ledgerItem.receivedTotal)} />
              <Fact label="Outstanding" value={formatMoney(brief.ledgerItem.outstandingTotal)} />
              <Fact label="Invoices" value={`${brief.ledgerItem.invoiceCount} · ${brief.ledgerItem.paidInvoiceCount} paid`} />
              <Fact label="Conversations" value={String(brief.ledgerItem.conversations.length)} />
            </div>
            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              <div>
                <h3 className="font-mono text-[9px] font-semibold uppercase text-[var(--ws-text-tertiary)]">Work and support</h3>
                {brief.ledgerItem.work.length > 0 ? (
                  <ul className="mt-2 divide-y divide-[var(--ws-border)] border-y border-[var(--ws-border)]">
                    {brief.ledgerItem.work.map((work) => <li key={work} className="py-3 text-xs leading-relaxed text-[var(--ws-text-secondary)]">{work}</li>)}
                  </ul>
                ) : <EmptyLine text="No delivered work has been described yet." />}
              </div>
              <div>
                <h3 className="font-mono text-[9px] font-semibold uppercase text-[var(--ws-text-tertiary)]">Recent conversations and exchanges</h3>
                {[...brief.ledgerItem.conversations, ...brief.ledgerItem.contributions].length > 0 ? (
                  <div className="mt-2 divide-y divide-[var(--ws-border)] border-y border-[var(--ws-border)]">
                    {brief.ledgerItem.conversations.slice(0, 4).map((conversation) => (
                      <div key={conversation.id} className="py-3">
                        <div className="text-xs font-semibold">{conversation.title}</div>
                        <p className="mt-1 text-[11px] leading-relaxed text-[var(--ws-text-secondary)]">{conversation.summary}</p>
                      </div>
                    ))}
                    {brief.ledgerItem.contributions.slice(0, 4).map((contribution) => (
                      <div key={contribution.id} className="py-3">
                        <div className="text-xs font-semibold capitalize">{contribution.direction} · {humanise(contribution.kind)}</div>
                        <p className="mt-1 text-[11px] leading-relaxed text-[var(--ws-text-secondary)]">{contribution.summary}</p>
                      </div>
                    ))}
                  </div>
                ) : <EmptyLine text="No conversation or exchange has been captured yet." />}
              </div>
            </div>
          </>
        ) : <EmptyLine text="No matching Xero, exchange, or conversation ledger record has been linked. The research below is still available." />}
      </section>

      <section className="border-b border-[var(--ws-border)] px-5 py-6 sm:px-7">
        <SectionHeader title="People" value={`${brief.directPeople.length} direct · ${brief.researchPeople.length} research`} />
        <h3 className="mt-4 font-mono text-[9px] font-semibold uppercase text-[#2f6b4a]">People ACT can contact</h3>
        {brief.directPeople.length > 0 ? <PersonRows people={brief.directPeople} /> : <EmptyLine text="No direct ACT contact is linked yet." />}
        <details className="mt-5 border-y border-[var(--ws-border)] py-3">
          <summary className="cursor-pointer text-xs font-semibold text-[var(--ws-text)]">Research people: board, registry, and possible introduction routes ({brief.researchPeople.length})</summary>
          {brief.researchPeople.length > 0 ? <PersonRows people={brief.researchPeople} /> : <p className="pt-3 text-xs text-[var(--ws-text-secondary)]">No research-only people are attached.</p>}
        </details>
      </section>

      {dossier.interactions.length > 0 ? (
        <section className="border-b border-[var(--ws-border)] px-5 py-6 sm:px-7">
          <SectionHeader title="Recent relationship outcomes" value={`${dossier.interactions.length} recorded`} />
          <div className="mt-3 divide-y divide-[var(--ws-border)] border-y border-[var(--ws-border)]">
            {dossier.interactions.slice(0, 6).map((interaction) => (
              <div key={interaction.id} className="grid gap-2 py-4 sm:grid-cols-[110px_minmax(0,1fr)_110px]">
                <div className="font-mono text-[9px] font-semibold uppercase text-[#2f6b4a]">{humanise(interaction.type)}</div>
                <div className="text-xs leading-relaxed text-[var(--ws-text)]">{interaction.summary}</div>
                <div className="font-mono text-[9px] uppercase text-[var(--ws-text-tertiary)] sm:text-right">{formatDate(interaction.happenedAt)}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="border-b border-[var(--ws-border)] px-5 py-6 sm:px-7">
        <SectionHeader title="What they fund" value={`${dossier.granteeCount.toLocaleString()} verified rows`} />
        <div className="mt-4 grid grid-cols-2 divide-x divide-y divide-[var(--ws-border)] border border-[var(--ws-border)] sm:grid-cols-4 sm:divide-y-0">
          <Fact label="Annual giving" value={formatMoney(dossier.annualGiving)} />
          <Fact label="Mapped grants" value={formatMoney(dossier.granteeAmount)} />
          <Fact label="Latest grant year" value={dossier.latestGrantYear ? String(dossier.latestGrantYear) : 'Unknown'} />
          <Fact label="Annual-report years" value={String(dossier.annualReportYears)} />
        </div>
        {dossier.grantees.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-y border-[var(--ws-border)] font-mono text-[9px] uppercase text-[var(--ws-text-tertiary)]">
                  <th className="py-2 pr-3 font-semibold">Grantee</th>
                  <th className="py-2 pr-3 font-semibold">Program</th>
                  <th className="py-2 pr-3 font-semibold">Year</th>
                  <th className="py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ws-border)]">
                {dossier.grantees.slice(0, 8).map((grantee) => (
                  <tr key={grantee.id} className="text-xs">
                    <td className="py-3 pr-3 font-semibold text-[var(--ws-text)]">{grantee.sourceUrl ? <a href={grantee.sourceUrl} target="_blank" rel="noreferrer" className="hover:text-[#2f6b4a] hover:underline">{grantee.name}</a> : grantee.name}</td>
                    <td className="max-w-[220px] truncate py-3 pr-3 text-[var(--ws-text-secondary)]">{grantee.program || 'Not named'}</td>
                    <td className="py-3 pr-3 font-mono text-[var(--ws-text-secondary)]">{grantee.year ?? '—'}</td>
                    <td className="py-3 text-right font-mono text-[var(--ws-text)]">{formatMoney(grantee.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dossier.granteeCount > 8 ? <p className="mt-3 text-[11px] text-[var(--ws-text-secondary)]">Showing 8 recent records from {dossier.granteeCount.toLocaleString()} mapped grants. Open the CivicGraph dossier for the full history.</p> : null}
          </div>
        ) : <EmptyLine text="No verified grantees have been extracted yet." />}
      </section>

      <section className="px-5 py-6 sm:px-7">
        <SectionHeader title="Focus and ways to engage" value={`${dossier.applicationPathCount} routes`} />
        {dossier.description ? <p className="mt-3 text-sm leading-relaxed text-[var(--ws-text-secondary)]">{dossier.description}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {[...dossier.thematicFocus, ...dossier.geographicFocus].slice(0, 14).map((focus) => <span key={focus} className="rounded border border-[var(--ws-border)] bg-[#f8f9f5] px-2 py-1 text-[10px] font-semibold text-[var(--ws-text-secondary)]">{humanise(focus)}</span>)}
        </div>
        {dossier.programs.length > 0 ? (
          <div className="mt-5 divide-y divide-[var(--ws-border)] border-y border-[var(--ws-border)]">
            {dossier.programs.slice(0, 8).map((program) => (
              <div key={program.id} className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_130px]">
                <div>
                  <div className="text-sm font-semibold">{program.url ? <a href={program.url} target="_blank" rel="noreferrer" className="hover:text-[#2f6b4a] hover:underline">{program.name}</a> : program.name}</div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--ws-text-secondary)]">{program.applicationProcess || program.applicationMode || 'Application route needs confirmation.'}</p>
                </div>
                <div className="font-mono text-[9px] uppercase text-[var(--ws-text-secondary)] sm:text-right">
                  <div>{program.status || 'status unknown'}</div>
                  <div className="mt-1">{program.deadline ? formatDate(program.deadline) : `${program.sourceCount} sources`}</div>
                </div>
              </div>
            ))}
            {dossier.programs.length > 8 ? <p className="py-3 text-[11px] text-[var(--ws-text-secondary)]">Showing 8 of {dossier.programs.length} known program records.</p> : null}
          </div>
        ) : <EmptyLine text="No current program surface is connected." />}
      </section>

      <section className="grid border-t border-[var(--ws-border)] bg-[#f8f9f5] lg:grid-cols-2 lg:divide-x lg:divide-[var(--ws-border)]">
        <div className="px-5 py-6 sm:px-7">
          <SectionHeader title="What we still need to learn" value={`${brief.unknowns.length} unknown`} />
          {brief.unknowns.length > 0 ? (
            <ol className="mt-3 divide-y divide-[var(--ws-border)] border-y border-[var(--ws-border)]">
              {brief.unknowns.map((unknown, index) => (
                <li key={unknown} className="grid grid-cols-[24px_minmax(0,1fr)] gap-2 py-3 text-xs leading-relaxed text-[var(--ws-text-secondary)]">
                  <span className="font-mono text-[9px] text-[var(--ws-text-tertiary)]">{String(index + 1).padStart(2, '0')}</span>
                  <span>{unknown}</span>
                </li>
              ))}
            </ol>
          ) : <p className="mt-3 text-xs text-emerald-700">No material evidence gap is recorded for this brief.</p>}
        </div>
        <div className="px-5 py-6 sm:px-7">
          <SectionHeader title="Where these facts came from" value={`${dossier.sourceAudit.length} source groups`} />
          <div className="mt-3 divide-y divide-[var(--ws-border)] border-y border-[var(--ws-border)]">
            {dossier.sourceAudit.map((source) => <SourceRow key={source.key} label={source.label} detail={source.detail} status={source.status} />)}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-[var(--ws-text-secondary)]">
            CivicGraph currently holds {intelligence.globalCoverage.foundations.toLocaleString()} foundation profiles, {intelligence.globalCoverage.granteeRows.toLocaleString()} grantee rows, {intelligence.globalCoverage.scrapedSources.toLocaleString()} scraped sources, {intelligence.globalCoverage.gmailMessages.toLocaleString()} Gmail context records, and {intelligence.globalCoverage.notionOrganisations.toLocaleString()} Notion organisations.
          </p>
        </div>
      </section>
    </div>
  );
}

function PersonRows({ people }: { people: ActFunderDossier['people'] }) {
  return (
    <div className="mt-3 divide-y divide-[var(--ws-border)] border-y border-[var(--ws-border)]">
      {people.map((person) => (
        <div key={person.id} className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_140px]">
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-[var(--ws-text)]">{person.name}</h4>
            <div className="mt-1 break-words text-xs text-[var(--ws-text-secondary)]">{person.role ? humanise(person.role) : person.email || person.organisation}</div>
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--ws-text-secondary)]">{person.evidence}</p>
          </div>
          <div className="text-left sm:text-right">
            <div className="font-mono text-[9px] font-semibold uppercase text-[#2f6b4a]">{person.source}</div>
            <div className="mt-1 text-[10px] text-[var(--ws-text-tertiary)]">{person.lastContactAt ? formatDate(person.lastContactAt) : person.confidence}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function FunderOutcome({ dossier, orgProfileId }: { dossier: ActFunderDossier; orgProfileId: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [outcome, setOutcome] = useState<ActFunderOutcome>('meeting_held');
  const [summary, setSummary] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [nextTouchAt, setNextTouchAt] = useState('');
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch(`/api/org/${orgProfileId}/funder-intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          relationship_id: dossier.relationshipRecordId,
          project_id: dossier.projectId,
          foundation_name: dossier.name,
          outcome,
          summary,
          next_step: nextStep,
          next_touch_at: nextTouchAt || null,
        }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || `Save failed with ${response.status}`);
      setSaved(true);
      setEditing(false);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not record the outcome');
    } finally {
      setPending(false);
    }
  }

  if (!editing) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="min-h-10 rounded-md border border-[#9fb8a6] bg-white px-4 text-xs font-semibold text-[#183426] hover:bg-[#f7faf8]"
        >
          Record outcome
        </button>
        {saved ? <span className="text-xs font-semibold text-emerald-700">Outcome learned</span> : null}
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-[#c9d9cd] pt-4 sm:col-span-2">
      <div className="grid gap-3 sm:grid-cols-[170px_minmax(0,1fr)]">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase text-[#4f6657]">Outcome</span>
          <select
            aria-label="Funder outcome"
            value={outcome}
            onChange={(event) => setOutcome(event.target.value as ActFunderOutcome)}
            className="mt-1 min-h-10 w-full rounded-md border border-[#b9cbbd] bg-white px-2 text-xs text-[#183426]"
          >
            <option value="meeting_held">Meeting held</option>
            <option value="positive_reply">Positive reply</option>
            <option value="proposal_invited">Proposal invited</option>
            <option value="funded">Funding confirmed</option>
            <option value="no_response">No response</option>
            <option value="not_a_fit">Not a fit</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase text-[#4f6657]">What happened</span>
          <input
            aria-label="Funder outcome summary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            maxLength={1_200}
            placeholder="Record the useful fact, not a transcript"
            className="mt-1 min-h-10 w-full rounded-md border border-[#b9cbbd] bg-white px-3 text-xs text-[#183426]"
          />
        </label>
        <label className="block sm:col-start-2">
          <span className="text-[10px] font-semibold uppercase text-[#4f6657]">Next move, if any</span>
          <input
            aria-label="Outcome next move"
            value={nextStep}
            onChange={(event) => setNextStep(event.target.value)}
            maxLength={600}
            className="mt-1 min-h-10 w-full rounded-md border border-[#b9cbbd] bg-white px-3 text-xs text-[#183426]"
          />
        </label>
        <label className="block sm:col-start-2">
          <span className="text-[10px] font-semibold uppercase text-[#4f6657]">Follow-up date</span>
          <input
            aria-label="Outcome follow-up date"
            type="date"
            value={nextTouchAt}
            onChange={(event) => setNextTouchAt(event.target.value)}
            className="mt-1 min-h-10 w-full rounded-md border border-[#b9cbbd] bg-white px-2 text-xs text-[#183426]"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 sm:pl-[182px]">
        <button
          type="button"
          onClick={save}
          disabled={pending || !summary.trim()}
          className="min-h-10 rounded-md bg-[#183426] px-4 text-xs font-semibold text-white hover:bg-[#244b38] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Recording...' : 'Record and learn'}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="min-h-10 px-3 text-xs font-semibold text-[#4f6657] hover:underline">Cancel</button>
        {error ? <span className="text-xs text-red-700">{error}</span> : null}
      </div>
    </div>
  );
}

function FunderNextMove({ dossier, orgProfileId }: { dossier: ActFunderDossier; orgProfileId: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [engagementStatus, setEngagementStatus] = useState(validEngagementStatus(dossier.engagementStatuses[0]));
  const [nextStep, setNextStep] = useState(dossier.nextStep || dossier.recommendedAction);
  const [nextTouchAt, setNextTouchAt] = useState(dateInputValue(dossier.nextTouchAt));
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch(`/api/org/${orgProfileId}/funder-intelligence`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          relationship_id: dossier.relationshipRecordId,
          project_id: dossier.projectId,
          foundation_name: dossier.name,
          engagement_status: engagementStatus,
          next_step: nextStep,
          next_touch_at: nextTouchAt || null,
        }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || `Save failed with ${response.status}`);
      setSaved(true);
      setEditing(false);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the next move');
    } finally {
      setPending(false);
    }
  }

  if (!editing) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="min-h-10 rounded-md bg-[#183426] px-4 text-xs font-semibold text-white hover:bg-[#244b38]"
        >
          Plan next move
        </button>
        {saved ? <span className="text-xs font-semibold text-emerald-700">Saved to ACT Today</span> : null}
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-[#c9d9cd] pt-4 sm:col-span-2">
      <div className="grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)_150px]">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase text-[#4f6657]">Relationship state</span>
          <select
            aria-label="Relationship state"
            value={engagementStatus}
            onChange={(event) => setEngagementStatus(event.target.value)}
            className="mt-1 min-h-10 w-full rounded-md border border-[#b9cbbd] bg-white px-2 text-xs text-[#183426]"
          >
            <option value="researching">Researching</option>
            <option value="ready_to_approach">Ready to approach</option>
            <option value="approached">Approached</option>
            <option value="meeting">Meeting</option>
            <option value="proposal">Proposal</option>
            <option value="parked">Parked</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase text-[#4f6657]">Next move</span>
          <input
            aria-label="Funder next move"
            value={nextStep}
            onChange={(event) => setNextStep(event.target.value)}
            maxLength={600}
            className="mt-1 min-h-10 w-full rounded-md border border-[#b9cbbd] bg-white px-3 text-xs text-[#183426]"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase text-[#4f6657]">Follow-up date</span>
          <input
            aria-label="Funder follow-up date"
            type="date"
            value={nextTouchAt}
            onChange={(event) => setNextTouchAt(event.target.value)}
            className="mt-1 min-h-10 w-full rounded-md border border-[#b9cbbd] bg-white px-2 text-xs text-[#183426]"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending || !nextStep.trim()}
          className="min-h-10 rounded-md bg-[#183426] px-4 text-xs font-semibold text-white hover:bg-[#244b38] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Saving...' : 'Save next move'}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="min-h-10 px-3 text-xs font-semibold text-[#4f6657] hover:underline">Cancel</button>
        {error ? <span className="text-xs text-red-700">{error}</span> : null}
      </div>
    </div>
  );
}

function SourceRow({ label, detail, status }: { label: string; detail: string; status: ActFunderEvidenceStatus }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-3">
      <div className="min-w-0">
        <div className="text-xs font-semibold">{label}</div>
        <div className="mt-1 text-[10px] leading-relaxed text-[var(--ws-text-secondary)]">{detail}</div>
      </div>
      <StatusDot status={status} />
    </div>
  );
}

function StatusDot({ status }: { status: ActFunderEvidenceStatus }) {
  const styles: Record<ActFunderEvidenceStatus, string> = {
    strong: 'bg-emerald-500',
    partial: 'bg-amber-500',
    missing: 'bg-red-500',
    stale: 'bg-gray-400',
  };
  return <span className={`mt-1 inline-block h-2.5 w-2.5 rounded-full ${styles[status]}`} title={status} />;
}

function RelationshipPill({ state }: { state: ActFunderRelationshipState }) {
  const styles: Record<ActFunderRelationshipState, string> = {
    active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warm: 'border-lime-200 bg-lime-50 text-lime-800',
    known: 'border-amber-200 bg-amber-50 text-amber-700',
    cold: 'border-gray-200 bg-gray-50 text-gray-600',
  };
  return <span className={`rounded border px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase ${styles[state]}`}>{state}</span>;
}

function StagePill({ value }: { value: string }) {
  return <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase text-blue-700">{humanise(value)}</span>;
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-[72px] px-3 py-2 text-center"><div className="font-mono text-base font-semibold">{value}</div><div className="mt-1 font-mono text-[8px] uppercase text-[var(--ws-text-tertiary)]">{label}</div></div>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 p-3"><div className="font-mono text-[8px] font-semibold uppercase text-[var(--ws-text-tertiary)]">{label}</div><div className="mt-2 truncate text-sm font-semibold text-[var(--ws-text)]">{value}</div></div>;
}

function SectionHeader({ title, value }: { title: string; value: string }) {
  return <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-semibold tracking-normal">{title}</h3><span className="shrink-0 font-mono text-[9px] uppercase text-[var(--ws-text-tertiary)]">{value}</span></div>;
}

function EmptyLine({ text }: { text: string }) {
  return <p className="mt-4 border-y border-dashed border-[var(--ws-border)] py-5 text-xs text-[var(--ws-text-secondary)]">{text}</p>;
}

function EmptyDossier() {
  return <div className="grid min-h-[420px] place-items-center p-8 text-sm text-[var(--ws-text-secondary)]">No funder dossiers are available.</div>;
}

function cleanFoundationName(value: string): string {
  return value.replace(/^the trustee for the /i, '').replace(/^the trustee for /i, '');
}

function humanise(value: string): string {
  return value.replaceAll('_', ' ').replaceAll('-', ' ');
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function dateInputValue(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function validEngagementStatus(value: string | undefined): string {
  return ['researching', 'ready_to_approach', 'approached', 'meeting', 'proposal', 'parked'].includes(value || '')
    ? String(value)
    : 'researching';
}

function formatMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'Unknown';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value).toLocaleString()}`;
}

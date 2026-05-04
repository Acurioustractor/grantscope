'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

type Total = {
  label: string;
  value: string;
};

type OperatingFact = {
  label: string;
  value: string;
  detail: string;
};

type MoneyRow = {
  group: string;
  name: string;
  amount: string;
  status: string;
  owner: string;
  next: string;
};

type PeopleRow = {
  group: string;
  name: string;
  org: string;
  role: string;
  status: string;
  next: string;
};

type TargetRow = {
  lane: string;
  target: string;
  money: string;
  status: string;
  firstMove: string;
};

type BlockerRow = {
  area: string;
  status: string;
  next: string;
  proof: string;
};

type ActionRow = {
  label: string;
  work: string;
  owner: string;
  href: string;
};

type CardSource = 'money' | 'people' | 'target' | 'blocker' | 'action';
type BoardLane = 'blocked' | 'active' | 'receivable' | 'received' | 'upcoming' | 'parked';
type ViewMode = 'board' | 'money' | 'people' | 'targets';
type SourceFilter = 'all' | CardSource;

type BoardCard = {
  id: string;
  source: CardSource;
  lane: BoardLane;
  title: string;
  subtitle: string;
  value: string;
  status: string;
  owner: string;
  next: string;
  proof?: string;
  href?: string;
};

const columns: Array<{ lane: BoardLane; title: string; helper: string }> = [
  { lane: 'blocked', title: 'Fix first', helper: 'Needs proof, cost, entity, or owner before action.' },
  { lane: 'active', title: 'Live now', helper: 'Current asks, partner moves, and live relationships.' },
  { lane: 'receivable', title: 'Collect', helper: 'Invoices, money trail, receipts, and write-off decisions.' },
  { lane: 'received', title: 'Received proof', helper: 'Use as credibility for QBE, Snow, buyers, and foundations.' },
  { lane: 'upcoming', title: 'Upcoming', helper: 'Possible funders, buyers, capital routes, and open paths.' },
  { lane: 'parked', title: 'Parked', helper: 'Not today, done, or held until the next evidence pass.' },
];

function statusClass(status: string) {
  const text = status.toLowerCase();
  if (text.includes('block') || text.includes('not ready') || text.includes('unsafe')) {
    return 'border-bauhaus-red bg-red-50 text-bauhaus-red';
  }
  if (text.includes('received') || text.includes('authorised') || text.includes('done') || text.includes('active partner')) {
    return 'border-emerald-700 bg-emerald-50 text-emerald-800';
  }
  if (text.includes('live') || text.includes('shortlisted') || text.includes('submitted') || text.includes('active')) {
    return 'border-bauhaus-blue bg-link-light text-bauhaus-blue';
  }
  return 'border-gray-300 bg-gray-50 text-gray-700';
}

function sourceLabel(source: CardSource) {
  if (source === 'money') return '$';
  if (source === 'people') return 'person';
  if (source === 'target') return 'path';
  if (source === 'blocker') return 'blocker';
  return 'task';
}

function laneFromMoney(row: MoneyRow): BoardLane {
  const status = row.status.toLowerCase();
  const group = row.group.toLowerCase();
  if (status.includes('unsafe') || status.includes('not ready') || status.includes('block')) return 'blocked';
  if (group.includes('receivable') || status.includes('authorised') || status.includes('draft')) return 'receivable';
  if (group.includes('received') || group.includes('recorded') || status.includes('received') || status.includes('recorded')) return 'received';
  if (group.includes('active') || group.includes('pitch') || status.includes('shortlisted') || status.includes('submitted') || status.includes('under review')) return 'active';
  return 'upcoming';
}

function laneFromPerson(row: PeopleRow): BoardLane {
  const status = row.status.toLowerCase();
  if (status.includes('not ready') || status.includes('block')) return 'blocked';
  if (status.includes('active') || status.includes('owner now') || status.includes('strategic') || status.includes('engaged') || status.includes('relationship')) return 'active';
  if (status.includes('application') || status.includes('shortlisted') || status.includes('upcoming')) return 'upcoming';
  return 'upcoming';
}

function laneFromTarget(row: TargetRow): BoardLane {
  const status = row.status.toLowerCase();
  if (status.includes('not ready') || status.includes('needs')) return 'blocked';
  if (status.includes('warm proof')) return 'received';
  if (status.includes('live') || status.includes('submitted')) return 'active';
  return 'upcoming';
}

function laneFromBlocker(row: BlockerRow): BoardLane {
  const status = row.status.toLowerCase();
  if (status.includes('ready')) return 'active';
  return 'blocked';
}

function makeInitialCards(input: {
  moneyRows: MoneyRow[];
  peopleRows: PeopleRow[];
  targetRows: TargetRow[];
  blockerRows: BlockerRow[];
  actionRows: ActionRow[];
}) {
  const moneyCards: BoardCard[] = input.moneyRows.map((row, index) => ({
    id: `money-${index}-${row.name}`,
    source: 'money',
    lane: laneFromMoney(row),
    title: row.name,
    subtitle: row.group,
    value: row.amount,
    status: row.status,
    owner: row.owner,
    next: row.next,
  }));

  const peopleCards: BoardCard[] = input.peopleRows.map((row, index) => ({
    id: `people-${index}-${row.name}`,
    source: 'people',
    lane: laneFromPerson(row),
    title: row.name,
    subtitle: `${row.group} / ${row.org}`,
    value: row.role,
    status: row.status,
    owner: row.org,
    next: row.next,
  }));

  const targetCards: BoardCard[] = input.targetRows.map((row, index) => ({
    id: `target-${index}-${row.target}`,
    source: 'target',
    lane: laneFromTarget(row),
    title: row.target,
    subtitle: row.lane,
    value: row.money,
    status: row.status,
    owner: row.lane,
    next: row.firstMove,
  }));

  const blockerCards: BoardCard[] = input.blockerRows.map((row, index) => ({
    id: `blocker-${index}-${row.area}`,
    source: 'blocker',
    lane: laneFromBlocker(row),
    title: row.area,
    subtitle: row.proof,
    value: row.proof,
    status: row.status,
    owner: 'Goods / ACT',
    next: row.next,
    proof: row.proof,
  }));

  const actionCards: BoardCard[] = input.actionRows.map((row, index) => ({
    id: `action-${index}-${row.work}`,
    source: 'action',
    lane: 'active',
    title: row.work,
    subtitle: `Do now ${row.label}`,
    value: row.owner,
    status: 'next action',
    owner: row.owner,
    next: `Open ${row.work}`,
    href: row.href,
  }));

  return [...moneyCards, ...peopleCards, ...targetCards, ...blockerCards, ...actionCards];
}

function nextLane(lane: BoardLane): BoardLane {
  if (lane === 'blocked') return 'active';
  if (lane === 'active') return 'receivable';
  if (lane === 'receivable') return 'received';
  if (lane === 'received') return 'parked';
  if (lane === 'upcoming') return 'active';
  return 'parked';
}

function previousLane(lane: BoardLane): BoardLane {
  if (lane === 'parked') return 'received';
  if (lane === 'received') return 'receivable';
  if (lane === 'receivable') return 'active';
  if (lane === 'active') return 'blocked';
  return 'upcoming';
}

function cardMatchesFilter(card: BoardCard, filter: SourceFilter) {
  return filter === 'all' || card.source === filter;
}

function BoardCardView({
  card,
  onOpen,
  onMove,
}: {
  card: BoardCard;
  onOpen: (card: BoardCard) => void;
  onMove: (card: BoardCard) => void;
}) {
  return (
    <article className="border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <span className="border border-gray-300 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-gray-600">
          {sourceLabel(card.source)}
        </span>
        <span className={`border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${statusClass(card.status)}`}>
          {card.status}
        </span>
      </div>
      <button type="button" onClick={() => onOpen(card)} className="mt-3 block w-full text-left">
        <h3 className="text-sm font-black leading-tight text-bauhaus-black">{card.title}</h3>
        <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-500">{card.subtitle}</div>
        <div className="mt-3 break-words text-sm font-black text-bauhaus-blue">{card.value}</div>
        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-gray-700">{card.next}</p>
      </button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onOpen(card)}
          className="border border-gray-300 bg-white px-2 py-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-gray-50"
        >
          Detail
        </button>
        <button
          type="button"
          onClick={() => onMove(card)}
          className="border border-bauhaus-black bg-bauhaus-black px-2 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-bauhaus-red"
        >
          Move
        </button>
      </div>
    </article>
  );
}

function TableCardRows({
  cards,
  onOpen,
}: {
  cards: BoardCard[];
  onOpen: (card: BoardCard) => void;
}) {
  return (
    <div className="overflow-x-auto border border-gray-200 bg-white">
      <table className="w-full min-w-[920px] border-collapse text-left">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-500">
            <th className="px-4 py-3">Lane</th>
            <th className="px-4 py-3">Item</th>
            <th className="px-4 py-3">Value</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Owner</th>
            <th className="px-4 py-3">Next</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {cards.map((card) => (
            <tr key={card.id} className="align-top hover:bg-link-light/60">
              <td className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500">{card.lane}</td>
              <td className="px-4 py-3">
                <button type="button" onClick={() => onOpen(card)} className="text-left">
                  <div className="text-sm font-black text-bauhaus-black">{card.title}</div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-500">{card.subtitle}</div>
                </button>
              </td>
              <td className="px-4 py-3 text-sm font-black text-bauhaus-blue">{card.value}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${statusClass(card.status)}`}>
                  {card.status}
                </span>
              </td>
              <td className="px-4 py-3 text-xs font-black text-gray-700">{card.owner}</td>
              <td className="px-4 py-3 text-xs text-gray-700">{card.next}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MoneyPeopleKanban({
  orgSlug,
  totals,
  operatingFacts,
  moneyRows,
  peopleRows,
  targetRows,
  blockerRows,
  actionRows,
}: {
  orgSlug: string;
  totals: Total[];
  operatingFacts: OperatingFact[];
  moneyRows: MoneyRow[];
  peopleRows: PeopleRow[];
  targetRows: TargetRow[];
  blockerRows: BlockerRow[];
  actionRows: ActionRow[];
}) {
  const [cards, setCards] = useState(() => makeInitialCards({ moneyRows, peopleRows, targetRows, blockerRows, actionRows }));
  const [selected, setSelected] = useState<BoardCard | null>(null);
  const [view, setView] = useState<ViewMode>('board');
  const [filter, setFilter] = useState<SourceFilter>('money');

  const visibleCards = useMemo(() => cards.filter((card) => cardMatchesFilter(card, filter)), [cards, filter]);
  const cardsByLane = useMemo(() => {
    return columns.map((column) => ({
      ...column,
      cards: visibleCards.filter((card) => card.lane === column.lane),
    }));
  }, [visibleCards]);

  const moneyCards = useMemo(() => cards.filter((card) => card.source === 'money'), [cards]);
  const peopleCards = useMemo(() => cards.filter((card) => card.source === 'people'), [cards]);
  const targetCards = useMemo(() => cards.filter((card) => card.source === 'target' || card.source === 'blocker' || card.source === 'action'), [cards]);

  function moveCard(card: BoardCard, lane: BoardLane) {
    setCards((current) => current.map((item) => (item.id === card.id ? { ...item, lane } : item)));
    setSelected((current) => (current?.id === card.id ? { ...current, lane } : current));
  }

  return (
    <div>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {totals.map((item) => (
          <div key={item.label} className="border-4 border-bauhaus-black bg-white p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">{item.label}</div>
            <div className="mt-2 text-3xl font-black text-bauhaus-black">{item.value}</div>
          </div>
        ))}
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {operatingFacts.map((fact) => (
          <div key={fact.label} className="border border-gray-200 bg-white p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">{fact.label}</div>
            <div className="mt-2 text-3xl font-black text-bauhaus-blue">{fact.value}</div>
            <div className="mt-2 text-xs text-gray-600">{fact.detail}</div>
          </div>
        ))}
      </section>

      <section className="mt-6 border-4 border-bauhaus-black bg-white">
        <div className="flex flex-col gap-4 border-b-4 border-bauhaus-black p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-bauhaus-red">Kanban board</div>
            <h2 className="mt-1 text-2xl font-black uppercase tracking-wide">Money, people, paths</h2>
            <div className="mt-1 text-sm text-gray-600">Money opens first. Switch to People, Paths, Blockers, Tasks, or All when you need the wider pile.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ['board', 'Board'],
              ['money', '$ table'],
              ['people', 'People'],
              ['targets', 'Targets'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key as ViewMode)}
                className={`border px-4 py-3 text-[10px] font-black uppercase tracking-widest ${
                  view === key
                    ? 'border-bauhaus-black bg-bauhaus-black text-white'
                    : 'border-gray-300 bg-white text-bauhaus-black hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-gray-200 p-4">
          {[
            ['all', 'All'],
            ['money', '$'],
            ['people', 'People'],
            ['target', 'Paths'],
            ['blocker', 'Blockers'],
            ['action', 'Tasks'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key as SourceFilter)}
              className={`border px-3 py-2 text-[10px] font-black uppercase tracking-widest ${
                filter === key
                  ? 'border-bauhaus-blue bg-link-light text-bauhaus-blue'
                  : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {view === 'board' ? (
          <div className="bg-gray-50 p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {cardsByLane.map((column) => (
                <section key={column.lane} className="min-h-[420px] border border-gray-200 bg-white">
                  <div className="border-b border-gray-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-xs font-black uppercase tracking-widest text-bauhaus-black">{column.title}</h3>
                      <span className="text-xl font-black text-bauhaus-blue">{column.cards.length}</span>
                    </div>
                    <p className="mt-2 min-h-10 text-[11px] leading-relaxed text-gray-500">{column.helper}</p>
                  </div>
                  <div className="space-y-3 p-3">
                    {column.cards.map((card) => (
                      <BoardCardView
                        key={card.id}
                        card={card}
                        onOpen={setSelected}
                        onMove={(item) => moveCard(item, nextLane(item.lane))}
                      />
                    ))}
                    {column.cards.length === 0 ? (
                      <div className="border border-dashed border-gray-300 bg-gray-50 p-4 text-xs text-gray-500">No cards here.</div>
                    ) : null}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : null}

        {view === 'money' ? <TableCardRows cards={moneyCards} onOpen={setSelected} /> : null}
        {view === 'people' ? <TableCardRows cards={peopleCards} onOpen={setSelected} /> : null}
        {view === 'targets' ? <TableCardRows cards={targetCards} onOpen={setSelected} /> : null}
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-3">
        <Link href={`/org/${orgSlug}/goods`} className="border border-gray-200 bg-white p-4 hover:bg-link-light">
          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Goods</div>
          <div className="mt-2 text-lg font-black">Project workspace</div>
        </Link>
        <Link href={`/org/${orgSlug}/contacts`} className="border border-gray-200 bg-white p-4 hover:bg-link-light">
          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">People</div>
          <div className="mt-2 text-lg font-black">Contacts and GHL handoff</div>
        </Link>
        <Link href="/opportunities/ecosystem?project=goods" className="border border-gray-200 bg-white p-4 hover:bg-link-light">
          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Options</div>
          <div className="mt-2 text-lg font-black">Grants, buyers, foundations</div>
        </Link>
      </section>

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-modal="true">
          <button type="button" aria-label="Close detail" className="absolute inset-0 cursor-default" onClick={() => setSelected(null)} />
          <aside className="relative z-10 flex h-full w-full max-w-xl flex-col border-l-4 border-bauhaus-black bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b-4 border-bauhaus-black p-5">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-bauhaus-red">Detail</div>
                <h3 className="mt-2 text-2xl font-black leading-tight text-bauhaus-black">{selected.title}</h3>
                <div className="mt-2 text-xs font-black uppercase tracking-widest text-gray-500">{selected.subtitle}</div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="border border-gray-300 px-3 py-2 text-xs font-black uppercase tracking-widest hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="border border-gray-200 bg-gray-50 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Value</div>
                  <div className="mt-2 break-words text-lg font-black text-bauhaus-blue">{selected.value}</div>
                </div>
                <div className="border border-gray-200 bg-gray-50 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Status</div>
                  <span className={`mt-2 inline-flex border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${statusClass(selected.status)}`}>
                    {selected.status}
                  </span>
                </div>
                <div className="border border-gray-200 bg-gray-50 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Owner</div>
                  <div className="mt-2 text-sm font-black text-bauhaus-black">{selected.owner}</div>
                </div>
                <div className="border border-gray-200 bg-gray-50 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Lane</div>
                  <div className="mt-2 text-sm font-black uppercase tracking-widest text-bauhaus-black">{selected.lane}</div>
                </div>
              </div>

              <div className="mt-4 border border-gray-200 p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Next move</div>
                <p className="mt-2 text-sm leading-relaxed text-gray-700">{selected.next}</p>
              </div>

              {selected.proof ? (
                <div className="mt-4 border border-gray-200 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Proof</div>
                  <p className="mt-2 text-sm font-black text-bauhaus-black">{selected.proof}</p>
                </div>
              ) : null}

              <div className="mt-5 grid gap-2">
                <button
                  type="button"
                  onClick={() => moveCard(selected, previousLane(selected.lane))}
                  className="border border-gray-300 bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-bauhaus-black hover:bg-gray-50"
                >
                  Move back
                </button>
                <button
                  type="button"
                  onClick={() => moveCard(selected, nextLane(selected.lane))}
                  className="border border-bauhaus-black bg-bauhaus-black px-4 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-bauhaus-red"
                >
                  Move forward
                </button>
                <button
                  type="button"
                  onClick={() => moveCard(selected, 'parked')}
                  className="border border-bauhaus-red bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-bauhaus-red hover:bg-red-50"
                >
                  Park
                </button>
                {selected.href ? (
                  <Link
                    href={selected.href}
                    className="border border-bauhaus-blue bg-link-light px-4 py-3 text-center text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:bg-white"
                  >
                    Open surface
                  </Link>
                ) : null}
              </div>

              <div className="mt-5 border border-gray-200 bg-gray-50 p-4 text-xs leading-relaxed text-gray-600">
                Local board move only. This does not write to Supabase, finance, HighLevel, Xero, or Notion.
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

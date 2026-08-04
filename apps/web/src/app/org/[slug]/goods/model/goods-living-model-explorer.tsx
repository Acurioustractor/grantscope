'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import {
  Bed,
  BookOpen,
  Buildings,
  CalendarBlank,
  CaretRight,
  CheckCircle,
  Cube,
  CurrencyDollar,
  Database,
  FileText,
  Lightbulb,
  MagnifyingGlass,
  MapPin,
  ShieldWarning,
  UserCircle,
  UsersThree,
  WashingMachine,
  WarningCircle,
} from '@phosphor-icons/react';
import {
  GOODS_CLAIM_LEDGER,
  GOODS_COST_CENTRES,
  GOODS_FORMS,
  GOODS_MONEY_DOORS,
  GOODS_PLACE_PATHWAYS,
  GOODS_PUBLIC_STAGES,
  GOODS_ROAD,
  GOODS_UNIT_ECONOMICS,
  type GoodsEvidenceStatus,
  type GoodsPlacePathway,
} from '@/lib/services/goods-living-investment-model';
import type {
  GoodsLivingModelSnapshot,
  GoodsLivingPlaceSnapshot,
} from '@/lib/services/goods-living-data-adapter';
import type { GoodsMatterDeskSnapshot } from '@/lib/services/goods-matter-desk';
import type { ActMatterDeskMatter } from '@/lib/services/act-matter-desk';

type ContextView = 'story' | 'evidence' | 'economics' | 'structure';

const STATUS_LABEL: Record<GoodsEvidenceStatus, string> = {
  verified: 'Verified',
  workpaper: 'Workpaper',
  modelled: 'Modelled',
  'community-confirmation': 'Confirm together',
  open: 'Open',
  retired: 'Retired',
};

const STATUS_TONE: Record<GoodsEvidenceStatus, string> = {
  verified: 'border-[#1f734f]/20 bg-[#edf7f1] text-[#15563c]',
  workpaper: 'border-[#9a7125]/25 bg-[#fff8e7] text-[#6b5016]',
  modelled: 'border-[#2563eb]/20 bg-[#eff6ff] text-[#1d4ed8]',
  'community-confirmation': 'border-[#8d4c2f]/20 bg-[#fbefe9] text-[#7a3f28]',
  open: 'border-[#b42318]/20 bg-[#fff1f0] text-[#9f1c14]',
  retired: 'border-slate-300 bg-slate-100 text-slate-500 line-through',
};

function formatDate(value: string | null) {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function StatusChip({ status }: { status: GoodsEvidenceStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_TONE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function qualityLabel(state: GoodsLivingPlaceSnapshot['decisionRead']['qualityState']) {
  if (state === 'clear') return 'Connected records clear';
  if (state === 'partial') return 'Connected records partial';
  if (state === 'review-required') return 'Review required';
  return 'Source unavailable';
}

function qualityTone(state: GoodsLivingPlaceSnapshot['decisionRead']['qualityState']) {
  if (state === 'clear') return 'text-[#15563c]';
  if (state === 'partial') return 'text-[#2563eb]';
  return 'text-[#9f1c14]';
}

function compactCoordinationLabel(label: string) {
  return label.replace(/^Internal coordination:\s*/i, '');
}

function PlaceList({
  selectedId,
  onSelect,
  snapshot,
  desk,
}: {
  selectedId: GoodsPlacePathway['id'];
  onSelect: (id: GoodsPlacePathway['id']) => void;
  snapshot: GoodsLivingModelSnapshot;
  desk: GoodsMatterDeskSnapshot;
}) {
  const [query, setQuery] = useState('');
  const places = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return GOODS_PLACE_PATHWAYS;
    return GOODS_PLACE_PATHWAYS.filter((place) =>
      `${place.name} ${place.country}`.toLowerCase().includes(search),
    );
  }, [query]);

  return (
    <aside className="border-b border-slate-200 bg-white xl:border-b-0 xl:border-r" aria-label="Goods places">
      <div className="border-b border-slate-200 px-5 py-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.025em] text-slate-950">Places</h2>
            <p className="mt-1 text-sm text-slate-500">{desk.matterOrder.length} active matters</p>
          </div>
          <span className="rounded-full bg-[#edf7f1] px-2.5 py-1 text-xs font-semibold text-[#15563c]">
            {desk.project.label}
          </span>
        </div>
        <label className="relative mt-4 block">
          <span className="sr-only">Search places</span>
          <MagnifyingGlass
            size={18}
            weight="regular"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search places"
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-[#2f8f64] focus:bg-white focus:ring-4 focus:ring-[#2f8f64]/10"
          />
        </label>
      </div>

      <div
        role="tablist"
        aria-label="Choose a Goods place"
        className="flex overflow-x-auto xl:block xl:overflow-visible"
      >
        {places.map((item) => {
          const active = item.id === selectedId;
          const place = snapshot.places[item.id];
          return (
            <button
              key={item.id}
              id={`goods-place-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="goods-place-workspace"
              tabIndex={active ? 0 : -1}
              onClick={() => onSelect(item.id)}
              onKeyDown={(event) => {
                const currentIndex = GOODS_PLACE_PATHWAYS.findIndex((candidate) => candidate.id === item.id);
                const nextIndex =
                  event.key === 'ArrowDown' || event.key === 'ArrowRight'
                    ? (currentIndex + 1) % GOODS_PLACE_PATHWAYS.length
                    : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
                      ? (currentIndex - 1 + GOODS_PLACE_PATHWAYS.length) % GOODS_PLACE_PATHWAYS.length
                      : event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? GOODS_PLACE_PATHWAYS.length - 1
                          : null;
                if (nextIndex === null) return;
                event.preventDefault();
                const nextId = GOODS_PLACE_PATHWAYS[nextIndex].id;
                onSelect(nextId);
                requestAnimationFrame(() => document.getElementById(`goods-place-tab-${nextId}`)?.focus());
              }}
              className={`group relative min-h-[108px] min-w-[220px] flex-none border-b border-r border-slate-200 px-5 py-4 text-left transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#2f8f64]/20 xl:min-h-[116px] xl:min-w-0 xl:border-r-0 xl:py-5 ${
                active ? 'bg-[#f3f8f5]' : 'bg-white hover:bg-slate-50'
              }`}
            >
              <span
                className={`absolute inset-y-0 left-0 w-1 transition-colors ${
                  active ? 'bg-[#2f8f64]' : 'bg-transparent group-hover:bg-slate-200'
                }`}
                aria-hidden
              />
              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="block text-[15px] font-semibold text-slate-950">{item.name}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-500">{item.country}</span>
                </span>
                <CaretRight
                  size={18}
                  weight="bold"
                  className={`mt-1 transition ${active ? 'text-[#1f734f]' : 'text-slate-300 group-hover:text-slate-500'}`}
                  aria-hidden
                />
              </span>
              <span
                className={`mt-3 flex items-center gap-2 text-xs font-medium ${qualityTone(
                  place.decisionRead.qualityState,
                )}`}
              >
                {place.decisionRead.qualityState === 'clear' ? (
                  <CheckCircle size={16} weight="fill" aria-hidden />
                ) : (
                  <WarningCircle size={16} weight="regular" aria-hidden />
                )}
                {qualityLabel(place.decisionRead.qualityState)}
              </span>
            </button>
          );
        })}
        {places.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">No place matches “{query}”.</div>
        ) : null}
      </div>
    </aside>
  );
}

function DecisionBand({ matter }: { matter: ActMatterDeskMatter }) {
  return (
    <section className="grid gap-5 rounded-2xl border border-[#d7b16a]/40 bg-[#fffaf1] p-5 lg:grid-cols-[1.2fr_0.9fr_160px] lg:p-6">
      <div className="flex gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#b9812d] text-white">
          <Lightbulb size={21} weight="fill" aria-hidden />
        </span>
        <div>
          <div className="text-xs font-semibold text-[#7c5f21]">Next decision</div>
          <p className="mt-2 max-w-xl text-base font-semibold leading-6 text-slate-950">{matter.nextDecision}</p>
        </div>
      </div>
      <div className="border-t border-[#d7b16a]/30 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
        <div className="text-xs font-semibold text-[#7c5f21]">Unresolved questions</div>
        <ol className="mt-2 space-y-2">
          {matter.unresolvedQuestions.slice(0, 2).map((question, index) => (
            <li key={question} className="flex gap-2 text-xs leading-5 text-slate-700">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white font-semibold text-[#7c5f21]">
                {index + 1}
              </span>
              {question}
            </li>
          ))}
        </ol>
      </div>
      <div className="border-t border-[#d7b16a]/30 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
        <div className="text-xs font-semibold text-[#7c5f21]">Owner</div>
        <div className="mt-3 flex items-center gap-3 lg:block">
          <UserCircle size={42} weight="thin" className="text-slate-400" aria-hidden />
          <div className="text-sm font-medium text-slate-700 lg:mt-1">
            {matter.nextAction.owner ?? 'Unassigned'}
          </div>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          {matter.nextAction.dueAt ? `Due ${formatDate(matter.nextAction.dueAt)}` : 'Due date not set'}
        </div>
      </div>
    </section>
  );
}

function PathwayPanel({
  pathway,
  currentStageIndex,
}: {
  pathway: GoodsPlacePathway;
  currentStageIndex: number;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <UsersThree size={21} weight="regular" className="text-[#2f8f64]" aria-hidden />
          <h3 className="text-base font-semibold text-slate-950">Human-held pathway</h3>
        </div>
        <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600">
          Not a score
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-600">
        Current human-held working position. It is not a CRM stage, consent or linear progress.
      </p>

      <ol className="relative mt-4 space-y-0.5 before:absolute before:bottom-5 before:left-[9px] before:top-5 before:w-px before:bg-slate-200">
        {GOODS_PUBLIC_STAGES.map((stage, index) => {
          const active = index === currentStageIndex;
          return (
            <li
              key={stage.id}
              className={`relative flex min-h-11 items-center gap-3 rounded-xl py-1.5 pl-9 pr-3 ${
                active ? 'bg-[#edf7f1]' : ''
              }`}
            >
              <span
                className={`absolute left-0 grid h-5 w-5 place-items-center rounded-full border-2 ${
                  active
                    ? 'border-white bg-[#2f8f64] ring-2 ring-[#bfe0cc]'
                    : 'border-slate-300 bg-white'
                }`}
                aria-hidden
              />
              <span>
                <span className={`block text-sm font-semibold ${active ? 'text-[#15563c]' : 'text-slate-700'}`}>
                  {stage.label}
                </span>
                <span className="block text-xs text-slate-500">{stage.holds}</span>
              </span>
              {active ? (
                <span className="ml-auto rounded-full border border-[#1f734f]/15 bg-white px-2 py-1 text-[10px] font-semibold text-[#15563c]">
                  Current
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

    </section>
  );
}

function EvidencePanel({ place }: { place: GoodsLivingPlaceSnapshot }) {
  const read = place.decisionRead;
  const rows = [
    {
      label: read.authority.label,
      note: `${read.relationshipEvidence.label}. ${read.relationshipEvidence.totalTouchpoints.toLocaleString('en-AU')} interaction episodes; latest ${formatDate(read.relationshipEvidence.latestContactAt)}.`,
      icon: ShieldWarning,
      tone: 'text-[#2563eb]',
    },
    {
      label: read.currentAuthorisedRequest.label,
      note: read.currentAuthorisedRequest.note,
      icon: FileText,
      tone: 'text-[#2563eb]',
    },
    {
      label: `Internal: ${compactCoordinationLabel(read.coordination.label)} — not an order`,
      note: read.coordination.note,
      icon: Cube,
      tone: 'text-[#2563eb]',
    },
    {
      label: `${read.conflicts.length.toLocaleString('en-AU')} quarantined conflicts`,
      note:
        read.conflicts.length === 0
          ? 'No current source conflict is quarantined for this place.'
          : 'Conflicts stay separate until a human review resolves their meaning.',
      icon: read.conflicts.length === 0 ? CheckCircle : WarningCircle,
      tone: read.conflicts.length === 0 ? 'text-[#2f8f64]' : 'text-[#b42318]',
    },
    {
      label: read.humanReview.label,
      note: read.humanReview.note,
      icon: UserCircle,
      tone: 'text-[#2563eb]',
    },
  ];

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Database size={21} weight="regular" className="text-[#2563eb]" aria-hidden />
          <h3 className="text-base font-semibold text-[#1d4ed8]">Connected evidence</h3>
        </div>
        <span className="rounded-full border border-[#2563eb]/15 bg-[#eff6ff] px-2.5 py-1 text-[11px] font-medium text-[#1d4ed8]">
          System view
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-600">
        What connected systems can confirm. Never a replacement for relationship knowledge.
      </p>

      <div className="mt-4 divide-y divide-slate-200">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <details key={row.label} className="group">
              <summary className="flex min-h-[66px] cursor-pointer list-none items-center gap-3 py-3 marker:hidden">
                <Icon size={22} weight="regular" className={`shrink-0 ${row.tone}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-5 text-slate-900">{row.label}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500 group-open:whitespace-normal">
                    {row.note}
                  </span>
                </span>
                <CaretRight
                  size={16}
                  weight="bold"
                  className="shrink-0 text-slate-400 transition group-open:rotate-90"
                  aria-hidden
                />
              </summary>
              {read.conflicts.length > 0 && row.label.includes('quarantined') ? (
                <div className="space-y-2 pb-3 pl-9">
                  {read.conflicts.map((conflict) => (
                    <div key={conflict.id} className="rounded-lg bg-[#fff7f5] p-3 text-xs leading-5 text-slate-700">
                      <strong className="block text-[#9f1c14]">{conflict.label}</strong>
                      {conflict.note}
                    </div>
                  ))}
                </div>
              ) : null}
            </details>
          );
        })}
      </div>

    </section>
  );
}

function EconomicsPanel({ pathway }: { pathway: GoodsPlacePathway }) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <CurrencyDollar size={21} weight="regular" className="text-[#2f8f64]" aria-hidden />
          <h3 className="text-base font-semibold text-slate-950">Economics</h3>
        </div>
        <span className="rounded-full border border-[#1f734f]/15 bg-[#edf7f1] px-2.5 py-1 text-[11px] font-medium text-[#15563c]">
          Model + workpaper
        </span>
      </div>

      <div className="mt-4 space-y-2.5">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium text-slate-600">{pathway.capital.label}</span>
            <StatusChip status={pathway.capital.status} />
          </div>
          <div className="mt-2 text-[1.35rem] font-semibold tracking-[-0.035em] text-[#16834f]">{pathway.capital.value}</div>
          <p className="mt-1.5 text-xs leading-5 text-slate-600">
            $63,967–$78,467 modules plus a $31,800–$64,000 site base. Scenario, not quote.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium text-slate-600">Operating allocation</span>
            <StatusChip status={pathway.operating.status} />
          </div>
          <div className="mt-2 text-[1.35rem] font-semibold tracking-[-0.035em] text-[#16834f]">$79.3K / year</div>
          <p className="mt-1.5 text-xs leading-5 text-slate-600">
            Before a line supervisor. Community support and wraparound remain separate.
          </p>
        </div>
        <div className="rounded-xl border border-[#1f734f]/15 bg-[#f2f8f4] p-3.5">
          <div className="flex gap-3">
            <UsersThree size={20} weight="regular" className="shrink-0 text-[#1f734f]" aria-hidden />
            <div>
              <div className="text-sm font-semibold text-[#15563c]">Contribution is not surplus.</div>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Carries the operator, warranty, maintenance, depreciation and shared network.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const CONTEXT_TABS: Array<{
  id: ContextView;
  label: string;
  detail: string;
  icon: typeof BookOpen;
}> = [
  { id: 'story', label: 'Story', detail: 'Place context and path', icon: BookOpen },
  { id: 'evidence', label: 'Evidence ledger', detail: 'Claims and source status', icon: FileText },
  { id: 'economics', label: 'Economics', detail: 'Model and workpaper', icon: CurrencyDollar },
  { id: 'structure', label: 'Structure', detail: 'Organisation and ownership', icon: Buildings },
];

function ContextPanel({ active }: { active: ContextView }) {
  if (active === 'story') {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {GOODS_ROAD.map((stop) => (
          <article key={stop.number} className="border-l-2 border-[#bfe0cc] pl-4">
            <div className="text-xs font-semibold text-[#1f734f]">
              {String(stop.number).padStart(2, '0')} · {stop.place}
            </div>
            <h4 className="mt-2 text-sm font-semibold text-slate-950">{stop.title}</h4>
            <p className="mt-1 text-xs leading-5 text-slate-600">{stop.truth}</p>
          </article>
        ))}
      </div>
    );
  }

  if (active === 'evidence') {
    return (
      <div className="divide-y divide-slate-200">
        {GOODS_CLAIM_LEDGER.map((claim) => (
          <div key={claim.label} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <div className="text-sm font-semibold text-slate-950">{claim.label}</div>
              <div className="mt-1 text-sm text-slate-700">{claim.value}</div>
              <p className="mt-1 text-xs leading-5 text-slate-500">{claim.note}</p>
            </div>
            <StatusChip status={claim.status} />
          </div>
        ))}
      </div>
    );
  }

  if (active === 'economics') {
    return (
      <div>
        <div className="grid gap-4 md:grid-cols-3">
          {GOODS_COST_CENTRES.map((centre) => (
            <article key={centre.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-950">{centre.label}</h4>
                <StatusChip status={centre.status} />
              </div>
              <div className="mt-3 text-lg font-semibold text-[#15563c]">{centre.amount}</div>
              <p className="mt-2 text-xs leading-5 text-slate-600">{centre.includes}</p>
              <p className="mt-3 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-500">{centre.boundary}</p>
            </article>
          ))}
        </div>
        <div className="mt-5 grid gap-3 rounded-xl bg-[#183426] p-5 text-white sm:grid-cols-3">
          <div>
            <div className="text-xs text-white/60">Sale price</div>
            <div className="mt-1 text-2xl font-semibold">${GOODS_UNIT_ECONOMICS.salePrice.toFixed(0)}</div>
          </div>
          <div>
            <div className="text-xs text-white/60">Bought-kit cost</div>
            <div className="mt-1 text-2xl font-semibold">${GOODS_UNIT_ECONOMICS.currentMarginalCost.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-white/60">Modelled pressed cost</div>
            <div className="mt-1 text-2xl font-semibold">${GOODS_UNIT_ECONOMICS.pressedMarginalCost.toFixed(2)}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div>
        <h4 className="text-sm font-semibold text-slate-950">Three organisational jobs</h4>
        <div className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200">
          {GOODS_FORMS.map((form) => (
            <div key={form.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-semibold text-slate-950">{form.label}</div>
                <span className="text-xs font-medium capitalize text-slate-500">{form.status}</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-600">{form.holds}</p>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-sm font-semibold text-slate-950">Three money doors</h4>
        <div className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200">
          {GOODS_MONEY_DOORS.map((door) => (
            <div key={door.id} className="p-4">
              <div className="text-xs font-semibold text-[#1f734f]">{door.label}</div>
              <div className="mt-1 text-sm font-semibold text-slate-950">{door.verb}</div>
              <p className="mt-1 text-xs leading-5 text-slate-600">{door.paysFor}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GoodsLivingModelExplorer({
  snapshot,
  desk,
}: {
  snapshot: GoodsLivingModelSnapshot;
  desk: GoodsMatterDeskSnapshot;
}) {
  const [selectedId, setSelectedId] = useState<GoodsPlacePathway['id']>('oonchiumpa');
  const [contextView, setContextView] = useState<ContextView>('story');
  const pathway =
    GOODS_PLACE_PATHWAYS.find((item) => item.id === selectedId) ?? GOODS_PLACE_PATHWAYS[0];
  const place = snapshot.places[pathway.id];
  const matter = desk.matters[pathway.id];
  const currentStageIndex = GOODS_PUBLIC_STAGES.findIndex((stage) => stage.id === pathway.stage);
  const impact = snapshot.impact;

  return (
    <div className="min-h-screen bg-[#f5f7f6] text-slate-950">
      <div className="grid min-h-screen xl:grid-cols-[300px_minmax(0,1fr)]">
        <PlaceList selectedId={pathway.id} onSelect={setSelectedId} snapshot={snapshot} desk={desk} />

        <main
          id="goods-place-workspace"
          role="tabpanel"
          aria-labelledby={`goods-place-tab-${pathway.id}`}
          className="min-w-0"
        >
          <header className="border-b border-slate-200 bg-white px-5 py-5 sm:px-7 lg:px-8">
            <div className="flex items-start justify-between gap-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <span>{desk.project.label}</span>
                  <CaretRight size={12} weight="bold" aria-hidden />
                  <span>Place decision desk</span>
                </div>
                <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-3xl">
                  {matter.title} decision desk
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <MapPin size={17} weight="regular" aria-hidden />
                    {matter.placeLabel}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CalendarBlank size={17} weight="regular" aria-hidden />
                    Read {formatDate(matter.readAt)}
                  </span>
                  <span>
                    Working stage:{' '}
                    <strong className="font-semibold text-[#16834f]">
                      {matter.pathway.label}
                    </strong>
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
                  <span className="flex items-center gap-2">
                    <Bed size={19} weight="regular" className="text-slate-500" aria-hidden />
                    {impact.beds.deployed.toLocaleString('en-AU')} beds
                  </span>
                  <span className="flex items-center gap-2">
                    <WashingMachine size={19} weight="regular" className="text-slate-500" aria-hidden />
                    {impact.washers.inCommunity.toLocaleString('en-AU')} washers
                  </span>
                  <span className="flex items-center gap-2">
                    <UsersThree size={19} weight="regular" className="text-slate-500" aria-hidden />
                    {impact.communitiesServed.toLocaleString('en-AU')} communities
                  </span>
                </div>
              </div>

              <div className="relative hidden h-[118px] w-[210px] shrink-0 overflow-hidden rounded-2xl sm:block">
                <Image
                  src="/goods/hero.jpg"
                  alt="People carrying a Stretch Bed together on Country"
                  fill
                  priority
                  sizes="210px"
                  className="object-cover"
                />
              </div>
            </div>
          </header>

          <div className="!mx-0 !max-w-none space-y-4 p-4 sm:p-6 lg:p-7">
            <DecisionBand matter={matter} />

            <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-[0.95fr_1.08fr_0.88fr]">
              <PathwayPanel pathway={pathway} currentStageIndex={currentStageIndex} />
              <EvidencePanel place={place} />
              <EconomicsPanel pathway={pathway} />
            </div>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div
                role="tablist"
                aria-label="Goods model supporting context"
                className="grid border-b border-slate-200 sm:grid-cols-2 xl:grid-cols-4"
              >
                {CONTEXT_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const active = contextView === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      aria-controls="goods-context-panel"
                      onClick={() => setContextView(tab.id)}
                      className={`relative flex min-h-[76px] items-center gap-3 border-b px-4 text-left transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#2f8f64]/20 sm:border-r ${
                        active ? 'bg-[#f5faf7]' : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <Icon
                        size={24}
                        weight="regular"
                        className={active ? 'text-[#2f8f64]' : 'text-slate-500'}
                        aria-hidden
                      />
                      <span>
                        <span className={`block text-sm font-semibold ${active ? 'text-[#15563c]' : 'text-slate-900'}`}>
                          {tab.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">{tab.detail}</span>
                      </span>
                      <span
                        className={`absolute inset-x-0 bottom-0 h-0.5 ${active ? 'bg-[#2f8f64]' : 'bg-transparent'}`}
                        aria-hidden
                      />
                    </button>
                  );
                })}
              </div>
              <div id="goods-context-panel" role="tabpanel" className="p-5 sm:p-6">
                <ContextPanel active={contextView} />
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

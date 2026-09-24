// The One Desk — promoted from /prototype-one (Ben picked variant B, 2026-08-05,
// with A's "do this now" hero and C's urgency grouping folded in). One ranked
// pool over every workable record; project and type are filters, never places.
// Skin: Quiet Ledger (the ONE visual family — tokens mirror pencil-new.pen).
// 2026-09-24: the one place to decide on money. Grant, funder and buyer rows carry Pursue / Pass /
// Save for later (opportunity_decisions); grant rows say why they are here (keyword and Jev) and who can apply.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isActSlug } from '@/lib/services/fast-local-org';
import { getOneDesk, deskHorizon, type DeskRecord, type DeskHorizon, type DeskGrantFacts } from '@/lib/services/act-one-desk';
import { passReasonLabel } from '@/lib/services/act-desk-decisions';
import { jevWords } from '@/lib/services/act-project-grants-triage';
import { ENTITY_LABEL, type Verdict } from '@/lib/act-grant-eligibility';
import { money } from '@/lib/format';
import { DeskMarkButtons } from './desk-mark-buttons';
import { DeskObligationButtons } from './desk-obligation-buttons';
import { DeskDecisionButtons } from './desk-decision-buttons';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'One Desk — everything ranked — CivicGraph' };
}

const KIND_STYLE: Record<DeskRecord['kind'], string> = {
  funder: 'bg-ql-kind-funder', grant: 'bg-ql-kind-grant', buyer: 'bg-ql-kind-buyer',
  money: 'bg-ql-kind-money', obligation: 'bg-ql-kind-obligation', person: 'bg-ql-kind-person',
};

/** Plain words for the record kinds — the internal names confused the one
 * human this desk serves (Ben, 2026-08-05 review). */
const KIND_FILTER_LABEL: Record<DeskRecord['kind'], string> = {
  money: 'Money owed to us', obligation: 'We owe', person: 'People',
  funder: 'Funders', grant: 'Grant rounds', buyer: 'Buyers',
};

const KIND_CHIP_LABEL: Record<DeskRecord['kind'], string> = {
  money: 'owed', obligation: 'we owe', person: 'person', funder: 'funder', grant: 'round', buyer: 'buyer',
};

const HORIZON_LABEL: Record<DeskHorizon, string> = {
  overdue: 'Overdue', fortnight: 'This fortnight', quarter: 'This quarter', undated: 'No date · ranked by fit',
};

const DECIDABLE = new Set<DeskRecord['kind']>(['grant', 'funder', 'buyer']);

const TAGGED_BY_WORDS: Record<string, string> = {
  keyword: 'the keyword scorer', rubric: 'Jev', both: 'the keyword scorer and Jev', human: 'you',
};

const VERDICT_WORDS: Record<Verdict, string> = { yes: 'yes', no: 'no', unknown: 'not stated' };
const AREA_WORDS: Record<Verdict, string> = {
  yes: 'works inside the grant’s area', no: 'works outside the grant’s area', unknown: 'the grant does not say where',
};

function dateWords(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function amountRange(g: DeskGrantFacts): string | null {
  if (g.amountMin != null && g.amountMax != null && g.amountMin !== g.amountMax) return `${money(g.amountMin)} to ${money(g.amountMax)}`;
  if (g.amountMax != null) return `up to ${money(g.amountMax)}`;
  if (g.amountMin != null) return `from ${money(g.amountMin)}`;
  return null;
}

function Due({ d }: { d: number | null }) {
  if (d == null) return <span className="font-ql-mono text-[11px] text-ql-muted">—</span>;
  if (d < 0) return <span className="font-ql-mono text-[11px] font-semibold text-ql-alert">{-d}d overdue</span>;
  if (d <= 14) return <span className="font-ql-mono text-[11px] font-semibold text-ql-alert">{d}d</span>;
  return <span className="font-ql-mono text-[11px] font-medium text-ql-ink">{d}d</span>;
}

function KindChip({ k }: { k: DeskRecord['kind'] }) {
  return (
    <span className={`rounded px-1.5 py-0.5 font-ql-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-ql-inverse ${KIND_STYLE[k]}`}>
      {KIND_CHIP_LABEL[k]}
    </span>
  );
}

/** Why a grant is on the desk: both signals, in plain words, and which one put the tag there. */
function WhyItsHere({ g, project }: { g: DeskGrantFacts; project: string }) {
  const jev = g.jevScore == null
    ? 'has not read it yet'
    : `${jevWords(g.jevScore)} (${g.jevScore.toFixed(1)} of 3${g.jevConfidence != null ? `, ${Math.round(g.jevConfidence * 100)}% sure` : ''})${g.jevOutsideArea ? ', but outside the project’s area' : ''}`;
  return (
    <div className="mt-5 rounded-md border border-ql-border px-4 py-3">
      <div className="font-ql-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ql-accent">Why it’s here</div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-ql-text2">Keywords</dt>
        <dd><span className="font-ql-mono font-semibold">{g.keyword}</span> of 100 for {project}</dd>
        <dt className="text-ql-text2">Jev</dt>
        <dd>{jev}</dd>
        <dt className="text-ql-text2">Tagged by</dt>
        <dd>{g.taggedBy ? TAGGED_BY_WORDS[g.taggedBy] : 'not recorded (tagged before 14 Sep)'}</dd>
      </dl>
    </div>
  );
}

function WhoCanApply({ g }: { g: DeskGrantFacts }) {
  const e = g.eligibility;
  return (
    <div className="mt-3 rounded-md border border-ql-border px-4 py-3">
      <div className="font-ql-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ql-accent">Who can apply</div>
      <ul className="mt-2 space-y-1 text-sm">
        {e.entities.map((x) => (
          <li key={x.entity} className="flex justify-between gap-4">
            <span>{ENTITY_LABEL[x.entity]}</span>
            <span className={`font-ql-mono text-[12px] ${x.verdict === 'yes' ? 'text-ql-moss' : x.verdict === 'no' ? 'text-ql-alert' : 'text-ql-muted'}`}>{VERDICT_WORDS[x.verdict]}</span>
          </li>
        ))}
        <li className="flex justify-between gap-4 border-t border-ql-border/60 pt-1">
          <span>Where</span>
          <span className={`text-[12px] ${e.location === 'yes' ? 'text-ql-moss' : e.location === 'no' ? 'text-ql-alert' : 'text-ql-muted'}`}>{AREA_WORDS[e.location]}</span>
        </li>
      </ul>
    </div>
  );
}

export default async function OneDeskPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  if (!isActSlug(slug)) notFound();
  const sp = await searchParams;
  // Saved and Passed are views of the desk, reached from the rail under One Desk.
  const view = sp.kind === 'saved' || sp.kind === 'passed' ? sp.kind : null;
  const kind = !view && typeof sp.kind === 'string' && ['funder', 'grant', 'buyer', 'money', 'obligation', 'person'].includes(sp.kind) ? (sp.kind as DeskRecord['kind']) : null;
  const project = typeof sp.project === 'string' ? sp.project : null;

  const { active: all, saved, passed, handled, orgProfileId, target } = await getOneDesk(slug);
  const asks = all.filter((r) => !r.isDecision && r.kind !== 'obligation' && r.kind !== 'person');
  const decisions = all.filter((r) => r.isDecision);
  const owedCount = all.filter((r) => r.kind === 'obligation').length;
  const peopleCount = all.filter((r) => r.kind === 'person').length;
  const source = view === 'saved' ? saved : view === 'passed' ? passed : all;
  const projects = [...new Set(source.map((r) => r.project))].sort();
  const pool = source.filter((r) => (!kind || r.kind === kind) && (!project || r.project === project));
  const selected = (typeof sp.rec === 'string' ? pool.find((r) => r.id === sp.rec) : null) ?? pool[0] ?? null;
  const base = `/org/${slug}/desk`;
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...(view ? { kind: view } : kind ? { kind } : {}), ...(project ? { project } : {}), ...extra });
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };

  const groups: Array<{ horizon: DeskHorizon | 'decided'; items: DeskRecord[] }> = [];
  if (view) {
    if (pool.length) groups.push({ horizon: 'decided', items: pool.slice(0, 200) });
  } else {
    for (const r of pool.slice(0, 80)) {
      const h = deskHorizon(r);
      const last = groups[groups.length - 1];
      if (last && last.horizon === h) last.items.push(r);
      else groups.push({ horizon: h, items: [r] });
    }
  }
  const shownCount = groups.reduce((n, g) => n + g.items.length, 0);

  // Only non-zero counts: a confident zero reads as a measurement (CLAUDE.md, "the tell").
  const counts = view
    ? [`${pool.length} ${view}`]
    : [
        asks.length ? `${asks.length} being worked` : null,
        decisions.length ? `${decisions.length} to decide` : null,
        owedCount ? `${owedCount} owed` : null,
        peopleCount ? `${peopleCount} people` : null,
        handled.length ? `${handled.length} handled today` : null,
      ].filter(Boolean);

  // Jev coverage over the grant rounds in view, so a thin read is visible where the fit is shown.
  const grantRows = pool.filter((r) => r.grant);
  const jevRead = grantRows.filter((r) => r.grant?.jevScore != null).length;

  const chip = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-[11px] font-medium transition-colors ${
      active ? 'border-ql-bar bg-ql-bar text-ql-inverse' : 'border-ql-border bg-ql-surface text-ql-text2 hover:border-ql-muted'
    }`;

  const heading = view === 'saved' ? 'Saved for later' : view === 'passed' ? 'Passed' : 'One Desk';

  return (
    <main className="min-h-screen bg-ql-surface2 p-6 text-ql-ink">
      <div className="mx-auto max-w-[1760px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-ql-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ql-accent">
              {counts.join(' · ')}
              {kind ? (
                <>
                  {counts.length ? ' · ' : ''}showing {KIND_FILTER_LABEL[kind].toLowerCase()}{' '}
                  <Link href={project ? `${base}?project=${encodeURIComponent(project)}` : base} className="underline hover:text-ql-ink">✕</Link>
                </>
              ) : null}
            </div>
            <h1 className="mt-1 font-ql-display text-4xl font-semibold">{heading}</h1>
            {view ? (
              <p className="mt-1.5 text-sm text-ql-text2">
                {view === 'saved' ? 'Off the queue until you put them back.' : 'Off the queue. A “not a fit” pass also keeps that project’s tag off the grant.'}
              </p>
            ) : target ? (
              <p className="mt-1.5 text-sm text-ql-text2">
                <span className="font-medium text-ql-ink">{target.label}:</span>{' '}
                <span className={`font-ql-mono font-semibold ${target.committedAud > 0 ? 'text-ql-moss' : 'text-ql-alert'}`}>{money(target.committedAud)}</span>
                {' '}committed of {money(target.needMinAud)} to {money(target.needMaxAud)} needed · {money(target.askMadeAud)} asked
              </p>
            ) : null}
          </div>
          {/* Kind lenses live in the rail under One Desk (Ben, 2026-08-05);
              the header keeps only the project filter. */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="font-ql-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-ql-muted">Only show project</span>
            {projects.map((p) => (
              <Link key={p} href={project === p ? (view ? `${base}?kind=${view}` : kind ? `${base}?kind=${kind}` : base) : qs({ project: p })} className={chip(project === p)}>
                {p}{project === p ? ' ✕' : ''}
              </Link>
            ))}
          </div>
        </div>

        {/* A's contribution: the single directed move, always on top. */}
        {!view && selected && selected.id === pool[0]?.id ? (
          <div className="mt-5 flex flex-wrap items-baseline gap-3 rounded-lg border border-ql-border bg-ql-warm px-5 py-3">
            <span className="font-ql-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ql-accent">Do this now</span>
            <span className="font-ql-display text-lg font-semibold">{pool[0].name}</span>
            <span className="text-sm text-ql-text2">{pool[0].next}</span>
          </div>
        ) : null}

        {/* B: the split desk. */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="max-h-[74vh] overflow-y-auto rounded-lg border border-ql-border bg-ql-surface">
            {groups.map((group) => (
              <div key={group.horizon}>
                <div className={`sticky top-0 z-10 px-4 py-1.5 font-ql-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ql-inverse ${group.horizon === 'overdue' ? 'bg-ql-alert' : 'bg-ql-bar'}`}>
                  {group.horizon === 'decided' ? `Newest first · ${group.items.length}` : `${HORIZON_LABEL[group.horizon]} · ${group.items.length}`}
                </div>
                {group.items.map((r) => (
                  <Link
                    key={r.id}
                    href={qs({ rec: r.id })}
                    className={`flex items-center gap-2.5 border-t border-ql-border/60 px-4 py-2.5 text-sm first:border-t-0 ${selected?.id === r.id ? 'bg-ql-warm' : 'hover:bg-ql-surface2'}`}
                  >
                    <KindChip k={r.kind} />
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {r.name}
                      {r.kind === 'person' && <span className="font-normal text-ql-text2"> · {r.next}</span>}
                    </span>
                    <span className="hidden shrink-0 text-[11px] text-ql-text2 sm:inline">{r.project}</span>
                    {r.isDecision && !view && <span className="rounded-full border border-ql-accent px-2 py-0.5 font-ql-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-ql-accent">decide</span>}
                    {r.decision?.state === 'pursuing' && !view && <span className="rounded-full border border-ql-moss px-2 py-0.5 font-ql-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-ql-moss">pursuing</span>}
                    {r.kind === 'obligation' && r.owedTo && <span className="font-ql-mono text-[11px] text-ql-muted">→ {r.owedTo}</span>}
                    {r.kind === 'person' && r.via && <span className="text-[11px] italic text-ql-muted">via {r.via}</span>}
                    {r.amount && <span className="font-ql-mono text-[11px] font-semibold">{r.amount}</span>}
                    <Due d={r.dueDays} />
                  </Link>
                ))}
              </div>
            ))}
            {pool.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-ql-text2">
                {view === 'saved' ? 'Nothing saved for later.' : view === 'passed' ? 'Nothing passed yet.' : all.length === 0 ? (
                  <>
                    Desk clear.{' '}
                    <Link href={`/org/${slug}/goods/we-owe`} className="underline hover:text-ql-ink">obligations later</Link>
                    {' · '}
                    <Link href={`/org/${slug}/people`} className="underline hover:text-ql-ink">people cultivated</Link>
                  </>
                ) : 'Nothing matches this filter.'}
              </div>
            ) : null}
            {pool.length > shownCount ? (
              <div className="border-t border-ql-border px-4 py-2 text-[11px] text-ql-text2">
                Showing the first {shownCount} of {pool.length}. Pick a project or a lens to see the rest.
              </div>
            ) : null}
            {grantRows.length > 0 ? (
              <div className="border-t border-ql-border px-4 py-2 text-[11px] text-ql-text2">
                Jev has read {jevRead} of the {grantRows.length} grant rounds here. The rest are on the keyword score alone.
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-ql-border bg-ql-surface p-7">
            {selected ? (
              <>
                <div className="flex items-center gap-2.5">
                  <KindChip k={selected.kind} />
                  <span className="font-ql-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ql-text2">{selected.project} · {selected.signal}</span>
                </div>
                <h2 className="mt-2.5 font-ql-display text-3xl font-semibold leading-tight">{selected.name}</h2>
                {selected.grant?.funder ? <p className="mt-1 text-sm text-ql-text2">{selected.grant.funder}</p> : null}
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {selected.grant ? (
                    amountRange(selected.grant) && <span className="font-ql-mono text-sm font-semibold">{amountRange(selected.grant)}</span>
                  ) : (
                    selected.amount && <span className="font-ql-mono text-sm font-semibold">{selected.amount}</span>
                  )}
                  {selected.grant?.closeDate ? <span className="text-sm text-ql-text2">closes {dateWords(selected.grant.closeDate)}</span> : null}
                  {selected.kind === 'obligation' && selected.owedTo && (
                    <span className="font-ql-mono text-[11px] text-ql-muted">owed to {selected.owedTo}</span>
                  )}
                  {selected.kind === 'person' && selected.via && (
                    <span className="text-xs italic text-ql-text2">via {selected.via}</span>
                  )}
                  <Due d={selected.dueDays} />
                  {selected.kind === 'person' && selected.lastSyncedAt && (Date.now() - new Date(selected.lastSyncedAt).getTime()) > 86_400_000 && (
                    <span className="rounded border border-ql-alert px-1.5 py-0.5 font-ql-mono text-[11px] uppercase text-ql-alert">stale sync</span>
                  )}
                </div>

                {/* The verbs go on top (Ben's taste): decide first, evidence below. */}
                {orgProfileId ? (
                  <div className="mt-5 space-y-2">
                    {selected.decision && selected.decision.state !== 'open' ? (
                      <p className="text-xs text-ql-text2">
                        {selected.decision.state === 'pursuing' ? 'Pursuing' : selected.decision.state === 'saved' ? 'Saved for later' : `Passed: ${passReasonLabel(selected.decision.reason)}`}
                        {' on '}{dateWords(selected.decision.at)}
                      </p>
                    ) : null}
                    {view && DECIDABLE.has(selected.kind) && selected.ref ? (
                      <DeskDecisionButtons orgProfileId={orgProfileId} kind={selected.kind as 'grant' | 'funder' | 'buyer'} refId={selected.ref} projectCode={selected.projectCode ?? null} projectLabel={selected.project} mode="undo" />
                    ) : selected.kind === 'obligation' && selected.obligationId ? (
                      // Terminal states only (#147) — an Obligation discharges, it isn't "handled".
                      <DeskObligationButtons orgProfileId={orgProfileId} obligationId={selected.obligationId} owedTo={selected.owedTo ?? 'funder'} />
                    ) : (
                      <>
                        {selected.isDecision && DECIDABLE.has(selected.kind) && selected.ref ? null : (
                          <DeskMarkButtons orgProfileId={orgProfileId} actionId={selected.id} title={selected.name} detail={selected.next} />
                        )}
                        {DECIDABLE.has(selected.kind) && selected.ref ? (
                          <DeskDecisionButtons
                            orgProfileId={orgProfileId}
                            kind={selected.kind as 'grant' | 'funder' | 'buyer'}
                            refId={selected.ref}
                            projectCode={selected.projectCode ?? null}
                            projectLabel={selected.project}
                            mode={selected.isDecision ? 'decide' : 'worked'}
                            judgment={{
                              name: selected.name,
                              project: selected.project,
                              keyword: selected.grant?.keyword ?? selected.score,
                              jev: selected.grant?.jevScore ?? null,
                              jev_confidence: selected.grant?.jevConfidence ?? null,
                              tagged_by: selected.grant?.taggedBy ?? null,
                              days_to_close: selected.dueDays,
                            }}
                          />
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}

                <div className="mt-5 rounded-md bg-ql-warm px-4 py-3">
                  <div className="font-ql-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ql-accent">Next move</div>
                  <p className="mt-1 text-sm font-medium leading-6">{selected.next}</p>
                </div>

                {selected.grant ? (
                  <>
                    <WhyItsHere g={selected.grant} project={selected.project} />
                    <WhoCanApply g={selected.grant} />
                  </>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {selected.grant?.url && (
                    <a href={selected.grant.url} target="_blank" rel="noopener noreferrer" className="rounded-md border border-ql-border bg-ql-surface px-4 py-2 text-xs font-semibold text-ql-accent hover:bg-ql-surface2">
                      Open the grant ↗
                    </a>
                  )}
                  {selected.ghlUrl && (
                    <a href={selected.ghlUrl} target="_blank" rel="noopener noreferrer" className="rounded-md border border-ql-border bg-ql-surface px-4 py-2 text-xs font-semibold text-ql-accent hover:bg-ql-surface2">
                      Open in GHL ↗
                    </a>
                  )}
                  {selected.workHref && (
                    <Link href={selected.workHref} className="rounded-md border border-ql-border bg-ql-surface px-4 py-2 text-xs font-semibold text-ql-ink hover:bg-ql-surface2">
                      {selected.kind === 'obligation' ? 'Open in delivery workspace →' : selected.kind === 'person' ? 'Open person →' : 'Open full workspace →'}
                    </Link>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-ql-text2">Nothing selected.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

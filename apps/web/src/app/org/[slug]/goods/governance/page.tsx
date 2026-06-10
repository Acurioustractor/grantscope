import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getGoodsGovernance, getSupporterLadder, getFunderReadiness, getGoodsAdvisors } from '@/lib/services/goods-governance';
import { getGoodsWarmIntros } from '@/lib/services/goods-warm-intros';
import {
  summarizeBoard,
  type Advisor,
  type GovernanceMember,
  type GovernanceStatus,
} from '@/lib/services/goods-governance-shared';
import {
  summarizeConnections,
  toConnectionDoors,
  type ConnectionDoor,
} from '@/lib/services/goods-connection-shared';
import { BUTTERFLY_DGR } from '@/lib/services/goods-engagement-shared';
import { GOODS_DELIVERED } from '@/lib/services/goods-proof';
import { getGoodsEvidence } from '@/lib/services/goods-evidence';
import { surfaceFor, isOverdue, type QbeArea } from '@/lib/services/goods-evidence-shared';
import { GoodsSubNav } from '../_components/goods-sub-nav';

const DOOR_CAP = 8;
const STEWARDSHIP_HANDOVER = '26 June 2026';

/** "2025-03-14" -> "14 Mar 2025". Returns null for empty/malformed input. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const mi = Number(m[2]) - 1;
  if (mi < 0 || mi > 11) return null;
  return `${Number(m[3])} ${MONTHS[mi]} ${m[1]}`;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Goods — Governance' };
}

const STATUS_TONE: Record<GovernanceStatus, string> = {
  continuing: 'bg-bauhaus-blue text-white',
  incoming: 'bg-bauhaus-yellow text-bauhaus-black',
  transitioning: 'bg-bauhaus-yellow text-bauhaus-black',
  unknown: 'bg-bauhaus-canvas text-bauhaus-muted',
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function MemberCard({ m }: { m: GovernanceMember }) {
  return (
    <div className="flex items-stretch gap-0 border-b border-bauhaus-black/10 last:border-b-0">
      <div className="w-1.5 shrink-0 bg-bauhaus-black" aria-hidden />
      <div className="flex flex-1 flex-wrap items-start gap-x-4 gap-y-2 px-4 py-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-bauhaus-black bg-bauhaus-canvas text-sm font-black tracking-widest">
          {initials(m.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-black text-bauhaus-black">{m.name}</span>
            <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${STATUS_TONE[m.status]}`}>
              {m.statusLabel}
            </span>
          </div>
          {m.role && <div className="mt-0.5 text-[13px] font-bold text-bauhaus-black">{m.role}</div>}
          {m.organisation && (
            <div className="text-[11px] font-bold uppercase tracking-widest text-bauhaus-muted">{m.organisation}</div>
          )}
          {m.context && <div className="mt-1.5 max-w-2xl text-[13px] leading-snug text-bauhaus-black/80">{m.context}</div>}
          {(() => {
            const appointed = fmtDate(m.appointedAt);
            const termEnds = fmtDate(m.termEndsAt);
            const indig = m.identifiesIndigenous === true;
            if (!appointed && !termEnds && !indig) return null;
            return (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {indig && (
                  <span className="bg-bauhaus-black px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
                    Indigenous director
                  </span>
                )}
                {appointed && (
                  <span className="border-2 border-bauhaus-black px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-bauhaus-black">
                    Appointed {appointed}
                  </span>
                )}
                {termEnds && (
                  <span className="border-2 border-bauhaus-black px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-bauhaus-black">
                    Term ends {termEnds}
                  </span>
                )}
              </div>
            );
          })()}
          {m.linkedinUrl ? (
            <a
              href={m.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-block text-[11px] font-black uppercase tracking-widest text-bauhaus-blue hover:underline"
            >
              LinkedIn
            </a>
          ) : (
            <div className="mt-1.5 text-[10px] uppercase tracking-widest text-bauhaus-muted">Contact details to confirm</div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Adviser card — deliberately distinct from the board roster (red accent rail,
 * not black) so an adviser is never read as a director. QBE Area 07.
 */
function AdvisorCard({ a }: { a: Advisor }) {
  const lastContacted = fmtDate(a.lastContactedAt);
  return (
    <div className="flex items-stretch gap-0 border-b border-bauhaus-black/10 last:border-b-0">
      <div className="w-1.5 shrink-0 bg-bauhaus-red" aria-hidden />
      <div className="flex flex-1 flex-wrap items-start gap-x-4 gap-y-2 px-4 py-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-bauhaus-red bg-white text-sm font-black tracking-widest text-bauhaus-red">
          {initials(a.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-black text-bauhaus-black">{a.name}</span>
            <span className="bg-bauhaus-red px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
              Adviser
            </span>
          </div>
          {a.role && <div className="mt-0.5 text-[13px] font-bold text-bauhaus-black">{a.role}</div>}
          {a.organisation && (
            <div className="text-[11px] font-bold uppercase tracking-widest text-bauhaus-muted">{a.organisation}</div>
          )}
          {a.expertise.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {a.expertise.map((tag) => (
                <span
                  key={tag}
                  className="border-2 border-bauhaus-red px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-bauhaus-red"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {a.engagementAsk && (
            <div className="mt-2 max-w-2xl border-l-4 border-bauhaus-red bg-bauhaus-canvas px-3 py-1.5 text-[13px] leading-snug text-bauhaus-black/90">
              <span className="text-[9px] font-black uppercase tracking-widest text-bauhaus-red">Current ask</span>
              <div className="mt-0.5">{a.engagementAsk}</div>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                lastContacted ? 'border-2 border-bauhaus-black text-bauhaus-black' : 'bg-bauhaus-canvas text-bauhaus-muted'
              }`}
            >
              {lastContacted ? `Last contacted ${lastContacted}` : 'Last contact not recorded'}
            </span>
            {a.linkedinUrl && (
              <a
                href={a.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-black uppercase tracking-widest text-bauhaus-blue hover:underline"
              >
                LinkedIn
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const DOOR_TONE: Record<ConnectionDoor['degree'], string> = {
  first: 'bg-bauhaus-black text-white',
  second: 'bg-bauhaus-blue text-white',
  'board-level': 'bg-bauhaus-canvas text-bauhaus-black',
  none: 'bg-bauhaus-canvas text-bauhaus-muted',
};

function DoorRow({ slug, d }: { slug: string; d: ConnectionDoor }) {
  return (
    <div className="flex items-start gap-0 border-b border-bauhaus-black/10 last:border-b-0">
      <div className={`w-1.5 shrink-0 ${d.degree === 'second' ? 'bg-bauhaus-blue' : 'bg-bauhaus-black/30'}`} aria-hidden />
      <div className="flex flex-1 flex-wrap items-start gap-x-4 gap-y-1 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-black text-bauhaus-black">{d.targetName}</span>
            <span className="bg-bauhaus-black px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
              {d.relationshipType}
            </span>
            <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${DOOR_TONE[d.degree]}`}>
              {d.degreeLabel}
            </span>
          </div>
          {d.opener && (
            <div className="mt-1 text-[13px] leading-snug text-bauhaus-black/80">
              Best door: <span className="font-bold text-bauhaus-black">{d.opener.person}</span>
              <span className="text-bauhaus-muted">, {d.opener.rationale}</span>
            </div>
          )}
        </div>
        <Link
          href={`/org/${slug}/goods/intros`}
          className="shrink-0 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue hover:underline"
        >
          Open intro →
        </Link>
      </div>
    </div>
  );
}

/** Diagnostic-status chip tones: gap red, partial yellow, strength blue, unset muted. */
function statusChip(status: QbeArea['diagnosticStatus']): { label: string; cls: string } {
  switch (status) {
    case 'Priority gap':
      return { label: 'Priority gap', cls: 'bg-bauhaus-red text-white' };
    case 'Partial':
      return { label: 'Partial', cls: 'bg-bauhaus-yellow text-bauhaus-black' };
    case 'Strength':
      return { label: 'Strength', cls: 'bg-bauhaus-blue text-white' };
    default:
      return { label: 'Unset', cls: 'bg-bauhaus-canvas text-bauhaus-muted' };
  }
}

function EvidenceRow({ slug, a, now }: { slug: string; a: QbeArea; now: Date }) {
  const chip = statusChip(a.diagnosticStatus);
  const overdue = isOverdue(a.due, now);
  const due = fmtDate(a.due);
  const surface = surfaceFor(a.number);
  const accent =
    a.diagnosticStatus === 'Priority gap'
      ? 'bg-bauhaus-red'
      : a.diagnosticStatus === 'Partial'
      ? 'bg-bauhaus-yellow'
      : a.diagnosticStatus === 'Strength'
      ? 'bg-bauhaus-blue'
      : 'bg-bauhaus-black/30';
  return (
    <div className="flex items-stretch gap-0 border-4 border-bauhaus-black bg-white">
      <div className={`w-1.5 shrink-0 ${accent}`} aria-hidden />
      <div className="min-w-0 flex-1 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-black text-bauhaus-black">{a.area}</span>
          <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${chip.cls}`}>
            {chip.label}
          </span>
          {a.priority === 'P0' && (
            <span className="bg-bauhaus-black px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
              P0
            </span>
          )}
          {due && (
            <span
              className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                overdue ? 'bg-bauhaus-red text-white' : 'border-2 border-bauhaus-black text-bauhaus-black'
              }`}
            >
              {overdue ? 'Overdue ' : 'Due '}
              {due}
            </span>
          )}
        </div>
        {a.primaryGap && (
          <div className="mt-1.5 max-w-2xl text-[13px] leading-snug text-bauhaus-black/80">{a.primaryGap}</div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          {a.owner && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-bauhaus-muted">
              Owner: {a.owner}
            </span>
          )}
          {a.notionUrl && (
            <a
              href={a.notionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue hover:underline"
            >
              Notion ↗
            </a>
          )}
          {surface && (
            <Link
              href={`/org/${slug}/goods${surface.href}`}
              className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue hover:underline"
            >
              Live evidence: {surface.label} →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default async function GoodsGovernancePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const [govResult, ladderResult, readiness, { targets }, advisorsResult] = await Promise.all([
    getGoodsGovernance(),
    getSupporterLadder(),
    getFunderReadiness(),
    getGoodsWarmIntros(),
    getGoodsAdvisors(),
  ]);
  const { members, fetchError: govError } = govResult;
  const { ladder, fetchError: ladderError } = ladderResult;
  const { advisors, fetchError: advisorsError } = advisorsResult;
  const board = summarizeBoard(members);
  const doors = toConnectionDoors(targets, DOOR_CAP);
  const connStats = summarizeConnections(targets);
  // advisorsError is intentionally NOT folded into liveError: pre-migration, a missing
  // 'advisory' contact_type returns zero rows, never an error. We surface a real query
  // error inline in the Advisory Circle section instead, so a normal empty state never
  // lights the page-level "live data unavailable" banner.
  const liveError = govError ?? ladderError ?? readiness.fetchError;
  const now = new Date();
  const evidence = getGoodsEvidence(now);

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <Link href={`/org/${slug}`} className="hover:text-white">{profile.name}</Link>
            <span>/</span>
            <Link href={`/org/${slug}/goods/funnel`} className="hover:text-white">Goods</Link>
            <span>/</span>
            <span className="text-white">Governance</span>
          </nav>
          <h1 className="text-4xl font-black uppercase tracking-widest">Governance</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-300">
            The people who govern Goods on Country. This is the Indigenous-majority board of
            <strong className="text-white"> The Butterfly Movement Ltd</strong>, the charity and DGR home for the
            work. Stewardship handover is 26 June 2026.
          </p>
          <GoodsSubNav slug={slug} active="governance" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {liveError && (
          <div className="mb-4 border-2 border-bauhaus-red bg-bauhaus-red px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-white">
            Live data unavailable ({liveError})
          </div>
        )}

        {/* In-page anchor mini-nav */}
        <nav className="mb-6 flex flex-wrap gap-2">
          {[
            ['readiness', 'Readiness'],
            ['evidence', 'Evidence'],
            ['board', 'Board'],
            ['advisory', 'Advisory'],
            ['ladder', 'Ladder'],
            ['connections', 'Connections'],
          ].map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="border-2 border-bauhaus-black px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-black hover:text-white"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* FUNDER-READINESS HEADER — due diligence at a glance */}
        <section id="readiness" className="mb-8 scroll-mt-4 border-4 border-bauhaus-black bg-white">
          <div className="flex items-baseline justify-between border-b-4 border-bauhaus-black bg-bauhaus-black px-4 py-2.5 text-white">
            <h2 className="text-sm font-black uppercase tracking-widest">Funder readiness</h2>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Due diligence at a glance</span>
          </div>

          {/* DGR badge */}
          <div className="border-b-4 border-bauhaus-black bg-bauhaus-yellow px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-black/70">Charity and DGR home</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[15px] font-black text-bauhaus-black">{BUTTERFLY_DGR.name}</span>
              <span className="text-bauhaus-black/40">·</span>
              <span className="text-[11px] font-black uppercase tracking-widest text-bauhaus-black/70">ABN</span>
              <code className="select-all bg-white px-1.5 py-0.5 font-mono text-[13px] font-bold text-bauhaus-black">
                {BUTTERFLY_DGR.abn}
              </code>
              <span className="text-bauhaus-black/40">·</span>
              <span className="text-[12px] font-bold text-bauhaus-black/90">Item 1 DGR + PBI since 17 Jan 2012</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-3">
              <a
                href={BUTTERFLY_DGR.abrUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue hover:underline"
              >
                Verify on ABR →
              </a>
              <a
                href={BUTTERFLY_DGR.acncUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue hover:underline"
              >
                Verify on ACNC →
              </a>
            </div>
          </div>

          {/* Stat grid */}
          <div className="grid grid-cols-1 divide-y-4 divide-bauhaus-black sm:grid-cols-2 sm:divide-y-0 sm:divide-x-4 lg:grid-cols-4">
            {/* Board composition */}
            <div className="p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Board composition</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-black tabular-nums leading-none">{board.total}</span>
                <span className="text-[11px] font-black uppercase tracking-widest">members</span>
              </div>
              {board.indigenousPct == null ? (
                <div className="mt-1.5 text-[11px] leading-snug text-bauhaus-muted">
                  Not yet recorded. Set identifies_indigenous per member.
                </div>
              ) : (
                <div className="mt-1.5 text-[12px] font-bold leading-snug text-bauhaus-black">
                  {board.indigenous} Indigenous {board.indigenous === 1 ? 'director' : 'directors'} ({board.indigenousPct}% of {board.recorded} recorded)
                </div>
              )}
            </div>

            {/* Committed funders */}
            <div className="p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Committed funders</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-black tabular-nums leading-none">{readiness.committedFunders}</span>
                <span className="text-[11px] font-black uppercase tracking-widest">partners</span>
              </div>
              <div className="mt-1.5 text-[11px] leading-snug text-bauhaus-muted">
                Funders, impact investors and repayable finance at committed or repeat stage.
              </div>
            </div>

            {/* Lifetime received */}
            <div className="p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Lifetime received</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-black tabular-nums leading-none text-bauhaus-blue">{readiness.lifetimeReceivedShort}</span>
              </div>
              <div className="mt-1.5 text-[11px] leading-snug text-bauhaus-muted">
                Summed across every Goods relationship on record.
              </div>
            </div>

            {/* Proof freshness + handover */}
            <div className="p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Proof pack</div>
              <div className="mt-1 text-[12px] font-bold leading-snug text-bauhaus-black">
                Delivered figures as of {GOODS_DELIVERED.asOf}
              </div>
              <div className="mt-1 text-[11px] leading-snug text-bauhaus-muted">
                {GOODS_DELIVERED.beds} beds and {GOODS_DELIVERED.washers} washers delivered.
              </div>
              <div className="mt-2 border-t border-bauhaus-black/10 pt-1.5 text-[11px] font-bold leading-snug text-bauhaus-black">
                Stewardship handover {STEWARDSHIP_HANDOVER}
              </div>
            </div>
          </div>
        </section>

        {/* QBE EVIDENCE READINESS — the diagnostic database as a living board */}
        <section id="evidence" className="mb-8 scroll-mt-4 border-4 border-bauhaus-black bg-white">
          <div className="flex items-baseline justify-between border-b-4 border-bauhaus-black bg-bauhaus-black px-4 py-2.5 text-white">
            <h2 className="text-sm font-black uppercase tracking-widest">QBE evidence readiness</h2>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">
              12 diagnostic areas
            </span>
          </div>

          <p className="border-b-4 border-bauhaus-black px-4 py-2.5 text-[12px] leading-snug text-bauhaus-black/80">
            Synced from the QBE Diagnostic Artifact Database in Notion,{' '}
            {fmtDate(evidence.syncedAt) ?? evidence.syncedAt}.
          </p>

          {/* Summary strip */}
          <div className="grid grid-cols-2 divide-x-4 divide-y-4 divide-bauhaus-black border-b-4 border-bauhaus-black sm:grid-cols-4 sm:divide-y-0">
            <div className="p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">P0 areas</div>
              <div className="mt-1 text-3xl font-black tabular-nums leading-none">{evidence.summary.p0Count}</div>
            </div>
            <div className="p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Priority gaps</div>
              <div className="mt-1 text-3xl font-black tabular-nums leading-none">{evidence.summary.priorityGaps}</div>
            </div>
            <div className="p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Overdue</div>
              <div
                className={`mt-1 text-3xl font-black tabular-nums leading-none ${
                  evidence.summary.overdueCount > 0 ? 'text-bauhaus-red' : ''
                }`}
              >
                {evidence.summary.overdueCount}
              </div>
            </div>
            <div className="p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Next due</div>
              <div className="mt-1 text-[15px] font-black leading-tight text-bauhaus-black">
                {fmtDate(evidence.summary.nextDue) ?? 'None set'}
              </div>
            </div>
          </div>

          {/* 12 compact rows */}
          <div className="grid grid-cols-1 gap-3 p-4 xl:grid-cols-2">
            {evidence.areas.map((a) => (
              <EvidenceRow key={a.number} slug={slug} a={a} now={now} />
            ))}
          </div>

          <p className="border-t-4 border-bauhaus-black px-4 py-2.5 text-[11px] leading-snug text-bauhaus-muted">
            This board mirrors Notion; it does not edit it. Refresh with{' '}
            <code className="bg-bauhaus-canvas px-1">scripts/sync-qbe-diagnostic.mjs</code>.
          </p>
        </section>

        {/* The line that must never blur (stated once) */}
        <div className="mb-6 border-4 border-bauhaus-black bg-bauhaus-yellow p-4 text-sm">
          <div className="text-[11px] font-black uppercase tracking-widest">Co-owners, not a funnel</div>
          <p className="mt-1 max-w-3xl leading-snug text-bauhaus-black/90">
            The board are co-owners and governors, sovereign and consent governed. They are at the deepest belonging
            by right. They are never laddered, scored, or shown as leads. The supporter belonging ladder lower on this
            page is a separate dimension that applies to funders, members and buyers, and to none of the board.
          </p>
        </div>

        {/* Board directory */}
        <div id="board" className="mb-2 flex scroll-mt-4 items-baseline justify-between">
          <h2 className="text-lg font-black uppercase tracking-widest">The Butterfly Movement board</h2>
          <span className="text-[11px] font-bold uppercase tracking-widest text-bauhaus-muted">{members.length} members</span>
        </div>
        {members.length === 0 ? (
          <div className="border-4 border-bauhaus-black bg-white p-6 text-sm text-bauhaus-muted">
            No governance roster yet. Run{' '}
            <code className="bg-bauhaus-canvas px-1">node --env-file=.env scripts/sync-goods-governance-roster.mjs --apply</code>{' '}
            to sync the board from the wiki.
          </div>
        ) : (
          <div className="border-4 border-bauhaus-black bg-white">
            {members.map((m) => <MemberCard key={m.id} m={m} />)}
          </div>
        )}

        {/* Advisory Circle — advisers, NOT a board (QBE Diagnostic Area 07) */}
        <div id="advisory" className="mt-10 scroll-mt-4">
          <div className="flex items-baseline justify-between border-l-4 border-bauhaus-red pl-3">
            <h2 className="text-lg font-black uppercase tracking-widest text-bauhaus-black">Advisory Circle</h2>
            <span className="text-[11px] font-bold uppercase tracking-widest text-bauhaus-muted">
              {advisors.length} {advisors.length === 1 ? 'adviser' : 'advisers'}
            </span>
          </div>
          <div className="mt-2 border-4 border-bauhaus-red bg-white px-4 py-2.5">
            <p className="text-[12px] font-black uppercase tracking-widest text-bauhaus-red">
              Advisers, not a board.
            </p>
            <p className="mt-1 max-w-3xl text-[13px] leading-snug text-bauhaus-black/90">
              QBE Area 07: advisory relationships are never presented as a board. Advisers are engaged for a
              specific task, for a time. They do not govern, are not co-owners, and are never seated, scored, or laddered.
            </p>
          </div>

          {advisorsError ? (
            <div className="mt-3 border-4 border-bauhaus-red bg-white p-6 text-sm">
              <div className="text-[11px] font-black uppercase tracking-widest text-bauhaus-red">
                Advisory data unavailable
              </div>
              <p className="mt-1 leading-snug text-bauhaus-black/80">{advisorsError}</p>
            </div>
          ) : advisors.length === 0 ? (
            <div className="mt-3 border-4 border-bauhaus-red bg-white p-6 text-sm leading-relaxed text-bauhaus-black/80">
              <div className="text-[11px] font-black uppercase tracking-widest text-bauhaus-red">
                No advisers recorded yet
              </div>
              <p className="mt-2 max-w-3xl">
                The Advisory Circle is empty because two founder actions are pending. First, the migration that allows
                an <code className="bg-bauhaus-canvas px-1">advisory</code> contact type (and the{' '}
                <code className="bg-bauhaus-canvas px-1">expertise</code>,{' '}
                <code className="bg-bauhaus-canvas px-1">last_contacted_at</code> and{' '}
                <code className="bg-bauhaus-canvas px-1">engagement_ask</code> fields) is written but not yet applied:
              </p>
              <code className="mt-2 block bg-bauhaus-canvas px-2 py-1.5 text-[12px]">
                psql -f supabase/migrations/20260610030000_goods_advisory_circle.sql
              </code>
              <p className="mt-2 max-w-3xl">
                Second, once applied, add advisers to{' '}
                <code className="bg-bauhaus-canvas px-1">org_contacts</code> with{' '}
                <code className="bg-bauhaus-canvas px-1">contact_type=&apos;advisory&apos;</code> scoped to the Goods
                project. Until then this surface stays empty by design — it never invents an advisory board.
              </p>
            </div>
          ) : (
            <div className="mt-3 border-4 border-bauhaus-red bg-white">
              {advisors.map((a) => <AdvisorCard key={a.id} a={a} />)}
            </div>
          )}
        </div>

        {/* Supporter belonging ladder (NOT the board) */}
        <div id="ladder" className="mt-10 scroll-mt-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-black uppercase tracking-widest">The supporter belonging ladder</h2>
            <span className="text-[11px] font-bold uppercase tracking-widest text-bauhaus-muted">
              {ladder.total} on the ladder{ladder.offLadder > 0 && ` · ${ladder.offLadder} off`}
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-[13px] text-bauhaus-black/80">
            How supporters move toward belonging. This is the ACT Belonging Model, the same five rungs across the whole
            ecosystem, with the Goods meaning of each. It applies to funders, members and buyers. It does not apply to
            the board above, and it never applies to the communities the work is with.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-5">
            {ladder.rungs.map((rung, i) => (
              <div key={rung.tier} className="border-4 border-bauhaus-black bg-white p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{`0${i + 1}`}</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-bauhaus-muted">tier:{rung.tier}</span>
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-black tabular-nums leading-none">{rung.count}</span>
                  <span className="text-base font-black uppercase tracking-widest">{rung.label}</span>
                </div>
                <div className="mt-1 text-[12px] leading-snug text-bauhaus-black/80">{rung.meaning}</div>
                {rung.examples.length > 0 && (
                  <div className="mt-2 border-t border-bauhaus-black/10 pt-1.5 text-[10px] leading-snug text-bauhaus-muted">
                    {rung.examples.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-bauhaus-muted">
            Counts are live from <code className="bg-white px-1">goods_relationships</code>, mapped from pipeline stage
            to rung (an explicit <code className="bg-white px-1">tier:</code> tag in GoHighLevel wins when set). Off-ladder
            counts dormant and declined. Steward fills in as supporters are tagged <code className="bg-white px-1">tier:steward</code>.
          </p>
          {ladder.unrecognisedTier > 0 && (
            <p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-bauhaus-red">
              {ladder.unrecognisedTier} {ladder.unrecognisedTier === 1 ? 'supporter has' : 'supporters have'} unrecognised tier tags. They fell back to their pipeline stage. Fix the <code className="bg-white px-1 normal-case">tier:</code> tag in GoHighLevel.
            </p>
          )}
        </div>

        {/* How Goods is connected — the showcase (slice 4) */}
        <div id="connections" className="mt-10 scroll-mt-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-black uppercase tracking-widest">How Goods is connected</h2>
            <Link
              href={`/org/${slug}/goods/intros`}
              className="text-[11px] font-black uppercase tracking-widest text-bauhaus-blue hover:underline"
            >
              All warm intros →
            </Link>
          </div>
          <p className="mt-1 max-w-3xl text-[13px] text-bauhaus-black/80">
            Who can help Goods, and how. The board govern directly. For supporters, this reads the door from the
            board-interlock graph we already hold. A <strong>shared board</strong> means a director who also sits on a
            board with another Goods relationship, a genuine warm path. A <strong>board-level door</strong> is a real
            person on the org&apos;s board, an honest opener, not a personal tie.
          </p>
          <p className="mt-2 text-[12px] font-bold uppercase tracking-widest text-bauhaus-muted">
            {connStats.bridges} shared-board {connStats.bridges === 1 ? 'bridge' : 'bridges'} ·{' '}
            {connStats.boardLevelDoors} board-level {connStats.boardLevelDoors === 1 ? 'door' : 'doors'} ·{' '}
            {connStats.totalDoors} supporters with a door
          </p>
          {doors.length === 0 ? (
            <div className="mt-3 border-4 border-bauhaus-black bg-white p-6 text-sm text-bauhaus-muted">
              No connection doors computed yet. The warm-intro graph needs entity-linked Goods relationships.
            </div>
          ) : (
            <>
              <div className="mt-3 border-4 border-bauhaus-black bg-white">
                {doors.map((d) => <DoorRow key={d.relId} slug={slug} d={d} />)}
              </div>
              {connStats.totalDoors > doors.length && (
                <p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-bauhaus-muted">
                  Showing {doors.length} of {connStats.totalDoors} doors. Open all warm intros for the rest.
                </p>
              )}
            </>
          )}
        </div>

        <div className="mt-10 border-4 border-bauhaus-black bg-white p-4 text-xs text-bauhaus-muted">
          Roster synced from{' '}
          <code className="bg-bauhaus-canvas px-1">wiki/decisions/goods-governance-roster.md</code> by the{' '}
          <code className="bg-bauhaus-canvas px-1">sync-goods-governance-roster</code> script. Edit the wiki, then
          re-run the sync. Some details (surnames, cultural context, contact links) are marked to confirm with Ben
          before this becomes public facing. The sync never fabricates.
        </div>
      </div>
    </main>
  );
}

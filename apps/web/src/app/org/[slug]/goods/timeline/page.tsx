import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getGoodsTimelines } from '@/lib/services/goods-timeline';
import {
  sourceLabel,
  type SupporterTimeline,
  type TimelineEvent,
  type TimelineSource,
} from '@/lib/services/goods-timeline-shared';
import { fmtDate } from '@/lib/services/goods-life-events-shared';
import { GoodsSubNav } from '../_components/goods-sub-nav';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Goods — Timeline' };
}

const SOURCE_TONE: Record<TimelineSource, string> = {
  ghl: 'bg-bauhaus-blue text-white',
  xero: 'bg-bauhaus-yellow text-bauhaus-black',
  record: 'bg-bauhaus-black text-white',
};

const SOURCE_RAIL: Record<TimelineSource, string> = {
  ghl: 'bg-bauhaus-blue',
  xero: 'bg-bauhaus-yellow',
  record: 'bg-bauhaus-black',
};

const MS_PER_DAY = 86_400_000;

/**
 * Human "how long ago" from an ISO date to now. Coarse on purpose (the timeline is
 * about staleness at a glance, not precision). Returns null for unparseable input.
 */
function relativeTime(iso: string | null | undefined, now: Date = new Date()): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const days = Math.round((now.getTime() - t) / MS_PER_DAY);
  if (days < 0) return 'upcoming';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30.437);
  if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  const years = Math.floor(days / 365.25);
  const remMonths = Math.round((days - years * 365.25) / 30.437);
  return remMonths > 0 ? `${years}y ${remMonths}mo ago` : `${years} ${years === 1 ? 'year' : 'years'} ago`;
}

/** The newest (first) dated event on a card, used for the staleness chip. */
function newestEventDate(events: TimelineEvent[]): string | null {
  let newest: string | null = null;
  for (const e of events) {
    if (e.date && (newest === null || e.date > newest)) newest = e.date;
  }
  return newest;
}

function EventRow({ e }: { e: TimelineEvent }) {
  const when = fmtDate(e.date);
  return (
    <li className="flex items-stretch gap-0">
      <div className={`w-1.5 shrink-0 ${SOURCE_RAIL[e.source]}`} aria-hidden />
      <div className="flex flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2">
        <span className="w-24 shrink-0 font-mono text-[10px] uppercase tracking-widest text-bauhaus-muted">
          {when ?? e.date}
          {e.fyGrained && <span className="ml-1 text-bauhaus-muted/70">~FY</span>}
        </span>
        <span className={`px-1 py-0.5 text-[8px] font-black uppercase tracking-widest ${SOURCE_TONE[e.source]}`}>
          {sourceLabel(e.source)}
        </span>
        <span className="text-[13px] font-bold text-bauhaus-black">{e.label}</span>
        <span className="text-[12px] text-bauhaus-black/70">{e.detail}</span>
      </div>
    </li>
  );
}

function TimelineCard({ t }: { t: SupporterTimeline }) {
  const lastEvent = relativeTime(newestEventDate(t.events));
  return (
    <div className="border-4 border-bauhaus-black bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b-4 border-bauhaus-black px-4 py-3">
        <span className="text-base font-black text-bauhaus-black">{t.name}</span>
        <span className="bg-bauhaus-black px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
          {t.relationshipType}
        </span>
        {t.stageLabel && (
          <span className="border-2 border-bauhaus-black px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-bauhaus-black">
            {t.stageLabel}
          </span>
        )}
        {lastEvent && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-bauhaus-muted">
            Last event {lastEvent}
          </span>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-1">
          {t.sources.map((s) => (
            <span key={s} className={`px-1 py-0.5 text-[8px] font-black uppercase tracking-widest ${SOURCE_TONE[s]}`}>
              {sourceLabel(s)}
            </span>
          ))}
          {t.sources.length >= 2 && (
            <span className="ml-1 text-[9px] font-black uppercase tracking-widest text-bauhaus-red">fused</span>
          )}
        </span>
      </div>
      <ul className="divide-y divide-bauhaus-black/10">
        {t.events.map((e, i) => <EventRow key={`${e.source}-${e.date}-${i}`} e={e} />)}
      </ul>
    </div>
  );
}

export default async function GoodsTimelinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const { timelines, summary } = await getGoodsTimelines();

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-[1760px] px-4 py-8">
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <Link href={`/org/${slug}`} className="hover:text-white">{profile.name}</Link>
            <span>/</span>
            <Link href={`/org/${slug}/goods`} className="hover:text-white">Goods</Link>
            <span>/</span>
            <span className="text-white">Timeline</span>
          </nav>
          <h1 className="text-4xl font-black uppercase tracking-widest">Relationship timelines</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-300">
            One fused history per supporter, from the systems we own. Each line is a dated event from GoHighLevel, Xero,
            or the public record, newest first. The most fused relationships, where several systems agree, lead.
          </p>
          <GoodsSubNav slug={slug} active="timeline" />
        </div>
      </div>

      <div className="mx-auto max-w-[1760px] px-4 py-6">
        <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="text-[12px] font-black uppercase tracking-widest text-bauhaus-black">
            {summary.shown} of {summary.total} {summary.total === 1 ? 'supporter' : 'supporters'}
          </span>
          <span className="text-[12px] font-bold uppercase tracking-widest text-bauhaus-red">
            {summary.withFusion} fused across systems
          </span>
        </div>

        <div className="mb-6 border-4 border-bauhaus-black bg-bauhaus-yellow p-3 text-[12px] leading-snug">
          <span className="font-black uppercase tracking-widest">The dated record we hold.</span> GoHighLevel contributes
          the last real contact, Xero the invoices issued, the public record the filings, contracts and funding. This is
          not a complete activity log. Earlier GoHighLevel history and email are not here. Email is deferred on purpose.
        </div>

        {timelines.length === 0 ? (
          <div className="border-4 border-bauhaus-black bg-white p-6 text-sm text-bauhaus-muted">
            No dated relationship history yet. A timeline needs a real GoHighLevel touch, a Xero invoice, or a
            public-record event.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {timelines.map((t) => <TimelineCard key={t.relId} t={t} />)}
          </div>
        )}

        {summary.shown < summary.total && (
          <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-bauhaus-muted">
            Showing the {summary.shown} most fused of {summary.total}. The rest have a single source so far.
          </p>
        )}

        <div className="mt-8 border-4 border-bauhaus-black bg-white p-4 text-xs text-bauhaus-muted">
          Fused live from <code className="bg-bauhaus-canvas px-1">goods_relationships</code> (last touch + stage),{' '}
          <code className="bg-bauhaus-canvas px-1">v_goods_life_events</code> (ACNC, contracts, justice), and{' '}
          <code className="bg-bauhaus-canvas px-1">xero_invoices</code> (ACT-GD income, matched by name). One card per
          supporter, the most fused first. Xero shows invoices issued; paid dates appear only once the sync carries them.
        </div>
      </div>
    </main>
  );
}

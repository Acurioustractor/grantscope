import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getGoodsFunderInsight } from '@/lib/services/goods-funder-insight';
import { TEMP_LABEL, temperatureTone, type FunderInsight, type InsightFlag } from '@/lib/services/goods-funder-insight-shared';
import { relDays, money, moneyShort } from '@/lib/services/goods-engagement-shared';
import { GoodsSubNav } from '../_components/goods-sub-nav';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Goods — Funder Insight' };
}

function Stat({ label, value, stake }: { label: string; value: string; stake?: string }) {
  return (
    <div className="border-4 border-bauhaus-black bg-white p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{label}</div>
      <div className="mt-1 text-2xl font-black text-bauhaus-black">{value}</div>
      {stake && <div className="mt-0.5 text-[11px] font-bold text-bauhaus-blue">{stake} at stake</div>}
    </div>
  );
}

/** Due-date label + overdue styling. Past dates render red. */
function dueDate(iso: string | null): { label: string; overdue: boolean } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  const date = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  if (days < 0) return { label: `due ${date} · ${Math.abs(days)}d overdue`, overdue: true };
  if (days === 0) return { label: `due today (${date})`, overdue: true };
  return { label: `due ${date} · in ${days}d`, overdue: false };
}

function flagTone(tone: InsightFlag['tone']): string {
  switch (tone) {
    case 'urgent': return 'bg-bauhaus-red text-white';
    case 'opportunity': return 'bg-bauhaus-blue text-white';
    case 'positive': return 'bg-bauhaus-yellow text-bauhaus-black';
    default: return 'bg-bauhaus-canvas text-bauhaus-muted';
  }
}

const ATTENTION_BAR: Record<FunderInsight['attention'], string> = {
  'act-now': 'bg-bauhaus-red',
  watch: 'bg-bauhaus-yellow',
  steady: 'bg-bauhaus-blue',
  none: 'bg-bauhaus-black/15',
};

function Chip({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${muted ? 'bg-bauhaus-canvas text-bauhaus-muted' : 'bg-bauhaus-black text-white'}`}>
      {children}
    </span>
  );
}

function InsightCard({ i }: { i: FunderInsight }) {
  return (
    <div className="flex items-stretch gap-0 border-b border-bauhaus-black/10 last:border-b-0">
      <div className={`w-1.5 shrink-0 ${ATTENTION_BAR[i.attention]}`} aria-hidden />
      <div className="flex flex-1 flex-wrap items-start gap-x-4 gap-y-1 px-3 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-black">{i.name}</span>
            <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${temperatureTone(i.temperature)}`}>
              {TEMP_LABEL[i.temperature]}
            </span>
            {i.flags.map((f) => (
              <span key={f.key} className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${flagTone(f.tone)}`}>
                {f.label}
              </span>
            ))}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] font-bold text-bauhaus-black">
            <span>{i.nextMove}</span>
            {(() => {
              const due = dueDate(i.nextActionDue);
              if (!due) return null;
              return (
                <span
                  className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                    due.overdue ? 'bg-bauhaus-red text-white' : 'bg-bauhaus-canvas text-bauhaus-black border-2 border-bauhaus-black/30'
                  }`}
                >
                  {due.label}
                </span>
              );
            })()}
          </div>

          {/* what they care about */}
          {i.interests.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Cares about</span>
              {i.interests.map((t) => <Chip key={t}>{t}</Chip>)}
            </div>
          )}

          {/* posture: roles + comms + place */}
          {(i.roles.length > 0 || i.commsStreams.length > 0 || i.places.length > 0 || i.campaignStage) && (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {i.campaignStage && <Chip muted>{i.campaignStage}</Chip>}
              {i.roles.slice(0, 3).map((r) => <Chip key={`r-${r}`} muted>{r}</Chip>)}
              {i.commsStreams.slice(0, 2).map((c) => <Chip key={`c-${c}`} muted>{c}</Chip>)}
              {i.places.map((p) => <Chip key={`p-${p}`} muted>{p}</Chip>)}
            </div>
          )}

          {i.opportunityStage && (
            <div className="mt-1 text-[11px] text-bauhaus-muted">
              Pipeline: <span className="font-bold text-bauhaus-black">{i.opportunityStage}</span>
              {i.opportunityStatus && i.opportunityStatus !== 'open' && <> · {i.opportunityStatus}</>}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end">
          <span className="text-lg font-black">{i.warmth}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-bauhaus-muted">warmth</span>
          {i.askAmount != null && i.askAmount > 0 && (
            <span className="mt-0.5 text-[11px] font-black text-bauhaus-blue">{moneyShort(i.askAmount)} ask</span>
          )}
          {i.totalReceived > 0 && (
            <span className="mt-0.5 text-[10px] font-bold text-bauhaus-muted" title="Manually entered, not Xero">
              {money(i.totalReceived)} rec.
            </span>
          )}
          <span className="mt-0.5 text-[10px] text-bauhaus-muted">touched {relDays(i.lastTouchAt)}</span>
          {i.tagCount === 0 && <span className="mt-0.5 text-[9px] uppercase tracking-widest text-bauhaus-muted">no GHL signal</span>}
        </div>
      </div>
    </div>
  );
}

export default async function GoodsInsightPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { slug } = await params;
  const { filter } = await searchParams;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const { insights, summary, fetchError } = await getGoodsFunderInsight();
  const actNowOnly = filter === 'act-now';
  const shown = actNowOnly ? insights.filter((i) => i.attention === 'act-now') : insights;

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <Link href={`/org/${slug}`} className="hover:text-white">{profile.name}</Link>
            <span>/</span>
            <Link href={`/org/${slug}/goods/funnel`} className="hover:text-white">Goods</Link>
            <span>/</span>
            <span className="text-white">Funder Insight</span>
          </nav>
          <h1 className="text-4xl font-black uppercase tracking-widest">Funder Insight</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-300">
            What each funder is signalling — and the move it calls for. Decoded from the
            <strong className="text-white"> structured signal</strong> we already hold in GoHighLevel:
            temperature (<span className="text-bauhaus-red font-bold">hot</span> /{' '}
            <span className="font-bold">cooling</span>), the engagement ring, the briefs they subscribe to
            (= what they care about), and pipeline stage. No inbox-reading — just the signal, read out loud.
          </p>
          <GoodsSubNav slug={slug} active="insight" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {fetchError && (
          <div className="mb-4 border-4 border-bauhaus-red bg-bauhaus-red px-4 py-2 text-[12px] font-black uppercase tracking-widest text-white">
            Live data unavailable ({fetchError}). Figures below may be incomplete.
          </div>
        )}

        {/* Act-now hero — the one thing that demands attention right now. */}
        <div className="mb-3 border-4 border-bauhaus-red bg-bauhaus-red p-5 text-white">
          <div className="text-[10px] font-black uppercase tracking-widest text-white/80">Act now</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-5xl font-black leading-none">{summary.actNow}</span>
            <span className="text-sm font-black uppercase tracking-widest text-white/80">funders need a move</span>
            {summary.atStake.actNow > 0 && (
              <span className="text-2xl font-black leading-none">{moneyShort(summary.atStake.actNow)} at stake</span>
            )}
          </div>
        </div>

        {/* secondary — clearly subordinate to the act-now hero */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Hot" value={String(summary.hot)} stake={summary.atStake.hot > 0 ? moneyShort(summary.atStake.hot) : undefined} />
          <Stat label="Cooling" value={String(summary.cooling)} stake={summary.atStake.cooling > 0 ? moneyShort(summary.atStake.cooling) : undefined} />
          <Stat label="VIP" value={String(summary.vip)} stake={summary.atStake.vip > 0 ? moneyShort(summary.atStake.vip) : undefined} />
          <Stat label="With GHL signal" value={`${summary.withSignal}/${summary.total}`} />
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href={`/org/${slug}/goods/insight`}
            className={`border-2 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest ${!actNowOnly ? 'border-bauhaus-black bg-bauhaus-black text-white' : 'border-bauhaus-black/30 bg-white text-bauhaus-black hover:border-bauhaus-black'}`}
          >
            All funders
          </Link>
          <Link
            href={`/org/${slug}/goods/insight?filter=act-now`}
            className={`border-2 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest ${actNowOnly ? 'border-bauhaus-red bg-bauhaus-red text-white' : 'border-bauhaus-black/30 bg-white text-bauhaus-black hover:border-bauhaus-black'}`}
          >
            Act now {summary.actNow > 0 && <span className={actNowOnly ? 'text-bauhaus-yellow' : 'text-bauhaus-red'}>{summary.actNow}</span>}
          </Link>
        </div>

        {shown.length === 0 ? (
          <div className="border-4 border-bauhaus-black bg-white p-6 text-sm text-bauhaus-muted">
            {summary.total === 0
              ? 'No funder relationships yet. Run the GHL sync to populate the warmth map.'
              : actNowOnly ? 'Nothing needs immediate action — every funder is steady.' : 'No funders to show.'}
          </div>
        ) : (
          <div className="border-4 border-bauhaus-black bg-white">
            {shown.map((i) => <InsightCard key={i.id} i={i} />)}
          </div>
        )}

        <div className="mt-8 border-4 border-bauhaus-black bg-bauhaus-yellow p-4 text-xs">
          The &ldquo;why&rdquo; is decoded from GHL structured signal only — temperature tags, engagement ring,
          subscribed briefs, comms drips and pipeline stage (<code>goods_relationships.ghl_signal</code>, refreshed by the
          12h <code>sync-goods-ghl</code> agent). GHL holds no message threads for funders; the actual correspondence lives
          in Gmail. Next move is rule-based, not generated — deterministic and inspectable.
        </div>
      </div>
    </main>
  );
}

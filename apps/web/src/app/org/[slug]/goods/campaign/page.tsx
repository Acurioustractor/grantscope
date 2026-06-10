import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { money, moneyShort, BUTTERFLY_DGR } from '@/lib/services/goods-engagement-shared';
import {
  COMMITMENT_ORDER,
  COMMITMENT_LABEL,
  KIND_LABEL,
  byCommitment,
  daysUntil,
  evidenceBackedTotal,
  pipelineTotal,
  type CapitalSource,
} from '@/lib/services/goods-campaign-data';
import { getGoodsCampaign, type EnrichedCapitalSource } from '@/lib/services/goods-campaign';
import { GoodsSubNav } from '../_components/goods-sub-nav';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Goods — Match Campaign: Committed Capital Register' };
}

const KIND_CHIP: Record<string, string> = {
  matched_grant: 'bg-bauhaus-yellow text-bauhaus-black',
  grant: 'bg-bauhaus-blue text-white',
  recoverable_grant: 'bg-link-light text-bauhaus-black border-2 border-bauhaus-blue',
  loan: 'bg-white text-bauhaus-black border-2 border-bauhaus-black',
  catalytic: 'bg-bauhaus-black text-white',
};

function dateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function SourceCard({ source, slug }: { source: EnrichedCapitalSource; slug: string }) {
  const noEvidence = source.writtenEvidence === null;
  return (
    <div className="border-4 border-bauhaus-black bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-black uppercase tracking-wide text-bauhaus-black">{source.name}</div>
        <span className={`shrink-0 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${KIND_CHIP[source.kind]}`}>
          {KIND_LABEL[source.kind]}
        </span>
      </div>

      <div className="mt-2 text-2xl font-black text-bauhaus-black">{source.askLabel}</div>

      <div className="mt-2 text-[11px] font-bold text-bauhaus-muted">{source.status}</div>

      <div className="mt-2 border-t-2 border-bauhaus-black/10 pt-2">
        <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">Next move</div>
        <div className="text-[11px] font-bold text-bauhaus-black">{source.nextMove}</div>
      </div>

      <div className="mt-2">
        {noEvidence ? (
          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
            No written evidence on file
          </div>
        ) : (
          <div className="text-[10px] font-bold text-bauhaus-black">
            <span className="font-black uppercase tracking-widest text-bauhaus-muted">Evidence: </span>
            {source.writtenEvidence}
          </div>
        )}
      </div>

      {source.live && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t-2 border-bauhaus-black/10 pt-2">
          <span className="bg-bauhaus-black px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
            Live warmth {source.live.warmth}
          </span>
          <span className="border-2 border-bauhaus-black px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-bauhaus-black">
            {source.live.stage}
          </span>
          {source.live.askAmountAud !== null && (
            <span className="text-[9px] font-bold text-bauhaus-muted">
              registry ask {moneyShort(source.live.askAmountAud)}
            </span>
          )}
        </div>
      )}

      <Link
        href={`/org/${slug}/goods/engagement`}
        className="mt-2 inline-block text-[10px] font-black uppercase tracking-widest text-bauhaus-blue hover:underline"
      >
        Open in engagement →
      </Link>
    </div>
  );
}

const COLUMN_TINT: Record<string, string> = {
  target: 'border-bauhaus-black/30',
  in_conversation: 'border-bauhaus-blue',
  eligible: 'border-bauhaus-yellow',
  signed: 'border-bauhaus-black',
};

export default async function GoodsCampaignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const { sources, deadline, fetchError } = await getGoodsCampaign();
  const grouped = byCommitment(sources as CapitalSource[]) as Record<string, EnrichedCapitalSource[]>;
  const backed = evidenceBackedTotal(sources);
  const pipeline = pipelineTotal(sources);
  const days = daysUntil(deadline);
  const urgent = days < 60;

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <Link href={`/org/${slug}`} className="hover:text-white">{profile.name}</Link>
            <span>/</span>
            <Link href={`/org/${slug}/goods/funnel`} className="hover:text-white">Goods</Link>
            <span>/</span>
            <span className="text-white">Match Campaign</span>
          </nav>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black uppercase tracking-widest">Match Campaign</h1>
              <p className="mt-2 max-w-2xl text-sm text-gray-300">
                The signed and eligible commitment register for the QBE Catalysing Impact match raise.
                Pipeline is not committed capital. Only evidence-backed capital may be quoted to QBE.
              </p>
            </div>
            <div className="border-4 border-white bg-white px-4 py-3 text-bauhaus-black">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Days to match deadline</div>
              <div className={`text-5xl font-black ${urgent ? 'text-bauhaus-red' : 'text-bauhaus-black'}`}>
                {days > 0 ? days : 'Closed'}
              </div>
              <div className="text-[10px] font-bold text-bauhaus-muted">Match deadline {dateLabel(deadline)}</div>
            </div>
          </div>
          <p className="mt-3 text-[11px] font-black uppercase tracking-widest text-gray-400">
            External capital window closes Oct/Nov 2026.
          </p>

          <GoodsSubNav slug={slug} active="campaign" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Primary call-out: the one number rule. */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="border-4 border-bauhaus-black bg-white p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Evidence-backed capital</div>
            <div className="mt-1 text-4xl font-black text-bauhaus-black">{money(backed)}</div>
            <div className="mt-2 text-[11px] font-bold text-bauhaus-black">
              Signed or eligible, with written evidence on file. This is the only number that may ever be quoted to QBE.
            </div>
          </div>
          <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Pipeline (not committed)</div>
            <div className="mt-1 text-4xl font-black text-bauhaus-muted">{money(pipeline)}</div>
            <div className="mt-2 text-[11px] font-bold text-bauhaus-muted">
              Targets and live conversations without attached evidence. Never present this as committed capital.
            </div>
          </div>
        </div>

        {/* Match-rules warning. No estimate computed. */}
        <div className="mt-4 border-4 border-bauhaus-black bg-bauhaus-yellow p-4">
          <div className="text-sm font-black uppercase tracking-widest text-bauhaus-black">
            QBE match rules are not confirmed in writing.
          </div>
          <div className="mt-1 text-[12px] font-bold text-bauhaus-black">
            No match amount is claimed until they are. The match is contingent on external capital being secured.
            The reported cap of up to $400K is unconfirmed and is not treated as committed.
          </div>
        </div>

        {/* The ladder board. */}
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COMMITMENT_ORDER.map((commitment) => {
            const items = grouped[commitment] ?? [];
            return (
              <div key={commitment} className={`border-4 ${COLUMN_TINT[commitment]} bg-bauhaus-canvas p-3`}>
                <div className="flex items-center justify-between border-b-2 border-bauhaus-black/20 pb-2">
                  <span className="text-xs font-black uppercase tracking-widest text-bauhaus-black">
                    {COMMITMENT_LABEL[commitment]}
                  </span>
                  <span className="text-xs font-black text-bauhaus-muted">{items.length}</span>
                </div>
                <div className="mt-3 flex flex-col gap-3">
                  {items.length === 0 ? (
                    <div className="text-[10px] font-bold uppercase tracking-widest text-bauhaus-muted">
                      Nothing here yet
                    </div>
                  ) : (
                    items.map((s) => <SourceCard key={s.id} source={s} slug={slug} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* The advancement rule. */}
        <div className="mt-6 border-4 border-bauhaus-red bg-white p-3">
          <span className="text-[11px] font-black uppercase tracking-widest text-bauhaus-red">
            A source advances past Eligible only with written evidence attached.
          </span>
        </div>

        {/* Provenance + live-data honesty strip. */}
        <div className="mt-6 border-t-4 border-bauhaus-black pt-3 text-[10px] font-bold text-bauhaus-muted">
          <p>
            Capital stack is a curated, human-verified register (each row carries a verify flag). Live warmth and stage,
            when shown, are joined from the Goods relationship registry. Grants route through {BUTTERFLY_DGR.name}.
          </p>
          {fetchError && (
            <p className="mt-2 border-l-4 border-bauhaus-red pl-2 text-bauhaus-red">
              Live registry unavailable, sources shown unenriched. {fetchError}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

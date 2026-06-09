import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getGoodsGovernance, getSupporterLadder } from '@/lib/services/goods-governance';
import { type GovernanceMember, type GovernanceStatus } from '@/lib/services/goods-governance-shared';
import { GoodsSubNav } from '../_components/goods-sub-nav';

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

export default async function GoodsGovernancePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const [{ members }, ladder] = await Promise.all([getGoodsGovernance(), getSupporterLadder()]);

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
        {/* The line that must never blur */}
        <div className="mb-6 border-4 border-bauhaus-black bg-bauhaus-yellow p-4 text-sm">
          <div className="text-[11px] font-black uppercase tracking-widest">Co-owners, not a funnel</div>
          <p className="mt-1 max-w-3xl leading-snug text-bauhaus-black/90">
            The board are co-owners and governors, sovereign and consent governed. They are at the deepest belonging
            by right. They are never laddered, scored, or shown as leads. The supporter belonging ladder lower on this
            page is a separate dimension that applies to funders, members and buyers, and to none of the board.
          </p>
        </div>

        {/* Board directory */}
        <div className="mb-2 flex items-baseline justify-between">
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

        {/* Supporter belonging ladder (NOT the board) */}
        <div className="mt-10">
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

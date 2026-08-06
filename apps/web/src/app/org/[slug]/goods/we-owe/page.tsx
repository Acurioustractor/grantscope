// The We-owe tab — the full open Obligation pool for Goods (delivery spec:
// docs/specs/delivery-surfaces-ux-spec.md). Split pane, ?rec= selection.
// Skin: Bauhaus, matching the workspace family (spec's Quiet Ledger note
// yields to sibling-tab consistency). Desk mismatch rows are NOT wired yet —
// they switch on after the backfill triage sitting (backfill-prompt-list.md).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getObligationPool, type Obligation } from '@/lib/services/act-obligations';
import { GoodsWorkspaceHeader } from '../_components/goods-capital-ui';
import { MintObligationForm, ObligationStateButtons } from './we-owe-actions';

export const dynamic = 'force-dynamic';

const GOODS_PROJECT_CODE = 'ACT-GD';

export async function generateMetadata() {
  return { title: 'Goods — We owe', description: 'Work Goods owes because of a commitment — funder reports, acquittals, community promises.' };
}

function Due({ d }: { d: number | null }) {
  if (d == null) return <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">no date</span>;
  if (d < 0) return <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">{-d}d overdue</span>;
  return <span className="text-[10px] font-black uppercase tracking-widest">{d}d</span>;
}

function OwedToTag({ t }: { t: Obligation['owedTo'] }) {
  return <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">→ {t}</span>;
}

function band(o: Obligation): string {
  if (o.dueDays == null) return 'No date — date it or drop it';
  if (o.dueDays < 0) return 'Overdue';
  if (o.dueDays <= 14) return 'This fortnight';
  return 'Later';
}

export default async function GoodsWeOwePage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  if (!isActSlug(slug)) notFound();
  const profile = shouldUseFastLocalOrg() ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();
  const sp = await searchParams;

  const pool = await getObligationPool(profile.id, GOODS_PROJECT_CODE);
  const selected = (typeof sp.rec === 'string' ? [...pool.open, ...pool.closed].find((o) => o.id === sp.rec) : null) ?? pool.open[0] ?? null;
  const base = `/org/${slug}/goods/we-owe`;

  const groups: Array<{ band: string; items: Obligation[] }> = [];
  for (const o of pool.open) {
    const b = band(o);
    const last = groups[groups.length - 1];
    if (last && last.band === b) last.items.push(o);
    else groups.push({ band: b, items: [o] });
  }

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <GoodsWorkspaceHeader
        slug={slug}
        orgName={profile.name}
        active="we-owe"
        eyebrow={`${pool.counts.open} open · ${pool.counts.overdue} overdue · ${pool.counts.undated} undated · ${pool.counts.doneQuarter} done this quarter`}
        title="We owe"
        description="Work Goods owes because of a commitment — funder reports and acquittals, community delivery and promises. Minting acknowledges the promise; Done and Dropped are terminal and recorded."
      />
      <div className="mx-auto max-w-[1760px] px-4 py-6">
        <div className="mb-4">
          <MintObligationForm orgProfileId={profile.id} projectCode={GOODS_PROJECT_CODE} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="max-h-[70vh] overflow-y-auto border-4 border-bauhaus-black bg-white">
            {groups.map((group) => (
              <div key={group.band}>
                <div className={`sticky top-0 z-10 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white ${group.band === 'Overdue' ? 'bg-bauhaus-red' : 'bg-bauhaus-black'}`}>
                  {group.band} · {group.items.length}
                </div>
                {group.items.map((o) => (
                  <Link
                    key={o.id}
                    href={`${base}?rec=${o.id}`}
                    className={`flex items-center gap-2.5 border-t-2 border-bauhaus-black/20 px-4 py-2.5 text-sm ${selected?.id === o.id ? 'bg-bauhaus-yellow/30' : 'hover:bg-bauhaus-canvas'}`}
                  >
                    <span className="bg-bauhaus-black px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">we owe</span>
                    <span className="min-w-0 flex-1 truncate font-bold">{o.title}</span>
                    <OwedToTag t={o.owedTo} />
                    <Due d={o.dueDays} />
                  </Link>
                ))}
              </div>
            ))}
            {pool.open.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm">Nothing owed on Goods.</div>
            ) : null}
            {pool.closed.length > 0 ? (
              <details>
                <summary className="cursor-pointer px-4 py-2 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                  History · {pool.closed.length}
                </summary>
                {pool.closed.map((o) => (
                  <Link key={o.id} href={`${base}?rec=${o.id}`} className="flex items-center gap-2.5 border-t-2 border-bauhaus-black/10 px-4 py-2 text-sm text-neutral-500 hover:bg-bauhaus-canvas">
                    <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white ${o.state === 'done' ? 'bg-bauhaus-blue' : 'bg-neutral-400'}`}>{o.state}</span>
                    <span className="min-w-0 flex-1 truncate">{o.title}</span>
                    <OwedToTag t={o.owedTo} />
                  </Link>
                ))}
              </details>
            ) : null}
          </div>

          <div className="border-4 border-bauhaus-black bg-white p-6">
            {selected ? (
              <>
                <div className="flex items-center gap-2.5">
                  <span className="bg-bauhaus-black px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">we owe</span>
                  <OwedToTag t={selected.owedTo} />
                  <Due d={selected.dueDays} />
                  {selected.state !== 'open' ? (
                    <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white ${selected.state === 'done' ? 'bg-bauhaus-blue' : 'bg-neutral-400'}`}>{selected.state}</span>
                  ) : null}
                </div>
                <h2 className="mt-2 text-2xl font-black uppercase leading-tight">{selected.title}</h2>
                <p className="mt-1.5 text-xs font-bold uppercase tracking-widest text-neutral-500">
                  {selected.sourceAskName ? `Minted from ${selected.sourceAskName} · ` : ''}
                  {selected.promisedTo ? `Promised to ${selected.promisedTo} · ` : ''}
                  {selected.owner ? `${selected.owner} · ` : ''}
                  minted {selected.mintedAt.slice(0, 10)}
                </p>
                {selected.nextAction ? (
                  <div className="mt-4 border-2 border-bauhaus-black bg-bauhaus-yellow/20 px-4 py-3">
                    <div className="text-[9px] font-black uppercase tracking-widest">Next move</div>
                    <p className="mt-1 text-sm font-medium">{selected.nextAction}</p>
                  </div>
                ) : null}
                {selected.dropReason ? (
                  <p className="mt-3 text-sm"><span className="font-black uppercase text-[10px] tracking-widest">Dropped because:</span> {selected.dropReason}</p>
                ) : null}
                {selected.artefactUrl ? (
                  <a href={selected.artefactUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-bold underline">
                    Open artefact ↗
                  </a>
                ) : null}
                {selected.state === 'open' ? (
                  <div className="mt-5">
                    <ObligationStateButtons orgProfileId={profile.id} obligationId={selected.id} owedTo={selected.owedTo} />
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm">Nothing selected.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

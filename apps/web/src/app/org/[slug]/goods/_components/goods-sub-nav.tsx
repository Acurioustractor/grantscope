import Link from 'next/link';

// Two intent groups, kept visually separate. Work the pipeline (move relationships
// forward) vs show the evidence (prove the work to a funder). Tab ids and hrefs are
// stable contracts — never rename them.
const PIPELINE_TABS = [
  ['funnel', 'Overview'],
  ['engagement', 'Relationships'],
  ['communities', 'Demand & communities'],
  ['buyers', 'Buyers'],
  ['money', 'Funding & capital'],
] as const;

const EVIDENCE_TABS = [
  ['proof', 'Evidence'],
  ['governance', 'Governance'],
] as const;

const ALL_TABS = [...PIPELINE_TABS, ...EVIDENCE_TABS] as const;

export type GoodsTab = (typeof ALL_TABS)[number][0] | 'insight' | 'signals' | 'timeline' | 'campaign' | 'pitch' | 'intros' | 'foundations';

function TabLink({ slug, tabKey, label, active }: { slug: string; tabKey: GoodsTab; label: string; active?: GoodsTab }) {
  return (
    <Link
      href={`/org/${slug}/goods/${tabKey}`}
      className={`inline-flex min-h-9 items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all ${
        active === tabKey || (tabKey === 'engagement' && ['signals', 'timeline', 'intros'].includes(active || '')) || (tabKey === 'money' && ['campaign', 'insight', 'foundations'].includes(active || '')) || (tabKey === 'proof' && active === 'pitch')
          ? 'border-white bg-white text-[#17352b] shadow-sm'
          : 'border-white/15 bg-white/5 text-white/75 hover:border-white/35 hover:bg-white/10 hover:text-white'
      }`}
    >
      {label}
    </Link>
  );
}

/** Shared dark-header sub-nav across the Goods Command Center pages.
 *  `active` is optional — the hub (/goods index) passes none, so no tab highlights. */
export function GoodsSubNav({ slug, active }: { slug: string; active?: GoodsTab }) {
  return (
    <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/10 p-3 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[10px] font-semibold text-white/45">Workspace</span>
        {PIPELINE_TABS.map(([key, label]) => (
          <TabLink key={key} slug={slug} tabKey={key} label={label} active={active} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        <span className="mr-1 text-[10px] font-semibold text-white/45">Trust & structure</span>
        {EVIDENCE_TABS.map(([key, label]) => (
          <TabLink key={key} slug={slug} tabKey={key} label={label} active={active} />
        ))}
      </div>
    </div>
  );
}

import Link from 'next/link';

// Two intent groups, kept visually separate. Work the pipeline (move relationships
// forward) vs show the evidence (prove the work to a funder). Tab ids and hrefs are
// stable contracts — never rename them.
const PIPELINE_TABS = [
  ['engagement', 'Warmth Map'],
  ['insight', 'Funder Insight'],
  ['signals', 'Signals'],
  ['timeline', 'Timeline'],
  ['money', 'Money'],
  ['funnel', 'Funnel'],
] as const;

const EVIDENCE_TABS = [
  ['proof', 'Proof Pack'],
  ['intros', 'Warm Intros'],
  ['foundations', 'Foundations'],
  ['governance', 'Governance'],
] as const;

const ALL_TABS = [...PIPELINE_TABS, ...EVIDENCE_TABS] as const;

export type GoodsTab = (typeof ALL_TABS)[number][0];

function TabLink({ slug, tabKey, label, active }: { slug: string; tabKey: GoodsTab; label: string; active: GoodsTab }) {
  return (
    <Link
      href={`/org/${slug}/goods/${tabKey}`}
      className={`border-2 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest ${
        active === tabKey ? 'border-white bg-white text-bauhaus-black' : 'border-white/40 text-white hover:border-white'
      }`}
    >
      {label}
    </Link>
  );
}

/** Shared dark-header sub-nav across the Goods Command Center pages. */
export function GoodsSubNav({ slug, active }: { slug: string; active: GoodsTab }) {
  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[9px] font-black uppercase tracking-widest text-white/50">Work the pipeline</span>
        {PIPELINE_TABS.map(([key, label]) => (
          <TabLink key={key} slug={slug} tabKey={key} label={label} active={active} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-white/15 pt-3">
        <span className="mr-1 text-[9px] font-black uppercase tracking-widest text-white/50">Show the evidence</span>
        {EVIDENCE_TABS.map(([key, label]) => (
          <TabLink key={key} slug={slug} tabKey={key} label={label} active={active} />
        ))}
      </div>
    </div>
  );
}

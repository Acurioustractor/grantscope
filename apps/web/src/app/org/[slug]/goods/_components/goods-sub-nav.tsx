import Link from 'next/link';

// The first row is the capital-and-relationship operating loop. Legacy pages
// remain available and map onto these tabs, but no longer define the workspace
// around warmth scores or weighted pipeline values.
const OPERATING_TABS = [
  ['today', 'Today'],
  ['capital', 'Capital'],
  ['matters', 'Matters'],
  ['network', 'Network'],
  ['applications', 'Applications'],
  ['learning', 'Learning'],
] as const;

const DELIVERY_TABS = [
  ['funnel', 'Delivery map'],
  ['communities', 'Demand & communities'],
  ['channels', 'Channels'],
  ['buyers', 'Buyers'],
] as const;

const EVIDENCE_TABS = [
  ['model', 'Story & model'],
  ['proof', 'Evidence'],
  ['governance', 'Governance'],
] as const;

const ALL_TABS = [...OPERATING_TABS, ...DELIVERY_TABS, ...EVIDENCE_TABS] as const;

export type GoodsTab = (typeof ALL_TABS)[number][0]
  | 'money'
  | 'engagement'
  | 'insight'
  | 'signals'
  | 'timeline'
  | 'campaign'
  | 'pitch'
  | 'intros'
  | 'foundations';

function isActiveTab(tabKey: GoodsTab, active?: GoodsTab): boolean {
  if (active === tabKey) return true;
  if (tabKey === 'capital' && ['money', 'campaign', 'insight', 'foundations'].includes(active || '')) return true;
  if (tabKey === 'network' && ['engagement', 'signals', 'timeline', 'intros'].includes(active || '')) return true;
  if (tabKey === 'matters' && active === 'funnel') return true;
  if (tabKey === 'proof' && active === 'pitch') return true;
  return false;
}

function TabLink({ slug, tabKey, label, active }: { slug: string; tabKey: GoodsTab; label: string; active?: GoodsTab }) {
  return (
    <Link
      href={`/org/${slug}/goods/${tabKey}`}
      className={`inline-flex min-h-9 items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all ${
        isActiveTab(tabKey, active)
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
        <span className="mr-1 text-[10px] font-semibold text-white/45">Capital & relationships</span>
        {OPERATING_TABS.map(([key, label]) => (
          <TabLink key={key} slug={slug} tabKey={key} label={label} active={active} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        <span className="mr-1 text-[10px] font-semibold text-white/45">Delivery</span>
        {DELIVERY_TABS.map(([key, label]) => (
          <TabLink key={key} slug={slug} tabKey={key} label={label} active={active} />
        ))}
        <span className="ml-2 mr-1 text-[10px] font-semibold text-white/45">Trust & structure</span>
        {EVIDENCE_TABS.map(([key, label]) => (
          <TabLink key={key} slug={slug} tabKey={key} label={label} active={active} />
        ))}
      </div>
    </div>
  );
}

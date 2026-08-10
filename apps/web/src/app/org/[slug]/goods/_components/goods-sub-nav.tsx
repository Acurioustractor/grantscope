import Link from 'next/link';

// The first row is the capital-and-relationship operating loop. Legacy pages
// remain available and map onto these tabs, but no longer define the workspace
// around warmth scores or weighted pipeline values.
const OPERATING_TABS = [
  ['portfolio', 'Portfolio'],
  ['capital', 'Capital'],
  ['network', 'Relationships'],
] as const;

const DELIVERY_TABS = [
  ['communities', 'Communities'],
  ['buyers', 'Buyers'],
  ['funnel', 'Delivery'],
] as const;

// Money-in surfaces: the funder pipeline is worked here. These were previously
// buried as "legacy" under Capital — Ben could not find grants/foundations/
// pipelines from the workspace nav (2026-08-05), so they are first-class now.
const FUNDING_TABS: ReadonlyArray<readonly [string, string]> = [
  ['grants', 'Grants'],
  ['money', 'Money'],
  ['foundations', 'Foundations'],
] as const;

const EVIDENCE_TABS = [
  ['proof', 'Evidence'],
] as const;

const ALL_TABS = [...OPERATING_TABS, ...FUNDING_TABS, ...DELIVERY_TABS, ...EVIDENCE_TABS] as const;

/** Merged-away screens keep working and keep a valid `active` key — they are
 *  reachable from their parent screen and from the hub's "everything else"
 *  list, they just no longer own a place in the nav (2026-08-10). */
type MergedTab =
  | 'money' | 'engagement' | 'insight' | 'signals' | 'timeline' | 'campaign'
  | 'pitch' | 'intros' | 'foundations' | 'today' | 'matters' | 'applications'
  | 'learning' | 'map' | 'channels' | 'we-owe' | 'model' | 'governance';

export type GoodsTab = (typeof ALL_TABS)[number][0] | MergedTab;

/** Which nav entry lights up for a screen that no longer has its own tab. */
const MERGED_INTO: Partial<Record<GoodsTab, GoodsTab>> = {
  money: 'money',
  campaign: 'capital', insight: 'capital', today: 'capital',
  matters: 'capital', applications: 'capital', learning: 'capital',
  engagement: 'network', signals: 'network', timeline: 'network', intros: 'network',
  map: 'funnel', channels: 'funnel', 'we-owe': 'funnel',
  pitch: 'proof', model: 'proof', governance: 'proof',
};

function isActiveTab(tabKey: GoodsTab, active?: GoodsTab): boolean {
  if (active === tabKey) return true;
  return Boolean(active && MERGED_INTO[active] === tabKey);
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

/** The rail owns Goods navigation now (GoodsRailTree in act-workspace-shell —
 *  Ben's one-system call, 2026-08-05). This renders a compact nav only below
 *  lg, where the rail is hidden; on desktop it renders nothing. */
export function GoodsSubNav({ slug, active }: { slug: string; active?: GoodsTab }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 lg:hidden">
      {[...OPERATING_TABS, ...FUNDING_TABS, ...DELIVERY_TABS, ...EVIDENCE_TABS].map(([key, label]) => (
        <Link
          key={key}
          href={`/org/${slug}/goods/${key}`}
          className={`inline-flex min-h-8 items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
            active === key
              ? 'border-white bg-white text-[#17352b]'
              : 'border-white/15 bg-white/5 text-white/75'
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

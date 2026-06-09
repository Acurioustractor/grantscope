import Link from 'next/link';

const TABS = [
  ['engagement', 'Warmth Map'],
  ['money', 'Money'],
  ['intros', 'Warm Intros'],
  ['foundations', 'Foundations'],
] as const;

export type GoodsTab = (typeof TABS)[number][0];

/** Shared dark-header sub-nav across the Goods Command Center pages. */
export function GoodsSubNav({ slug, active }: { slug: string; active: GoodsTab }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {TABS.map(([key, label]) => (
        <Link
          key={key}
          href={`/org/${slug}/goods/${key}`}
          className={`border-2 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest ${
            active === key ? 'border-white bg-white text-bauhaus-black' : 'border-white/40 text-white hover:border-white'
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

import Link from 'next/link';

export type GoodsViewMode = 'cards' | 'table' | 'compact';

export function resolveViewMode(value: string | string[] | undefined, fallback: GoodsViewMode = 'cards'): GoodsViewMode {
  const v = Array.isArray(value) ? value[0] : value;
  return v === 'table' || v === 'compact' || v === 'cards' ? v : fallback;
}

/**
 * Server-side density switcher: Cards / Table / Compact, driven by a URL param
 * so every Goods surface can offer the same three readings of a list without
 * client state. `param` names the query key so two sections on one page can
 * toggle independently.
 */
export function GoodsViewToggle({ basePath, param, active, otherParams }: {
  basePath: string;
  param: string;
  active: GoodsViewMode;
  otherParams?: Record<string, string>;
}) {
  const modes: GoodsViewMode[] = ['cards', 'table', 'compact'];
  const href = (mode: GoodsViewMode) => {
    const qs = new URLSearchParams({ ...(otherParams ?? {}), [param]: mode });
    return `${basePath}?${qs.toString()}`;
  };
  return (
    <div className="inline-flex border-2 border-bauhaus-black bg-white">
      {modes.map((mode) => (
        <Link
          key={mode}
          href={href(mode)}
          aria-current={active === mode ? 'true' : undefined}
          className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
            active === mode ? 'bg-bauhaus-black text-white' : 'hover:bg-bauhaus-canvas'
          }`}
        >
          {mode}
        </Link>
      ))}
    </div>
  );
}

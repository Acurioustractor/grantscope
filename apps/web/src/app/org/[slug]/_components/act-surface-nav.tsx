import Link from 'next/link';

export type ActSurface = 'today' | 'pipeline' | 'triage' | 'foundations' | 'procurement';

interface ActSurfaceNavProps {
  slug: string;
  current: ActSurface;
  /** Optional counters shown next to each surface. Pass only what you have. */
  counts?: Partial<Record<ActSurface, string | number | null | undefined>>;
}

const SURFACES: Array<{ id: ActSurface; label: string; href: (slug: string) => string }> = [
  { id: 'today',       label: 'Today',       href: (s) => `/org/${s}/today` },
  { id: 'pipeline',    label: 'Pipeline',    href: (s) => `/org/${s}/pipeline` },
  { id: 'triage',      label: 'Triage',      href: (s) => `/org/${s}/pipeline/triage` },
  { id: 'foundations', label: 'Foundations', href: (s) => `/org/${s}/foundations/watchlist` },
  { id: 'procurement', label: 'Procurement', href: (s) => `/org/${s}/procurement/opportunities` },
];

/**
 * Tabbed nav across the four ACT decision surfaces. Renders inside dark
 * headers, so styles assume `bg-bauhaus-black` parent. Drop in below the
 * page title row.
 */
export function ActSurfaceNav({ slug, current, counts = {} }: ActSurfaceNavProps) {
  return (
    <nav className="flex gap-1 flex-wrap text-[10px] font-black uppercase tracking-widest">
      {SURFACES.map((s) => {
        const isActive = s.id === current;
        const count = counts[s.id];
        return (
          <Link
            key={s.id}
            href={s.href(slug)}
            className={
              isActive
                ? 'px-3 py-2 bg-white text-bauhaus-black border-2 border-white'
                : 'px-3 py-2 text-white border-2 border-white/30 hover:bg-white hover:text-bauhaus-black hover:border-white'
            }
            aria-current={isActive ? 'page' : undefined}
          >
            {s.label}
            {count != null && count !== '' && (
              <span className={`ml-2 ${isActive ? 'text-bauhaus-red' : 'text-bauhaus-yellow'} font-mono tabular-nums`}>
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

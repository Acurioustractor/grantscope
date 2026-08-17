import type { Metadata } from 'next';
import Link from 'next/link';
import { VIEW_REGISTRY } from '@/lib/view-registry';

export const metadata: Metadata = { title: 'Views — CivicGraph' };

const VIEW_DOT: Record<string, string> = {
  red: '#D02020',
  blue: '#1040C0',
  yellow: '#F0C020',
  green: '#059669',
  ink: '#6E6E6E',
};

/**
 * The complete views index. The rail pins a curated few; this page lists every registered view,
 * so nothing in the registry is reachable only by knowing its URL.
 */
export default function ViewsIndexPage() {
  return (
    <div className="mx-auto max-w-[1100px] px-6 py-6">
      <h1 className="font-display text-[22px] font-extrabold">Views</h1>
      <p className="mt-1 text-[13.5px]" style={{ color: 'var(--shell-muted)' }}>
        Every saved view on the graph. Pinned views also sit in the rail; the rest live only here.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {VIEW_REGISTRY.map((v) => (
          <Link
            key={v.id}
            href={v.href}
            className="block bg-white p-4"
            style={{ borderRadius: 'var(--shell-r)', border: '1px solid var(--shell-line)' }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="inline-block h-2 w-2 shrink-0"
                style={{ background: VIEW_DOT[v.colour], borderRadius: 2 }}
              />
              <span className="font-display text-[15px] font-bold">{v.name}</span>
              {v.pinned && (
                <span
                  className="ml-auto font-mono text-[10px] uppercase tracking-widest"
                  style={{ color: 'var(--shell-muted)' }}
                >
                  pinned
                </span>
              )}
            </div>
            <p className="mt-1.5 text-[12.5px]" style={{ color: 'var(--shell-muted)' }}>
              {v.question}
            </p>
            {v.caveat && (
              <p className="mt-2 font-mono text-[11px]" style={{ color: 'var(--shell-muted)' }}>
                {v.caveat}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

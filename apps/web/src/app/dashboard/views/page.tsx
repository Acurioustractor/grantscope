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
 * The complete index of ways to look at the graph: every curated view in the registry, then
 * every kind browser. Nothing on either list is reachable only by knowing its URL. The registry
 * stays scoped to question-shaped views; browsers are nouns, listed separately (ruling from the
 * 2026-08-17 code-review pass).
 */
const KIND_BROWSERS: { href: string; label: string; blurb: string }[] = [
  { href: '/foundations', label: 'Foundations', blurb: 'who gives, and to whom' },
  { href: '/social-enterprises', label: 'Social enterprises', blurb: 'the register and what we know' },
  { href: '/charities', label: 'Charities', blurb: 'ACNC register with six years of returns' },
  { href: '/grants', label: 'Grant recipients', blurb: 'who receives justice-system grants' },
  { href: '/dashboard/browse/contracts', label: 'Contract suppliers', blurb: 'who wins Commonwealth contracts' },
  { href: '/dashboard/browse/buyers', label: 'Government buyers', blurb: 'which agencies let them' },
  { href: '/dashboard/browse/donations', label: 'Political donors', blurb: 'declared donations only' },
  { href: '/dashboard/people', label: 'People', blurb: 'boards and the money past them' },
  { href: '/dashboard/places', label: 'Places', blurb: 'council areas: money vs disadvantage' },
];

export default function ViewsIndexPage() {
  return (
    <div className="mx-auto max-w-[1100px] px-6 py-6">
      <h1 className="font-display text-[22px] font-extrabold">Views</h1>
      <p className="mt-1 text-[13.5px]" style={{ color: 'var(--shell-muted)' }}>
        Curated views answer one question each; kind browsers below let you walk a whole kind of
        thing. Pinned views also sit in the rail.
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

      <h2 className="mt-8 font-display text-[16px] font-extrabold">Kind browsers</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {KIND_BROWSERS.map((k) => (
          <Link
            key={k.href}
            href={k.href}
            className="block bg-white p-4"
            style={{ borderRadius: 'var(--shell-r)', border: '1px solid var(--shell-line)' }}
          >
            <div className="font-display text-[14px] font-bold">{k.label}</div>
            <p className="mt-1 text-[12.5px]" style={{ color: 'var(--shell-muted)' }}>{k.blurb}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

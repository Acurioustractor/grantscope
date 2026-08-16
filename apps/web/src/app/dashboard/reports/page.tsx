import type { Metadata } from 'next';
import Link from 'next/link';
import {
  reportSections,
  reportStatusMeta,
  type NavItem,
} from '../../reports/_components/sidebar-nav-data';

export const metadata: Metadata = { title: 'Reports — CivicGraph' };

function flatten(items: NavItem[]): NavItem[] {
  return items.flatMap((i) => [i, ...(i.children ? flatten(i.children) : [])]);
}

/** Shell-native Reports index; report pages themselves are the public atlas by design. */
export default function ReportsIndexPage() {
  return (
    <div className="mx-auto max-w-[1100px] px-6 py-6">
      <h1 className="font-display text-[22px] font-extrabold">Reports</h1>
      <p className="mt-1 text-[13.5px]" style={{ color: 'var(--shell-muted)' }}>
        Every published report, with its review status. Reports open on the public atlas.
      </p>
      {reportSections.map((section) => (
        <section
          key={section.title}
          className="mt-5 bg-white p-4"
          style={{ borderRadius: 'var(--shell-r)', border: '1px solid var(--shell-line)' }}
        >
          <h2 className="font-display text-[14px] font-bold">{section.title}</h2>
          <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {Array.from(new Map(flatten(section.items).map((r) => [r.href, r])).values()).map(
              (r) => (
                <li key={r.href} className="flex items-baseline gap-2 text-[13px]">
                  <Link href={r.href} className="hover:underline" style={{ color: '#1040C0' }}>
                    {r.label}
                  </Link>
                  {r.status ? (
                    <span
                      className="font-mono text-[10px] uppercase"
                      style={{ color: r.status === 'review' ? '#D02020' : 'var(--shell-muted)' }}
                    >
                      {reportStatusMeta[r.status]?.label ?? r.status}
                    </span>
                  ) : null}
                </li>
              ),
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}

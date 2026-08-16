import Link from 'next/link';
import { DATA_DOCS, liveCounts, approxCount } from '@/lib/data-docs';

export const metadata = { title: 'The data — CivicGraph' };

/** Counts are planner estimates and refresh hourly with the page. */
export const revalidate = 3600;

/**
 * The public docs surface: what CivicGraph holds and how much to trust it.
 * Content is the allowlist in lib/data-docs.ts — see the safety rule there before adding
 * anything. Numbers on this page are live estimates, never typed in.
 */
export default async function DataDocsPage() {
  const counts = await liveCounts();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] font-extrabold">The data</h1>
        <p className="text-sm" style={{ color: 'var(--shell-muted)' }}>
          Every dataset behind this dashboard: where it came from, roughly how big it is, and
          what it cannot tell you.
        </p>
      </header>

      <section className="shell-card flex flex-col gap-3 px-6 py-5">
        <h2 className="font-display text-[16px] font-bold">How it fits together</h2>
        <p className="text-[13.5px] leading-relaxed">
          Four kinds of data meet on one spine. <strong>Money</strong> — contracts, grants and
          donations. <strong>Governance</strong> — who sits on which boards.{' '}
          <strong>Place</strong> — where organisations and money actually are.{' '}
          <strong>Evidence</strong> — what works. Each dataset below feeds one of those, and all
          of them resolve to a shared entity graph, so a supplier in a contract, a recipient in a
          grant register and a charity in the ACNC register can be recognised as the same
          organisation.
        </p>
        <p className="text-[13.5px] leading-relaxed">
          Every claim on this dashboard is graded: <strong>verified</strong> means computed from
          these rows; anything derived or uncertain says so where it appears. Dollar figures pass
          through the filters described in{' '}
          <Link href="/dashboard/help" className="font-semibold" style={{ color: '#1040C0' }}>
            Why our numbers differ
          </Link>
          .
        </p>
      </section>

      <section className="shell-card flex flex-col px-6 py-5">
        <h2 className="font-display text-[16px] font-bold">The datasets</h2>
        <div className="mt-2 flex flex-col">
          {DATA_DOCS.map((d) => {
            const n = counts.get(d.id);
            return (
              <div key={d.id} className="py-3.5" style={{ borderTop: '1px solid var(--shell-line)' }}>
                <div className="flex items-baseline gap-3">
                  <span className="text-[13.5px] font-bold">{d.name}</span>
                  <div className="flex-1" />
                  {n != null && (
                    <span className="shrink-0 font-mono text-[12.5px]" style={{ color: 'var(--shell-muted)' }}>
                      {approxCount(n)} rows
                    </span>
                  )}
                </div>
                <p className="text-[13px]">{d.description}</p>
                <p className="text-[12px]" style={{ color: 'var(--shell-muted)' }}>
                  Source: {d.source}
                </p>
                {d.caveat && (
                  <p className="mt-1 text-[12px] italic" style={{ color: 'var(--shell-muted)' }}>
                    {d.caveat}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[12px]" style={{ color: 'var(--shell-muted)' }}>
          Row counts are the database&rsquo;s own estimates, refreshed hourly — approximate on
          purpose, so they can be live instead of stale.
        </p>
      </section>

      <section className="shell-card flex flex-col gap-2 px-6 py-5">
        <h2 className="font-display text-[16px] font-bold">Known limits</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-[13.5px] leading-relaxed">
          <li>
            <strong>Funding figures are floors.</strong> They count what was published and could
            be traced to a named organisation. Unpublished spending and departmental budget lines
            are not here.
          </li>
          <li>
            <strong>Money reaching remote communities is often credited to a regional hub.</strong>{' '}
            Funding routed through land councils and regional intermediaries is recorded at the
            intermediary&rsquo;s address, which can overstate cities and understate communities.
          </li>
          <li>
            <strong>Financial-year labels are not uniform.</strong> Source registers write the
            same year several ways, and some rows span multiple years. We show the labels as
            recorded rather than merging them by guesswork.
          </li>
          <li>
            <strong>Most political receipts cannot be attributed.</strong> Over half of declared
            receipts carry no ABN and no reliable name match, so influence figures understate
            rather than guess.
          </li>
          <li>
            <strong>Evidence coverage is thin and honest about it.</strong> The Australian Living
            Map of Alternatives (ALMA) register is small; the gap between money and recorded
            evidence is itself one of our headline findings, not a defect to hide.
          </li>
        </ul>
      </section>
    </div>
  );
}

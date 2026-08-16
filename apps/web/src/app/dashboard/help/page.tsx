import Link from 'next/link';
import { VIEW_REGISTRY } from '@/lib/view-registry';

export const metadata = { title: 'Help — CivicGraph' };

/**
 * The help centre is provenance, not support tickets. The #1 question this product
 * gets is "why is your number smaller than the press release" — so that answer
 * comes first, in plain words, with the exclusions stated as features.
 */
export default function HelpPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] font-extrabold">Help</h1>
        <p className="text-sm" style={{ color: 'var(--shell-muted)' }}>
          How to read what this dashboard shows you — and why some numbers are smaller than
          the ones in press releases.
        </p>
      </header>

      <section className="shell-card flex flex-col gap-3 px-6 py-5">
        <h2 className="font-display text-[16px] font-bold">Why our numbers differ</h2>
        <p className="text-[13.5px] leading-relaxed">
          Government funding data mixes three things that look the same in a spreadsheet:
          real grants to real organisations, whole-of-state budget lines, and the
          spreadsheet&rsquo;s own total rows. Summed naively, they overstate money to
          organisations by billions. Every dollar figure on this dashboard applies three
          filters before it reaches you:
        </p>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-[13.5px] leading-relaxed">
          <li>
            <strong>Grants only.</strong> State budget aggregates — money that was never paid
            to any organisation — are excluded.
          </li>
          <li>
            <strong>No total rows.</strong> Rows named &ldquo;Total&rdquo;,
            &ldquo;Various&rdquo; or similar are spreadsheet artefacts, not recipients. On
            youth justice alone these carried over $600M and would rank as the #1 recipient
            in Australia if left in.
          </li>
          <li>
            <strong>Excluded money is disclosed.</strong> Where a headline shows a total, the
            dollars we removed are stated next to it, never silently dropped.
          </li>
        </ol>
        <p className="text-[13.5px] leading-relaxed">
          The result is a <strong>floor, not a total</strong>: money we can trace to a named
          organisation. If a number here is smaller than one you have seen elsewhere, this is
          usually why — and it is the more honest figure.
        </p>
      </section>

      <section id="caveats" className="shell-card flex flex-col gap-3 px-6 py-5">
        <h2 className="font-display text-[16px] font-bold">Caveats on every view</h2>
        <p className="text-[13.5px]" style={{ color: 'var(--shell-muted)' }}>
          Each saved view carries its own caveat. They travel with the view — you will see
          them on the cards too.
        </p>
        <div className="flex flex-col">
          {VIEW_REGISTRY.map((v) => (
            <div key={v.id} className="py-3" style={{ borderTop: '1px solid var(--shell-line)' }}>
              <Link href={v.href} className="text-[13.5px] font-bold" style={{ color: '#1040C0' }}>
                {v.name}
              </Link>
              <p className="text-[13px]">{v.question}</p>
              {v.caveat && (
                <p className="text-[12px] italic" style={{ color: 'var(--shell-muted)' }}>
                  {v.caveat}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="shell-card flex flex-col gap-2 px-6 py-5">
        <h2 className="font-display text-[16px] font-bold">People are counted, not priced</h2>
        <p className="text-[13.5px] leading-relaxed">
          Where the dashboard shows individuals — board members, directors — it shows how many
          organisations they are connected to, never a personal dollar figure. Attributing
          organisational money to a named person is misleading and unfair, so we do not do it.
        </p>
      </section>
    </div>
  );
}

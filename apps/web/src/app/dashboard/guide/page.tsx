import Link from 'next/link';

export const metadata = { title: 'What this is — CivicGraph' };

/**
 * The real-work guide (Ben's directive, 2026-08-17): everything the platform says about itself
 * gets said in plain words first. Technical names are small print everywhere; this page is where
 * the whole thing gets explained in the language of the work it illuminates. Written under the
 * ACT voice rules: no jargon, no corporate English, community at the centre.
 */
export default function GuidePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] font-extrabold">What this is</h1>
        <p className="text-sm" style={{ color: 'var(--shell-muted)' }}>
          The whole platform in plain words. No database names past this sentence.
        </p>
      </header>

      <section className="shell-card flex flex-col gap-3 px-6 py-5">
        <h2 className="font-display text-[16px] font-bold">The question underneath everything</h2>
        <p className="text-[13.5px] leading-relaxed">
          Who holds the money in Australia, where does it actually go, and does it reach the
          communities it is meant for? Governments publish contracts in one place, grants in
          another, political donations in a third. Charities report to one regulator, companies to
          another, foundations mostly to nobody. Each register is public. None of them talk to
          each other. This platform joins them, so a question that used to take a researcher weeks
          takes you a minute.
        </p>
      </section>

      <section className="shell-card flex flex-col gap-3 px-6 py-5">
        <h2 className="font-display text-[16px] font-bold">What we hold, in real terms</h2>
        <p className="text-[13.5px] leading-relaxed">
          <strong>Every dollar the public record can see.</strong> Twenty years of government
          contracts. Awarded grants across Commonwealth and states. Two and a half million
          political donation records. Foundation and philanthropic giving, including the family
          foundations that publish almost nothing and show up only where their money lands.
        </p>
        <p className="text-[13.5px] leading-relaxed">
          <strong>Who is behind the money.</strong> The full company and charity registers, and
          the people: directors, boards, and the same names appearing across many boards. When one
          person sits on a funder&rsquo;s board and a recipient&rsquo;s board, that is visible
          here.
        </p>
        <p className="text-[13.5px] leading-relaxed">
          <strong>Where it lands.</strong> Every organisation placed on the map, so you can ask
          the sharpest question in the dataset: which communities carry the deepest disadvantage
          and receive the least money. We call these funding deserts, and they are measured, not
          asserted.
        </p>
        <p className="text-[13.5px] leading-relaxed">
          <strong>What actually works.</strong> The Australian Living Map of Alternatives:
          programs, interventions and their evidence. Set against the money, it answers the
          uncomfortable question of how much funding flows to work with no recorded evidence at
          all, and how much proven work goes unfunded.
        </p>
        <p className="text-[13.5px] leading-relaxed">
          <strong>Who is doing the work.</strong> A free, open registry of social enterprises and
          community organisations, including which are community controlled. The share of youth
          justice money reaching community-controlled organisations sits on the front page of the
          dashboard because it is the number that tells you whether the system funds communities
          or funds around them.
        </p>
      </section>

      <section className="shell-card flex flex-col gap-3 px-6 py-5">
        <h2 className="font-display text-[16px] font-bold">What it is for</h2>
        <p className="text-[13.5px] leading-relaxed">
          Decisions. A community organisation deciding which funder to approach, armed with what
          that funder actually pays for. A buyer deciding which supplier is proven, with delivery
          history instead of marketing. A journalist or researcher tracing how a donation, a board
          seat and a contract line up. A foundation seeing the gap between where need is and where
          its giving goes. The test for every screen is the same: could someone act on this, and
          would they trust it enough to.
        </p>
        <p className="text-[13.5px] leading-relaxed">
          Trust is the product. Every number states what was excluded and why.{' '}
          <Link href="/dashboard/help" className="underline" style={{ color: '#1040C0' }}>
            Why our numbers differ
          </Link>{' '}
          explains the filters. When we cannot say something honestly, the page says so instead of
          guessing. Stories from community members appear only where the storyteller consented,
          and they link to projects, never to data about people.
        </p>
      </section>

      <section className="shell-card flex flex-col gap-3 px-6 py-5">
        <h2 className="font-display text-[16px] font-bold">The engine room</h2>
        <p className="text-[13.5px] leading-relaxed">
          Clarity is where we keep ourselves honest. It is the ledger of everything the platform
          holds: nearly 1,500 collections of data, each with a plain-English sentence saying what
          it is, who uses it, how fresh it is, and what it must never be used for. It is where we
          find data nothing uses, connections not yet made, and any place the platform&rsquo;s
          public face touches something it should not. Most people never need it. It exists so
          that when you ask why a number says what it says, there is always an answer.
        </p>
      </section>

      <section className="shell-card flex flex-col gap-3 px-6 py-5">
        <h2 className="font-display text-[16px] font-bold">The rule we write by</h2>
        <p className="text-[13.5px] leading-relaxed">
          Plain words first, everywhere. Database names and technical terms are small print. If a
          screen cannot explain itself to someone outside the building, the screen is not
          finished. Where you find one that fails this test, that is a bug: tell us.
        </p>
      </section>
    </div>
  );
}

import Link from 'next/link';

export const metadata = {
  title: 'Discover — CivicGraph',
  description: "Featured investigative reports + ask for one on your sector. Live watchhouse data, $1.88B detention spend, federation peak-body fragility, and more — sourced.",
};

const FEATURED = [
  {
    href: '/share/qld-youth-justice',
    kicker: '★ Featured · Live data',
    title: "QLD Youth Justice — Where the Money, the Children, and the Evidence Go",
    blurb: "$1.88B detention vs $1.49B community. ~91% of children in QLD watchhouses today are First Nations. 12 evidence-backed alternatives that already exist.",
    bullets: [
      'Live watchhouse occupancy refreshed every 12 hours from QPS',
      'QLD state-budget Youth Justice expenditure across years',
      'Top-funded community partners + their dollar share',
      'Australian Living Map of Alternatives (ALMA) interventions',
    ],
    bg: 'bg-bauhaus-red text-white',
  },
  {
    href: '/share/fecca-eccv',
    kicker: 'Worked example',
    title: "FECCA & ECCV — The Federation's Money Map",
    blurb: 'Two policy bodies, two single-funder dependencies. $1B+ federal multicultural procurement they don’t see. FECCA only became an ACNC-registered charity in 2023, after 24 years.',
    bullets: [
      "Audited financials, federal procurement, state grants, board interlocks",
      "5 sourced findings + 'What this means for you' action panel",
      "Director drill-downs scoped to the report",
      "Cross-source triangulation (ABR · ACNC · Austender · audits)",
    ],
    bg: 'bg-bauhaus-yellow text-bauhaus-black',
  },
];

const TOPIC_HINTS = [
  { label: 'Federal procurement', q: 'federal procurement deep-dive on [your sector]' },
  { label: 'State grants', q: 'state-grant flows for [your sector] in [state]' },
  { label: 'Board interlocks', q: 'board / director map across [your network]' },
  { label: 'Foundation flows', q: 'foundation giving to [your sector or org]' },
  { label: 'ACCO funding', q: 'ACCO vs mainstream NGO dollar share in [your sector]' },
  { label: 'Lobbyist register', q: 'lobbyists active in [your policy area]' },
  { label: 'Political donations', q: 'donations from [your sector] to political parties' },
  { label: 'Live monitoring', q: 'recurring monitoring on [orgs you watch]' },
];

export default function DiscoverPage() {
  return (
    <div>
      <div className="mb-12">
        <Link href="/" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">← CivicGraph</Link>
        <div className="text-xs font-black text-bauhaus-yellow mt-4 mb-1 uppercase tracking-widest">Discover</div>
        <h1 className="text-4xl sm:text-5xl font-black text-bauhaus-black mb-4 uppercase tracking-tight leading-tight">
          Investigative reports on the Australian civic sector — sourced.
        </h1>
        <p className="text-xl sm:text-2xl text-bauhaus-muted leading-tight font-medium max-w-3xl">
          Live data, audited financials, federal procurement, state grants, board interlocks. Written so a board, a funder, a journalist, or a sector peer can read it in 10 minutes and act on it.
        </p>
      </div>

      {/* Featured reports */}
      <section className="mb-16">
        <div className="grid md:grid-cols-2 gap-6">
          {FEATURED.map((f, i) => (
            <Link
              key={i}
              href={f.href}
              className={`block border-4 border-bauhaus-black p-7 ${f.bg} hover:shadow-[8px_8px_0_0_rgba(0,0,0,1)] transition-shadow`}
            >
              <div className={`text-xs font-black uppercase tracking-widest mb-3 ${f.bg.includes('text-white') ? 'opacity-70' : 'text-bauhaus-muted'}`}>{f.kicker}</div>
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight leading-tight mb-3">{f.title}</h2>
              <p className="text-sm font-medium leading-relaxed mb-4">{f.blurb}</p>
              <ul className="space-y-1 mb-5">
                {f.bullets.map((b, j) => (
                  <li key={j} className="text-xs font-medium leading-relaxed pl-4 relative">
                    <span className="absolute left-0 font-black">·</span>{b}
                  </li>
                ))}
              </ul>
              <div className="text-xs font-black uppercase tracking-widest">Read the report →</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Ask for one */}
      <section className="border-4 border-bauhaus-black p-8 bg-bauhaus-canvas mb-12">
        <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">★ Free for the first 5 sectors</div>
        <h2 className="text-3xl font-black text-bauhaus-black uppercase tracking-tight mb-3">Want one on your sector?</h2>
        <p className="text-bauhaus-black font-medium leading-relaxed text-base max-w-3xl mb-5">
          Tell us the organisation, sector, network, funding stream, or specific question you want investigated. We&apos;ll triage within 48 hours and either confirm scope or come back with questions. The first five sectors are free for orgs willing to be a public case study; everything else is priced after we learn what people actually find valuable.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          {TOPIC_HINTS.map((t, i) => (
            <div key={i} className="border-2 border-bauhaus-black bg-white p-3">
              <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-1">{t.label}</div>
              <div className="text-xs font-mono text-bauhaus-black leading-relaxed">{t.q}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/get-a-report?free=true&src=discover" className="inline-block px-5 py-3 text-sm font-black uppercase tracking-widest bg-bauhaus-red text-white border-2 border-bauhaus-black hover:bg-bauhaus-black">★ Apply for a free report →</Link>
          <Link href="/feedback?subject=discover" className="inline-block px-5 py-3 text-sm font-black uppercase tracking-widest bg-bauhaus-black text-white border-2 border-bauhaus-black hover:bg-bauhaus-red">Send feedback first</Link>
        </div>
      </section>

      <section className="text-center mb-8">
        <p className="text-sm text-bauhaus-muted font-medium mb-2">Questions before submitting?</p>
        <a href="mailto:Benjamin@act.place" className="text-bauhaus-blue font-black text-sm hover:underline">Benjamin@act.place</a>
      </section>
    </div>
  );
}

import Link from 'next/link';

export const metadata = {
  title: 'Pricing — CivicGraph',
  description: 'Pricing for CivicGraph investigative reports, monitoring, and sector subscriptions.',
};

const tiers = [
  {
    name: 'Public dashboards',
    price: 'Free',
    sub: 'Indexed by Google. No signup.',
    tone: 'canvas',
    description: 'Browse every published deep-dive, the live entity graph, and individual organisation profiles.',
    features: [
      'Live dashboards (e.g. /reports/multicultural-sector/fecca-eccv)',
      'Long-form narrative reports for published case studies',
      'Network graph of 159K Australian entities',
      'Individual org profiles at /orgs/<id>',
    ],
    cta: { label: 'Browse the dashboards', href: '/reports' },
  },
  {
    name: 'First 5 Free',
    price: '$0',
    sub: 'Limited campaign — 5 reports total',
    tone: 'yellow',
    description: 'Apply for one of five free FECCA-style investigative reports on your sector or organisation. Selected applicants get the full long-read treatment in exchange for case-study permission.',
    features: [
      'Full ~12-min narrative report with cited findings',
      'Live dashboard view of the same data',
      '1-hour briefing call to walk through findings',
      'Featured as a Founding Customer case study (with permission)',
    ],
    cta: { label: 'Apply for First 5 Free', href: '/get-a-report?free=true' },
    highlight: true,
  },
  {
    name: 'On-Demand Report',
    price: '$2,500',
    sub: 'per report · 5–7 day turnaround',
    tone: 'white',
    description: 'A one-off investigative deep-dive on the organisation, network, sector, or funding stream of your choice. Same template as the FECCA / ECCV report.',
    features: [
      'Live dashboard + narrative long-read',
      'Cross-source triangulation (ABR · ACNC · Austender · audits)',
      'Citation list for every claim',
      '1-hour briefing call',
      'Private link or public publication, your choice',
    ],
    cta: { label: 'Request a paid report', href: '/get-a-report?budget=2500' },
  },
  {
    name: 'Sector Subscription',
    price: '$7,500',
    sub: 'per year',
    tone: 'white',
    description: 'For foundations, peak bodies, oversight agencies, and donor coalitions tracking a sector over time.',
    features: [
      '4 long-form sector reports per year',
      'Monthly briefing memo when something material changes',
      'Watchlist alerts on up to 50 organisations',
      'Direct analyst access (email + 1 quarterly call)',
      'API access to your watchlist data',
    ],
    cta: { label: 'Discuss a subscription', href: '/get-a-report?budget=7500' },
  },
  {
    name: 'Strategic Engagement',
    price: '$25K+',
    sub: 'per project · scoping required',
    tone: 'black',
    description: 'For royal commissions, state-government oversight bodies, and large foundations. Bespoke sector mapping, multi-org diligence packages, and custom data integration with your internal systems.',
    features: [
      'Full sector or jurisdiction mapping',
      'Multi-organisation diligence packs (10–50 orgs)',
      'Custom data feeds + integration with your stack',
      'Scoped to your decision timeline',
      'Direct access to the analyst team',
    ],
    cta: { label: 'Scope an engagement', href: '/get-a-report?budget=25000' },
  },
];

function Tier({ t }: { t: typeof tiers[number] }) {
  const bg = t.tone === 'yellow' ? 'bg-bauhaus-yellow' :
             t.tone === 'canvas' ? 'bg-bauhaus-canvas' :
             t.tone === 'black' ? 'bg-bauhaus-black text-white' : 'bg-white';
  const txt = t.tone === 'black' ? 'text-white' : 'text-bauhaus-black';
  const border = t.highlight ? 'border-bauhaus-red border-8' : 'border-bauhaus-black border-4';
  const ctaCls = t.tone === 'black'
    ? 'inline-block px-4 py-3 text-xs font-black uppercase tracking-widest bg-bauhaus-yellow text-bauhaus-black hover:bg-bauhaus-canvas border-2 border-bauhaus-yellow'
    : 'inline-block px-4 py-3 text-xs font-black uppercase tracking-widest bg-bauhaus-black text-white hover:bg-bauhaus-red border-2 border-bauhaus-black';
  return (
    <div className={`${bg} ${txt} ${border} p-6 flex flex-col`}>
      {t.highlight && (
        <div className="text-[10px] font-black text-bauhaus-red uppercase tracking-widest mb-2 inline-block bg-bauhaus-black px-2 py-1 self-start">★ Launch Campaign</div>
      )}
      <h3 className="text-2xl font-black uppercase tracking-tight leading-tight mb-2">{t.name}</h3>
      <div className="mb-4">
        <div className="text-4xl font-black tabular-nums">{t.price}</div>
        <div className={`text-xs font-mono uppercase tracking-widest mt-1 ${t.tone === 'black' ? 'text-bauhaus-yellow' : 'text-bauhaus-muted'}`}>{t.sub}</div>
      </div>
      <p className={`text-sm leading-relaxed mb-4 font-medium ${t.tone === 'black' ? 'text-white/80' : 'text-bauhaus-muted'}`}>
        {t.description}
      </p>
      <ul className="space-y-2 mb-6 flex-1">
        {t.features.map((f, i) => (
          <li key={i} className={`text-xs leading-relaxed font-medium pl-4 relative ${t.tone === 'black' ? 'text-white/90' : 'text-bauhaus-black'}`}>
            <span className={`absolute left-0 font-black ${t.tone === 'black' ? 'text-bauhaus-yellow' : 'text-bauhaus-red'}`}>·</span>
            {f}
          </li>
        ))}
      </ul>
      <Link href={t.cta.href} className={ctaCls}>{t.cta.label} →</Link>
    </div>
  );
}

export default function PricingPage() {
  return (
    <div>
      <div className="mb-12">
        <Link href="/" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">← CivicGraph</Link>
        <div className="text-xs font-black text-bauhaus-yellow mt-4 mb-1 uppercase tracking-widest">Pricing</div>
        <h1 className="text-4xl sm:text-5xl font-black text-bauhaus-black mb-4 uppercase tracking-tight leading-tight">
          Civic-sector intelligence, sourced.
        </h1>
        <p className="text-xl sm:text-2xl text-bauhaus-muted leading-tight font-medium max-w-3xl">
          Five ways to use CivicGraph &mdash; from free public dashboards through to bespoke royal-commission-grade engagements.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
        {tiers.map((t, i) => <Tier key={i} t={t} />)}
      </div>

      <section className="border-4 border-bauhaus-black p-8 bg-bauhaus-canvas mb-12">
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-4">How it works</h2>
        <ol className="space-y-3 text-bauhaus-black font-medium text-sm leading-relaxed">
          <li><span className="font-black text-bauhaus-blue mr-2">01</span>You submit an EOI at <Link href="/get-a-report" className="underline">/get-a-report</Link>. Tell us the org / sector you want investigated and what decision the report will inform.</li>
          <li><span className="font-black text-bauhaus-blue mr-2">02</span>We do a 30-min triage to confirm scope and timing. For paid reports, you get a quote within 48 hours.</li>
          <li><span className="font-black text-bauhaus-blue mr-2">03</span>We pull every public source we can find &mdash; ABR, ACNC, Austender, audited annual reports (PDFs), state grant disclosures, board registers &mdash; and triangulate.</li>
          <li><span className="font-black text-bauhaus-blue mr-2">04</span>You get a live dashboard view + a long-form narrative report with sourced citations. Same template as the <Link href="/reports/multicultural-sector/fecca-eccv/long-read" className="underline">FECCA &amp; ECCV deep-dive</Link>.</li>
          <li><span className="font-black text-bauhaus-blue mr-2">05</span>1-hour briefing call to walk you through findings and answer questions.</li>
        </ol>
      </section>

      <section className="border-4 border-bauhaus-yellow p-8 bg-bauhaus-yellow mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-tight mb-3">Worked example</h2>
        <p className="text-bauhaus-black font-medium text-sm leading-relaxed mb-4 max-w-3xl">
          The <Link href="/reports/multicultural-sector/fecca-eccv/long-read" className="underline font-black">FECCA &amp; ECCV — The Federation&apos;s Money Map</Link> report is the standard On-Demand deliverable. ~12-minute read, 9 sections, every claim sourced. Combines audited financials, federal procurement, state grants, board interlocks, and ABR/ACNC registration data into a single sector-decision-ready narrative.
        </p>
        <Link href="/reports/multicultural-sector/fecca-eccv/long-read" className="inline-block px-4 py-3 text-xs font-black uppercase tracking-widest bg-bauhaus-black text-white border-2 border-bauhaus-black hover:bg-bauhaus-red">Read the full FECCA / ECCV report →</Link>
      </section>

      <section className="text-center mb-8">
        <p className="text-sm text-bauhaus-muted font-medium mb-2">Questions before you submit?</p>
        <a href="mailto:Benjamin@act.place" className="text-bauhaus-blue font-black text-sm hover:underline">Benjamin@act.place</a>
      </section>
    </div>
  );
}

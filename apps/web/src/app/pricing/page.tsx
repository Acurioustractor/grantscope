import Link from 'next/link';

export const metadata = {
  title: 'Pricing — CivicGraph',
  description: 'Investigative civic-sector reports + monitoring + sector subscriptions. Lead with the Snapshot or the full Sector Long-Read; scale to recurring intelligence.',
};

const tiers = [
  {
    name: 'Snapshot Diagnostic',
    price: '$1,500',
    sub: 'one-off · 5 day turnaround',
    tone: 'white',
    description: 'A focused 4-page diagnostic on one organisation. Audited financial trajectory, governance, funder concentration, three sourced findings. Decision-ready.',
    features: [
      'Live dashboard view of the org',
      '4-page narrative diagnostic with sourced citations',
      'Three findings ranked by materiality',
      '30-min briefing call',
    ],
    cta: { label: 'Order a Snapshot', href: '/get-a-report?budget=1500' },
  },
  {
    name: 'Sector Long-Read',
    price: '$3,500',
    sub: 'one-off · 7–10 day turnaround',
    tone: 'yellow',
    description: 'Full FECCA / ECCV-style investigative deep-dive on the organisation, peak body, sector, network, or funding stream of your choice. Cross-source triangulation, 9-section narrative, every claim sourced.',
    features: [
      'Live interactive dashboard + 12-min narrative report',
      'Cross-source triangulation (ABR · ACNC · Austender · audits)',
      'Director / network drill-downs scoped to the report',
      '"What this means for you" board-ready action items',
      'Citation list for every finding',
      '1-hour briefing call',
      'Private link or public publication, your choice',
    ],
    cta: { label: 'Order a Long-Read', href: '/get-a-report?budget=3500' },
    highlight: true,
  },
  {
    name: 'Sector Monitor',
    price: '$9,500',
    sub: 'per year · recurring',
    tone: 'white',
    description: 'For foundations, peak bodies, oversight agencies, and donor coalitions tracking a sector continuously. Long-form findings stay current; you get notified when something material moves.',
    features: [
      'One Sector Long-Read at year-start (worth $3,500)',
      'Quarterly auto-refresh of the live dashboard',
      'Email alerts when a tracked org has a material change (deficit, leadership, ACNC status, contract win/loss)',
      'Watchlist alerts on up to 50 organisations',
      'Direct analyst access (email + 1 quarterly call)',
      'API access to your watchlist data',
    ],
    cta: { label: 'Discuss a subscription', href: '/get-a-report?budget=9500' },
  },
  {
    name: 'Strategic Engagement',
    price: '$25K+',
    sub: 'per project · scoping required',
    tone: 'black',
    description: 'For royal commissions, state-government oversight, large foundations, and sector-mapping engagements. Bespoke scope, multi-org diligence packs, and integration with your internal systems.',
    features: [
      'Full sector or jurisdiction mapping',
      'Multi-organisation diligence packs (10–50 orgs)',
      'Custom data feeds + integration with your stack',
      'Direct access to the analyst team',
      'Scoped to your decision timeline',
      'White-label / branded delivery available',
    ],
    cta: { label: 'Scope an engagement', href: '/get-a-report?budget=25000' },
  },
];

const addOns = [
  { name: 'Branded delivery', price: '+$1,500', description: 'Your logo, your colours, your domain. Show stakeholders the report as a co-authored deliverable.' },
  { name: 'Public-facing publication', price: '+$500', description: 'Hosted on a public landing page with SEO-optimised social cards. Citation-ready for journalism.' },
  { name: 'Embed in your stack', price: '+$2,500', description: 'Iframe-embeddable charts and findings drop into your intranet, board portal, or Notion / Confluence.' },
  { name: 'Custom Q&A', price: '+$500/Q', description: 'Submit a follow-up question after delivery. We answer within 2 business days, sourced.' },
];

function Tier({ t }: { t: typeof tiers[number] }) {
  const bg = t.tone === 'yellow' ? 'bg-bauhaus-yellow' :
             t.tone === 'black' ? 'bg-bauhaus-black text-white' : 'bg-white';
  const txt = t.tone === 'black' ? 'text-white' : 'text-bauhaus-black';
  const border = t.highlight ? 'border-bauhaus-red border-8' : 'border-bauhaus-black border-4';
  const ctaCls = t.tone === 'black'
    ? 'inline-block px-4 py-3 text-xs font-black uppercase tracking-widest bg-bauhaus-yellow text-bauhaus-black hover:bg-bauhaus-canvas border-2 border-bauhaus-yellow'
    : 'inline-block px-4 py-3 text-xs font-black uppercase tracking-widest bg-bauhaus-black text-white hover:bg-bauhaus-red border-2 border-bauhaus-black';
  return (
    <div className={`${bg} ${txt} ${border} p-6 flex flex-col`}>
      {t.highlight && (
        <div className="text-[10px] font-black text-white uppercase tracking-widest mb-2 inline-block bg-bauhaus-red px-2 py-1 self-start">★ Most chosen</div>
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
        <p className="text-xl sm:text-2xl text-bauhaus-muted leading-tight font-medium max-w-3xl mb-3">
          Four tiers from one-off diagnostic through to royal-commission-grade engagements. Lead with what fits your decision; scale to what fits your sector.
        </p>
        <p className="text-sm text-bauhaus-black font-medium max-w-3xl">
          See the deliverable: <Link href="/share/fecca-eccv" className="font-black text-bauhaus-blue hover:underline">FECCA &amp; ECCV — The Federation&apos;s Money Map</Link> &mdash; this is a $3,500 Sector Long-Read.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        {tiers.map((t, i) => <Tier key={i} t={t} />)}
      </div>

      {/* Add-ons */}
      <section className="border-4 border-bauhaus-black p-8 bg-white mb-12">
        <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">Add-ons (any tier)</div>
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-5">Customise the deliverable</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {addOns.map((a, i) => (
            <div key={i} className="border-2 border-bauhaus-black p-4 bg-bauhaus-canvas">
              <div className="flex items-baseline justify-between mb-1">
                <div className="font-black text-bauhaus-black uppercase tracking-tight text-sm">{a.name}</div>
                <div className="text-xs font-mono text-bauhaus-red font-black">{a.price}</div>
              </div>
              <p className="text-xs text-bauhaus-muted font-medium leading-relaxed">{a.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-4 border-bauhaus-black p-8 bg-bauhaus-canvas mb-12">
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-4">How it works</h2>
        <ol className="space-y-3 text-bauhaus-black font-medium text-sm leading-relaxed">
          <li><span className="font-black text-bauhaus-blue mr-2">01</span>You submit at <Link href="/get-a-report" className="underline">/get-a-report</Link>. Tell us the org / sector / network and what decision the report will inform.</li>
          <li><span className="font-black text-bauhaus-blue mr-2">02</span>30-minute scoping call within 48 hours. Confirm questions, timeline, deliverable format. Quote sent same day.</li>
          <li><span className="font-black text-bauhaus-blue mr-2">03</span>We pull every public source — ABR, ACNC, Austender, audited annual reports, state grant disclosures, board registers — and triangulate.</li>
          <li><span className="font-black text-bauhaus-blue mr-2">04</span>Live dashboard view + narrative report with sourced citations delivered. Same template as the <Link href="/share/fecca-eccv" className="underline">FECCA &amp; ECCV deep-dive</Link>.</li>
          <li><span className="font-black text-bauhaus-blue mr-2">05</span>Briefing call to walk you through findings and surface follow-up questions.</li>
        </ol>
      </section>

      {/* First 5 Free — demoted */}
      <section className="border-4 border-bauhaus-yellow p-6 bg-bauhaus-yellow mb-12">
        <div className="flex flex-wrap items-baseline gap-3 mb-3">
          <h2 className="text-lg font-black text-bauhaus-black uppercase tracking-tight">★ First 5 Reports Free — Launch Campaign</h2>
          <span className="text-xs font-mono text-bauhaus-black font-black">limited</span>
        </div>
        <p className="text-bauhaus-black font-medium text-sm leading-relaxed mb-4 max-w-3xl">
          The next 5 Sector Long-Reads are free for organisations willing to be a public case study. Selection criteria: orgs whose data produces clear findings; willingness to be featured publicly with full report visibility; commitment to a 30-minute interview after delivery on what was useful and what wasn&apos;t.
        </p>
        <Link href="/get-a-report?free=true&src=pricing-campaign" className="inline-block px-4 py-3 text-xs font-black uppercase tracking-widest bg-bauhaus-black text-white border-2 border-bauhaus-black hover:bg-bauhaus-red">Apply for the campaign →</Link>
      </section>

      <section className="text-center mb-8">
        <p className="text-sm text-bauhaus-muted font-medium mb-2">Questions before you submit?</p>
        <a href="mailto:Benjamin@act.place" className="text-bauhaus-blue font-black text-sm hover:underline">Benjamin@act.place</a>
      </section>
    </div>
  );
}

import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function getStats() {
  try {
    const supabase = getServiceSupabase();
    const [
      { count: charityCount },
      { count: asicCount },
      { count: austenderCount },
      { count: atoCount },
      { count: oricCount },
      { count: foundationCount },
      { count: grantCount },
      { count: donationCount },
      { count: seifaCount },
      { count: postcodeCount },
    ] = await Promise.all([
      supabase.from('acnc_charities').select('*', { count: 'exact', head: true }),
      supabase.from('asic_companies').select('*', { count: 'exact', head: true }),
      supabase.from('austender_contracts').select('*', { count: 'exact', head: true }),
      supabase.from('ato_tax_transparency').select('*', { count: 'exact', head: true }),
      supabase.from('oric_corporations').select('*', { count: 'exact', head: true }),
      supabase.from('foundations').select('*', { count: 'exact', head: true }),
      supabase.from('grants').select('*', { count: 'exact', head: true }),
      supabase.from('political_donations').select('*', { count: 'exact', head: true }),
      supabase.from('seifa_2021').select('*', { count: 'exact', head: true }),
      supabase.from('postcode_geo').select('*', { count: 'exact', head: true }),
    ]);
    return {
      charityCount: charityCount || 0,
      asicCount: asicCount || 0,
      austenderCount: austenderCount || 0,
      atoCount: atoCount || 0,
      oricCount: oricCount || 0,
      foundationCount: foundationCount || 0,
      grantCount: grantCount || 0,
      donationCount: donationCount || 0,
      seifaCount: seifaCount || 0,
      postcodeCount: postcodeCount || 0,
    };
  } catch {
    return { charityCount: 0, asicCount: 0, austenderCount: 0, atoCount: 0, oricCount: 0, foundationCount: 0, grantCount: 0, donationCount: 0, seifaCount: 0, postcodeCount: 0 };
  }
}

function fmt(n: number) { return n.toLocaleString(); }

export default async function PowerMapPage() {
  const s = await getStats();

  return (
    <div>
      <div className="mb-8">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
        <div className="text-xs font-black text-bauhaus-black mt-4 mb-1 uppercase tracking-widest">Deep Research</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Australia&apos;s Power Map
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          How open data can reshape who holds power. A comprehensive analysis of economic concentration,
          government spending, and the case for radical transparency.
        </p>
      </div>

      {/* Executive Summary */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-bauhaus-black text-white">
          <h2 className="text-lg font-black mb-4 text-bauhaus-yellow uppercase tracking-widest">Executive Summary</h2>
          <p className="text-white/90 leading-relaxed mb-4">
            Australia is one of the most economically concentrated democracies in the developed world.
            The revenue of the ASX top 100 companies grew from 27% of GDP in 1993 to 47% by 2015.
            Two supermarket chains control 65% of grocery spending. The top 10 federal procuring entities
            account for 87.5% of $99.6 billion in annual government contracts.
          </p>
          <p className="text-white/90 leading-relaxed">
            Yet despite this extraordinary concentration, no public tool exists that allows ordinary
            Australians to trace how money moves through the economy. The raw materials already exist —
            ABN Bulk Extract (10M+ entities), AusTender (450,000+ contracts), ATO tax transparency
            (4,110+ corporations), ASIC (3M+ companies), ACNC (64,000+ charities). What is missing is
            the connective tissue.
          </p>
        </div>
      </section>

      {/* Concentration Stats */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-6 uppercase tracking-widest">The Concentration of Power</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          <div className="border-4 border-bauhaus-black p-6 bg-white">
            <h3 className="font-black text-bauhaus-black text-sm uppercase tracking-widest mb-4">Corporate Market Dominance</h3>
            <ul className="space-y-3 text-sm text-bauhaus-muted">
              <li><span className="font-black text-bauhaus-black">Supermarkets:</span> Woolworths + Coles = 65% market share (UK top two: 43%, US top four: 34%)</li>
              <li><span className="font-black text-bauhaus-black">Banking:</span> Big Four banks dominate retail banking, mortgages, wealth management</li>
              <li><span className="font-black text-bauhaus-black">Mining:</span> BHP, Rio Tinto, Fortescue dominate iron ore; Woodside + Santos dominate LNG</li>
              <li><span className="font-black text-bauhaus-black">Impact:</span> 25% increase in concentration → 1% fall in productivity (ACCC)</li>
            </ul>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <h3 className="font-black text-bauhaus-black text-sm uppercase tracking-widest mb-4">Where Government Money Flows</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-bauhaus-muted">Total federal procurement (2023-24)</span>
                <span className="font-black text-bauhaus-black">$99.6B</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-bauhaus-muted">Share held by top 10 entities</span>
                <span className="font-black text-bauhaus-red">87.5%</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-bauhaus-muted">Contracts to SMEs (by number)</span>
                <span className="font-black text-bauhaus-black">52%</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-bauhaus-muted">Contracts to SMEs (by value)</span>
                <span className="font-black text-bauhaus-red">35%</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-bauhaus-muted">Consulting firm spend (2024-25)</span>
                <span className="font-black text-bauhaus-black">~$1B</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Open Data That Exists */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-6 uppercase tracking-widest">The Open Data That Already Exists</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Every major dataset is free, publicly licensed (CC-BY 3.0), and updated regularly.
          The critical connector is the Australian Business Number (ABN).
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Dataset</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Records</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Update</th>
                <th className="text-center p-3 font-black uppercase tracking-widest text-xs">Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'ACNC Charities', records: fmt(s.charityCount), update: 'Bulk CSV', live: true },
                { name: 'ASIC Companies', records: fmt(s.asicCount), update: 'Weekly CSV', live: s.asicCount > 0 },
                { name: 'AusTender Contracts', records: fmt(s.austenderCount), update: 'OCDS API', live: s.austenderCount > 0 },
                { name: 'ATO Tax Transparency', records: fmt(s.atoCount), update: 'Annual XLSX', live: s.atoCount > 0 },
                { name: 'ORIC Indigenous Corps', records: fmt(s.oricCount), update: 'Periodic CSV', live: s.oricCount > 0 },
                { name: 'Foundations', records: fmt(s.foundationCount), update: 'AI-enriched', live: true },
                { name: 'Grants', records: fmt(s.grantCount), update: 'Daily scrape', live: true },
                { name: 'Political Donations', records: fmt(s.donationCount), update: 'Annual ZIP', live: s.donationCount > 0 },
                { name: 'SEIFA Disadvantage', records: fmt(s.seifaCount), update: 'Census 2021', live: s.seifaCount > 0 },
                { name: 'Postcode Centroids', records: fmt(s.postcodeCount), update: 'Community CSV', live: s.postcodeCount > 0 },
                { name: 'ABN Bulk Extract', records: '10M+', update: 'Weekly XML', live: false },
              ].map((d, i) => (
                <tr key={d.name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-3 font-bold text-bauhaus-black">{d.name}</td>
                  <td className="p-3 text-right font-mono">{d.records}</td>
                  <td className="p-3 text-bauhaus-muted">{d.update}</td>
                  <td className="p-3 text-center">
                    <span className={`text-xs font-black uppercase tracking-widest ${d.live ? 'text-green-600' : 'text-bauhaus-muted'}`}>
                      {d.live ? '● Live' : '○ Planned'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* International Precedents */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-6 uppercase tracking-widest">International Precedents</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          <div className="border-4 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-blue mb-2 uppercase tracking-widest">United Kingdom</div>
            <h3 className="font-black text-bauhaus-black mb-2">360Giving</h3>
            <p className="text-sm text-bauhaus-muted mb-3">1.25 million grants. GBP 300 billion. 320 publishers. The gold standard for grants transparency.</p>
            <p className="text-sm text-bauhaus-muted"><span className="font-black text-bauhaus-black">Australia has no equivalent.</span></p>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-red mb-2 uppercase tracking-widest">United States</div>
            <h3 className="font-black text-bauhaus-black mb-2">ProPublica + USAspending</h3>
            <p className="text-sm text-bauhaus-muted mb-3">100,000+ nonprofits searchable via API. All federal spending traceable from appropriation to expenditure.</p>
            <p className="text-sm text-bauhaus-muted"><span className="font-black text-bauhaus-black">Australia has no equivalent.</span></p>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-yellow mb-2 uppercase tracking-widest">The Gap</div>
            <h3 className="font-black text-bauhaus-black mb-2">What We&apos;re Building</h3>
            <p className="text-sm text-bauhaus-muted mb-3">Australia&apos;s first open platform connecting entities, contracts, grants, tax data, and (soon) beneficial ownership.</p>
            <p className="text-sm text-bauhaus-muted"><span className="font-black text-bauhaus-red">We are the equivalent.</span></p>
          </div>
        </div>
      </section>

      {/* Why Now */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-bauhaus-red text-white">
          <h2 className="text-lg font-black mb-4 text-bauhaus-yellow uppercase tracking-widest">Why Australia, Why Now</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-black text-white mb-2">The Beneficial Ownership Window</h3>
              <p className="text-white/90 text-sm leading-relaxed">
                Parliament passed the beneficial ownership register in Nov 2025, implementing ~2027.
                The platform that builds entity registry + procurement + grants mapping NOW will be
                positioned to integrate ownership data the moment it becomes available.
              </p>
            </div>
            <div>
              <h3 className="font-black text-white mb-2">Policy Momentum</h3>
              <ul className="text-white/90 text-sm space-y-1">
                <li>→ Social procurement frameworks expanding across all states</li>
                <li>→ National social enterprise strategy requiring data infrastructure</li>
                <li>→ ACCC merger reform driving demand for concentration data</li>
                <li>→ Post-PwC scandal demands for consulting contract transparency</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="mb-8">
        <div className="border-4 border-bauhaus-black p-8 bg-white text-center">
          <blockquote className="text-xl font-black text-bauhaus-black leading-relaxed max-w-2xl mx-auto mb-4">
            &ldquo;The data already exists. The connections don&apos;t. We&apos;re building the connections.&rdquo;
          </blockquote>
          <p className="text-sm text-bauhaus-muted">
            <a href="/reports/state-of-the-nation" className="text-bauhaus-blue font-black hover:underline">
              View live data →
            </a>{' '}
            or{' '}
            <a href="/how-it-works" className="text-bauhaus-blue font-black hover:underline">
              learn how it works →
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}

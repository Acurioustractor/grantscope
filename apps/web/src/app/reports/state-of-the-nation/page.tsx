import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function getStats() {
  try {
    const supabase = getServiceSupabase();

    const [
      { count: charityCount },
      { count: foundationCount },
      { count: grantCount },
      { count: oricCount },
      { count: oricActiveCount },
      { count: programCount },
      { count: austenderCount },
      { count: asicCount },
      { count: atoCount },
      { count: asxCount },
      { count: oricAcncMatch },
      { count: sourceCount },
    ] = await Promise.all([
      supabase.from('acnc_charities').select('*', { count: 'exact', head: true }),
      supabase.from('foundations').select('*', { count: 'exact', head: true }),
      supabase.from('grants').select('*', { count: 'exact', head: true }),
      supabase.from('oric_corporations').select('*', { count: 'exact', head: true }),
      supabase.from('oric_corporations').select('*', { count: 'exact', head: true }).eq('status', 'Registered'),
      supabase.from('foundation_programs').select('*', { count: 'exact', head: true }).in('status', ['open', 'closed']),
      supabase.from('austender_contracts').select('*', { count: 'exact', head: true }),
      supabase.from('asic_companies').select('*', { count: 'exact', head: true }),
      supabase.from('ato_tax_transparency').select('*', { count: 'exact', head: true }),
      supabase.from('asx_companies').select('*', { count: 'exact', head: true }),
      supabase.from('oric_corporations').select('*', { count: 'exact', head: true }).eq('acnc_match', true),
      supabase.from('grant_sources').select('*', { count: 'exact', head: true }),
    ]);

    // ORIC state breakdown
    const { data: oricByState } = await supabase
      .from('oric_corporations')
      .select('state')
      .eq('status', 'Registered');

    const stateCounts: Record<string, number> = {};
    for (const r of oricByState || []) {
      const s = r.state || 'Unknown';
      stateCounts[s] = (stateCounts[s] || 0) + 1;
    }

    // ATO top entities
    const { data: atoTop } = await supabase
      .from('ato_tax_transparency')
      .select('entity_name, abn, total_income, tax_payable, effective_tax_rate, report_year')
      .order('total_income', { ascending: false })
      .limit(10);

    return {
      charityCount: charityCount || 0,
      foundationCount: foundationCount || 0,
      grantCount: grantCount || 0,
      oricCount: oricCount || 0,
      oricActiveCount: oricActiveCount || 0,
      programCount: programCount || 0,
      austenderCount: austenderCount || 0,
      asicCount: asicCount || 0,
      atoCount: atoCount || 0,
      asxCount: asxCount || 0,
      oricAcncMatch: oricAcncMatch || 0,
      sourceCount: sourceCount || 0,
      oricByState: Object.entries(stateCounts).sort((a, b) => b[1] - a[1]),
      atoTop: atoTop || [],
    };
  } catch {
    return {
      charityCount: 0, foundationCount: 0, grantCount: 0, oricCount: 0,
      oricActiveCount: 0, programCount: 0, austenderCount: 0, asicCount: 0,
      atoCount: 0, asxCount: 0, oricAcncMatch: 0, sourceCount: 0,
      oricByState: [], atoTop: [],
    };
  }
}

function fmt(n: number) { return n.toLocaleString(); }
function fmtDollar(n: number | null) {
  if (!n) return '$0';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

export default async function StateOfTheNationPage() {
  const s = await getStats();

  return (
    <div>
      <div className="mb-8">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
        <div className="text-xs font-black text-bauhaus-red mt-4 mb-1 uppercase tracking-widest">Live Report</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          The State of Business, Power and Money in Australia
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          Every number on this page is live — pulled from our database right now.
          {fmt(s.charityCount)} charities. {fmt(s.asicCount)} companies. {fmt(s.oricCount)} Indigenous corporations.
          {fmt(s.austenderCount)} government contracts. {fmt(s.atoCount)} tax transparency records. Connected by ABN.
        </p>
      </div>

      {/* Why This Exists */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-bauhaus-black text-white mb-0">
          <h2 className="text-xl font-black mb-4 text-bauhaus-yellow uppercase tracking-widest">Why This Exists</h2>
          <p className="text-white/90 leading-relaxed mb-4">
            Australia is one of the most economically concentrated democracies in the developed world.
            The ASX top 100 commands 47% of GDP. Two supermarket chains control 65% of grocery spending.
            Yet no public tool exists that lets ordinary Australians trace how money moves through the economy.
          </p>
          <p className="text-white/90 leading-relaxed">
            The data to build that tool already exists. It sits in government databases, published under open licences,
            updated weekly. What doesn&apos;t exist — and what has never existed — is the connective tissue.
            <span className="text-bauhaus-yellow font-black"> CivicGraph is building that connective tissue.</span>
          </p>
        </div>
      </section>

      {/* Live Data Grid */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-6 uppercase tracking-widest">What We&apos;ve Mapped — Live</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-0">
          {[
            { label: 'Charities (ACNC)', value: fmt(s.charityCount), color: 'bg-bauhaus-red' },
            { label: 'Companies (ASIC)', value: fmt(s.asicCount), color: 'bg-bauhaus-blue' },
            { label: 'Foundations', value: fmt(s.foundationCount), color: 'bg-bauhaus-yellow' },
            { label: 'Grant Opportunities', value: fmt(s.grantCount), color: 'bg-bauhaus-black' },
            { label: 'Indigenous Corps (ORIC)', value: fmt(s.oricCount), color: 'bg-bauhaus-red' },
            { label: 'ORIC Active', value: fmt(s.oricActiveCount), color: 'bg-bauhaus-blue' },
            { label: 'Foundation Programs', value: fmt(s.programCount), color: 'bg-bauhaus-yellow' },
            { label: 'Govt Contracts', value: fmt(s.austenderCount), color: 'bg-bauhaus-black' },
            { label: 'Tax Transparency', value: fmt(s.atoCount), color: 'bg-bauhaus-red' },
            { label: 'ASX Listed', value: fmt(s.asxCount), color: 'bg-bauhaus-blue' },
            { label: 'ORIC-ACNC Linked', value: fmt(s.oricAcncMatch), color: 'bg-bauhaus-yellow' },
            { label: 'Data Sources', value: fmt(s.sourceCount), color: 'bg-bauhaus-black' },
          ].map((stat) => (
            <div key={stat.label} className="border-4 border-bauhaus-black p-5 -mt-1 -ml-1 first:mt-0 first:ml-0 bg-white">
              <div className={`w-3 h-3 ${stat.color} border border-bauhaus-black mb-2`} />
              <div className="text-2xl font-black text-bauhaus-black">{stat.value}</div>
              <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Indigenous Corporations by State */}
      {s.oricByState.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">Indigenous Self-Governance Infrastructure</h2>
          <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
            {fmt(s.oricActiveCount)} active ORIC-registered corporations operate across every state and territory —
            {' '}{fmt(s.oricAcncMatch)} also registered as ACNC charities. They are the backbone of Indigenous self-determination.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-0">
            {s.oricByState.map(([state, count]) => (
              <div key={state} className="border-4 border-bauhaus-black p-4 -mt-1 -ml-1 bg-white">
                <div className="text-xl font-black text-bauhaus-black">{fmt(count)}</div>
                <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest">{state}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tax Transparency */}
      {s.atoTop.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">Who Pays Tax (And Who Doesn&apos;t)</h2>
          <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
            The ATO publishes tax transparency data for {fmt(s.atoCount)} entity-years — corporations earning $100M+ annually.
            Cross-referenced with procurement: how much government money flows to companies that pay no tax?
          </p>
          <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Entity</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Total Income</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Tax Payable</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Eff. Rate</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Year</th>
                </tr>
              </thead>
              <tbody>
                {s.atoTop.map((entity, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 font-bold text-bauhaus-black">{entity.entity_name}</td>
                    <td className="p-3 text-right font-mono">{fmtDollar(entity.total_income)}</td>
                    <td className="p-3 text-right font-mono">{fmtDollar(entity.tax_payable)}</td>
                    <td className="p-3 text-right font-mono">
                      <span className={Number(entity.effective_tax_rate) < 10 ? 'text-bauhaus-red font-black' : ''}>
                        {entity.effective_tax_rate != null ? `${entity.effective_tax_rate}%` : '—'}
                      </span>
                    </td>
                    <td className="p-3 text-right text-bauhaus-muted">{entity.report_year}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* The Five Layers */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-6 uppercase tracking-widest">The Five Layers</h2>
        <div className="space-y-0">
          {[
            { layer: '1', title: 'Entity Registry', desc: 'Every registered entity — business, charity, Indigenous corporation, trust. Connected by ABN.', status: `${fmt(s.charityCount + s.asicCount + s.oricCount)} entities`, color: 'bg-bauhaus-red', live: true },
            { layer: '2', title: 'Government Procurement', desc: 'Federal contracts from AusTender. Who wins government money, and how much.', status: `${fmt(s.austenderCount)} contracts`, color: 'bg-bauhaus-blue', live: s.austenderCount > 0 },
            { layer: '3', title: 'Tax Transparency', desc: 'ATO data for corporations earning $100M+. Who pays tax and who doesn\'t.', status: `${fmt(s.atoCount)} records`, color: 'bg-bauhaus-yellow', live: s.atoCount > 0 },
            { layer: '4', title: 'Grants & Philanthropy', desc: 'Government grants and philanthropic foundations. Where funding flows.', status: `${fmt(s.grantCount)} grants, ${fmt(s.foundationCount)} foundations`, color: 'bg-bauhaus-red', live: true },
            { layer: '5', title: 'Beneficial Ownership', desc: 'Parliament passed the register legislation in Nov 2025. When it goes live, we integrate it.', status: 'Coming ~2027', color: 'bg-bauhaus-black', live: false },
          ].map((l) => (
            <div key={l.layer} className="border-4 border-bauhaus-black p-6 -mt-1 bg-white flex items-start gap-4">
              <div className={`w-10 h-10 ${l.color} border-3 border-bauhaus-black flex items-center justify-center shrink-0 ${l.color === 'bg-bauhaus-yellow' || l.color === 'bg-bauhaus-black' ? '' : ''}`}>
                <span className={`font-black text-lg ${l.color === 'bg-bauhaus-yellow' ? 'text-bauhaus-black' : 'text-white'}`}>{l.layer}</span>
              </div>
              <div>
                <h3 className="font-black text-bauhaus-black text-sm uppercase tracking-widest">{l.title}</h3>
                <p className="text-sm text-bauhaus-muted mt-1">{l.desc}</p>
                <div className={`text-xs font-black mt-2 uppercase tracking-widest ${l.live ? 'text-green-600' : 'text-bauhaus-muted'}`}>
                  {l.live ? '● ' : '○ '}{l.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Questions That Become Answerable */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-bauhaus-blue text-white">
          <h2 className="text-xl font-black mb-4 text-bauhaus-yellow uppercase tracking-widest">Questions That Become Answerable</h2>
          <ul className="space-y-3 text-white/90">
            <li className="flex items-start gap-2"><span className="text-bauhaus-yellow font-black">→</span> Show every dollar that flowed from BHP → BHP Foundation → grants → which communities</li>
            <li className="flex items-start gap-2"><span className="text-bauhaus-yellow font-black">→</span> What % of federal procurement goes to Indigenous-owned businesses?</li>
            <li className="flex items-start gap-2"><span className="text-bauhaus-yellow font-black">→</span> Which suburbs receive the most government spending per capita? Which receive the least?</li>
            <li className="flex items-start gap-2"><span className="text-bauhaus-yellow font-black">→</span> How has Big 4 consulting spend changed over 10 years vs community organisation funding?</li>
            <li className="flex items-start gap-2"><span className="text-bauhaus-yellow font-black">→</span> Which organisations receive both government grants AND procurement contracts?</li>
            <li className="flex items-start gap-2"><span className="text-bauhaus-yellow font-black">→</span> What is the geographic distribution of philanthropic funding relative to disadvantage?</li>
          </ul>
        </div>
      </section>

      {/* The Thesis */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-white">
          <h2 className="text-xl font-black text-bauhaus-black mb-4 uppercase tracking-widest">The Thesis</h2>
          <blockquote className="text-lg font-medium text-bauhaus-black leading-relaxed border-l-4 border-bauhaus-red pl-6">
            Making money flows transparent is not a technical project. It is a redistribution of informational power.
          </blockquote>
          <p className="text-bauhaus-muted mt-4 leading-relaxed">
            Currently, detailed knowledge of how money moves through Australia is asymmetric.
            Large corporations, consulting firms, and lobbyists understand the procurement landscape.
            Community organisations, small businesses, journalists, and ordinary citizens do not.
          </p>
          <p className="text-bauhaus-muted mt-3 leading-relaxed">
            An open, queryable platform that connects entity registrations to government contracts to grants
            to tax data inverts this dynamic. The data already exists. The connections don&apos;t.
            We&apos;re building the connections.
          </p>
        </div>
      </section>

      {/* Data Snapshot */}
      <section className="mb-8">
        <div className="border-4 border-bauhaus-black p-6 bg-gray-50 font-mono text-sm">
          <div className="font-black text-bauhaus-black mb-3 uppercase tracking-widest text-xs not-italic font-sans">Live Data Snapshot</div>
          <pre className="text-bauhaus-black whitespace-pre-wrap">{`ENTITIES MAPPED
├── Charities (ACNC)           ${fmt(s.charityCount).padStart(10)}
├── Companies (ASIC)           ${fmt(s.asicCount).padStart(10)}
├── Foundations                ${fmt(s.foundationCount).padStart(10)}
├── Indigenous Corps (ORIC)    ${fmt(s.oricCount).padStart(10)}  (${fmt(s.oricActiveCount)} active)
├── ASX Listed                 ${fmt(s.asxCount).padStart(10)}
├── Grant Opportunities        ${fmt(s.grantCount).padStart(10)}  (${fmt(s.sourceCount)} sources)
├── Govt Contracts             ${fmt(s.austenderCount).padStart(10)}
└── Tax Transparency           ${fmt(s.atoCount).padStart(10)}

CROSS-REFERENCES
├── ORIC ↔ ACNC matched        ${fmt(s.oricAcncMatch).padStart(10)}
└── Foundation Programs         ${fmt(s.programCount).padStart(10)}`}</pre>
        </div>
      </section>

      <div className="text-center text-sm text-bauhaus-muted font-medium py-8 border-t-4 border-bauhaus-black">
        CivicGraph — civicgraph.au — Making the invisible visible.
      </div>
    </div>
  );
}

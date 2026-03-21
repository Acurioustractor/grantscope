import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';
import { safe } from '@/lib/services/utils';

export const revalidate = 3600;

type Row = Record<string, unknown>;

function fmt(n: number) { return n.toLocaleString('en-AU'); }
function money(n: number) { return n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${(n / 1e3).toFixed(0)}K`; }
function pct(n: number | null) { return n == null ? '—' : `${Math.round(n)}%`; }

async function getData() {
  const supabase = getServiceSupabase();
  const q = (query: string) => safe(supabase.rpc('exec_sql', { query })) as Promise<Row[] | null>;

  const [
    thinMarketSummary,
    qldThinMarkets,
    firstNationsNational,
    qldFirstNations,
    utilisationByState,
    crossSystemStats,
    topDeserts,
    nationalStats,
  ] = await Promise.all([
    // Thin market status breakdown (national)
    q(`SELECT thin_market_status, COUNT(*) as lgas, SUM(ndis_participants)::bigint as participants,
        SUM(disability_entities)::bigint as providers, ROUND(AVG(NULLIF(desert_score,0)),1) as avg_desert
      FROM mv_disability_landscape GROUP BY thin_market_status
      ORDER BY CASE thin_market_status WHEN 'CRITICAL' THEN 1 WHEN 'SEVERE' THEN 2 WHEN 'MODERATE' THEN 3 WHEN 'ADEQUATE' THEN 4 ELSE 5 END`),

    // QLD thin markets detail
    q(`SELECT lga_name, remoteness, ndis_participants, disability_entities, participants_per_provider,
        thin_market_status, desert_score, fn_ndis_participants, cross_system_justice
      FROM mv_disability_landscape WHERE state = 'QLD' AND ndis_participants > 0
      ORDER BY desert_score DESC NULLS LAST LIMIT 20`),

    // First Nations national summary
    q(`SELECT state, SUM(participant_count) FILTER (WHERE remoteness = 'All') as total,
        SUM(participant_count) FILTER (WHERE remoteness = 'Very Remote') as very_remote,
        AVG(avg_annualised_support) FILTER (WHERE remoteness = 'All') as avg_budget,
        AVG(avg_annualised_support) FILTER (WHERE remoteness = 'Very Remote') as vr_budget
      FROM ndis_first_nations WHERE quarter_date = (SELECT MAX(quarter_date) FROM ndis_first_nations)
      GROUP BY state ORDER BY total DESC NULLS LAST`),

    // QLD First Nations by remoteness
    q(`SELECT remoteness, participant_count, avg_annualised_support
      FROM ndis_first_nations WHERE state = 'QLD'
        AND quarter_date = (SELECT MAX(quarter_date) FROM ndis_first_nations)
        AND remoteness != 'All' ORDER BY remoteness`),

    // Utilisation by state
    q(`SELECT state, ROUND(AVG(utilisation_rate)::numeric, 1) as avg_util,
        ROUND(MIN(utilisation_rate)::numeric, 1) as min_util,
        ROUND(MAX(utilisation_rate)::numeric, 1) as max_util
      FROM ndis_utilisation WHERE quarter_date = (SELECT MAX(quarter_date) FROM ndis_utilisation)
        AND disability_type = 'ALL' AND age_group = 'ALL' AND support_class = 'ALL'
        AND service_district != 'ALL' AND state != 'ALL'
      GROUP BY state ORDER BY avg_util ASC`),

    // Cross-system NDIS entities
    q(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE in_ndis_provider = 1) as ndis,
        COUNT(*) FILTER (WHERE in_ndis_provider = 1 AND system_count >= 2) as multi,
        COUNT(*) FILTER (WHERE in_ndis_provider = 1 AND in_justice_funding = 1) as justice,
        COUNT(*) FILTER (WHERE in_ndis_provider = 1 AND in_procurement = 1) as procurement,
        COUNT(*) FILTER (WHERE in_ndis_provider = 1 AND in_alma_evidence = 1) as alma,
        COUNT(*) FILTER (WHERE in_ndis_provider = 1 AND is_community_controlled) as community,
        MAX(system_count) as max_systems
      FROM mv_entity_power_index`),

    // Top disability deserts (all states)
    q(`SELECT lga_name, state, remoteness, ndis_participants, disability_entities,
        thin_market_status, desert_score, fn_ndis_participants
      FROM mv_disability_landscape WHERE ndis_participants > 100 AND thin_market_status IN ('CRITICAL', 'SEVERE')
      ORDER BY desert_score DESC NULLS LAST LIMIT 15`),

    // National NDIS totals
    q(`SELECT SUM(ndis_participants)::bigint as total_participants,
        COUNT(*) FILTER (WHERE thin_market_status = 'CRITICAL') as critical_lgas,
        COUNT(*) FILTER (WHERE thin_market_status = 'SEVERE') as severe_lgas,
        SUM(disability_entities)::bigint as total_providers,
        COUNT(DISTINCT state) as states
      FROM mv_disability_landscape`),
  ]);

  return {
    thinMarketSummary: (thinMarketSummary || []) as Row[],
    qldThinMarkets: (qldThinMarkets || []) as Row[],
    firstNationsNational: (firstNationsNational || []) as Row[],
    qldFirstNations: (qldFirstNations || []) as Row[],
    utilisationByState: (utilisationByState || []) as Row[],
    crossSystem: ((crossSystemStats || []) as Row[])[0] || {},
    topDeserts: (topDeserts || []) as Row[],
    national: ((nationalStats || []) as Row[])[0] || {},
  };
}

export default async function DisabilityReportPage() {
  const data = await getData();
  const cs = data.crossSystem;
  const nat = data.national;

  return (
    <div>
      <div className="mb-8">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
        <div className="text-xs font-black text-bauhaus-red mt-4 mb-1 uppercase tracking-widest">Cross-System Intelligence</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">Disability Market Transparency</h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          Australia&apos;s NDIS serves {fmt(Number(nat.total_participants) || 0)} participants, but where are the thin markets
          where plans can&apos;t be used, which communities have no providers, and how does disability funding
          connect to justice, procurement, and community-controlled organisations?
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
          <Link href="/reports/ndis-market" className="px-3 py-2 border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors">
            NDIS Market Report
          </Link>
          <Link href="/graph?mode=justice&topic=ndis" className="px-3 py-2 border-2 border-bauhaus-blue text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white transition-colors">
            Graph View
          </Link>
          <Link href="/reports/youth-justice" className="px-3 py-2 border-2 border-bauhaus-black/20 text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black transition-colors">
            Compare Youth Justice
          </Link>
        </div>
      </div>

      {/* Hero Stats */}
      <section className="mb-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
          <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-black text-white">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">NDIS Participants</div>
            <div className="text-3xl font-black">{fmt(Number(nat.total_participants) || 0)}</div>
            <div className="text-white/60 text-xs font-bold mt-2">Dec 2025 quarter</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-bauhaus-red text-white">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Critical Thin Markets</div>
            <div className="text-3xl font-black">{fmt(Number(nat.critical_lgas) || 0)}</div>
            <div className="text-white/70 text-xs font-bold mt-2">LGAs with participants, zero providers</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">Mapped Providers</div>
            <div className="text-3xl font-black">{fmt(Number(cs.ndis) || 0)}</div>
            <div className="text-bauhaus-muted text-xs font-bold mt-2">linked across {Number(cs.max_systems) || 0} government systems</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-bauhaus-blue text-white">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Cross-System</div>
            <div className="text-3xl font-black">{fmt(Number(cs.multi) || 0)}</div>
            <div className="text-white/70 text-xs font-bold mt-2">NDIS providers in 2+ government systems</div>
          </div>
        </div>
      </section>

      {/* Thin Market Breakdown */}
      <section className="mb-10 grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-red text-white border-b-4 border-bauhaus-black p-5">
            <p className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Thin Market Analysis</p>
            <h2 className="text-2xl font-black">Where NDIS participants have no providers</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Status</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">LGAs</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Participants</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Providers</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Desert Score</th>
                </tr>
              </thead>
              <tbody>
                {data.thinMarketSummary.map((row, i) => (
                  <tr key={String(row.thin_market_status)} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 font-bold">
                      <span className={`inline-block px-2 py-1 text-xs font-black uppercase tracking-widest ${
                        row.thin_market_status === 'CRITICAL' ? 'bg-bauhaus-red text-white' :
                        row.thin_market_status === 'SEVERE' ? 'bg-orange-500 text-white' :
                        row.thin_market_status === 'MODERATE' ? 'bg-bauhaus-yellow text-bauhaus-black' :
                        row.thin_market_status === 'ADEQUATE' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-500'
                      }`}>{String(row.thin_market_status)}</span>
                    </td>
                    <td className="p-3 text-right font-mono">{fmt(Number(row.lgas))}</td>
                    <td className="p-3 text-right font-mono">{fmt(Number(row.participants))}</td>
                    <td className="p-3 text-right font-mono">{fmt(Number(row.providers))}</td>
                    <td className="p-3 text-right font-mono font-black">{row.avg_desert ? Number(row.avg_desert).toFixed(0) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-4 border-bauhaus-black bg-white p-5">
          <p className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-3">Cross-System Overlap</p>
          <h3 className="text-xl font-black text-bauhaus-black mb-4">NDIS providers in other systems</h3>
          <div className="space-y-3">
            {[
              { label: 'Also in justice funding', value: Number(cs.justice), color: 'bauhaus-red' },
              { label: 'Also in procurement', value: Number(cs.procurement), color: 'bauhaus-blue' },
              { label: 'Community-controlled', value: Number(cs.community), color: 'bauhaus-black' },
              { label: 'ALMA evidence-backed', value: Number(cs.alma), color: 'green-700' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between border-b border-bauhaus-black/10 pb-2">
                <span className="text-sm font-medium text-bauhaus-black/80">{item.label}</span>
                <span className={`text-lg font-black text-${item.color}`}>{fmt(item.value || 0)}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-bauhaus-muted font-medium">
            These are NDIS registered providers who also appear in federal procurement,
            justice funding, or ALMA evidence databases — revealing how disability services
            connect to broader government spending.
          </p>
        </div>
      </section>

      {/* Top Disability Deserts */}
      <section className="mb-10">
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-black text-white border-b-4 border-bauhaus-black p-5">
            <p className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Disability Deserts</p>
            <h2 className="text-2xl font-black">LGAs with 100+ participants but critical/severe provider gaps</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-canvas">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">LGA</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">State</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Remoteness</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Participants</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Providers</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Status</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Desert</th>
                </tr>
              </thead>
              <tbody>
                {data.topDeserts.map((row, i) => (
                  <tr key={`${row.lga_name}-${row.state}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 font-bold text-bauhaus-black">{String(row.lga_name)}</td>
                    <td className="p-3 font-mono text-bauhaus-muted">{String(row.state)}</td>
                    <td className="p-3 text-xs font-medium text-bauhaus-muted">{String(row.remoteness || '').replace(' Australia', '')}</td>
                    <td className="p-3 text-right font-mono">{fmt(Number(row.ndis_participants))}</td>
                    <td className="p-3 text-right font-mono font-black text-bauhaus-red">{fmt(Number(row.disability_entities))}</td>
                    <td className="p-3 text-right">
                      <span className={`text-xs font-black uppercase ${row.thin_market_status === 'CRITICAL' ? 'text-bauhaus-red' : 'text-orange-500'}`}>
                        {String(row.thin_market_status)}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-black">{row.desert_score ? Number(row.desert_score).toFixed(0) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* First Nations + Utilisation */}
      <section className="mb-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* First Nations */}
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-blue text-white border-b-4 border-bauhaus-black p-5">
            <p className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">First Nations</p>
            <h2 className="text-2xl font-black">NDIS participants by remoteness</h2>
            <p className="text-sm text-white/80 font-medium mt-2">QLD First Nations NDIS data — Dec 2025</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-canvas">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Remoteness</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Participants</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Avg Budget</th>
                </tr>
              </thead>
              <tbody>
                {data.qldFirstNations.map((row, i) => (
                  <tr key={String(row.remoteness)} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 font-bold text-bauhaus-black">{String(row.remoteness)}</td>
                    <td className="p-3 text-right font-mono">{row.participant_count ? fmt(Number(row.participant_count)) : '<11'}</td>
                    <td className="p-3 text-right font-mono font-black">
                      {row.avg_annualised_support ? money(Number(row.avg_annualised_support)) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t-4 border-bauhaus-black bg-bauhaus-yellow/20">
            <p className="text-sm font-medium text-bauhaus-black/80">
              Very Remote First Nations participants receive <strong>28% less</strong> in average plan budgets
              than Inner Regional, despite higher service delivery costs and fewer providers.
            </p>
          </div>
        </div>

        {/* Utilisation */}
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-canvas border-b-4 border-bauhaus-black p-5">
            <p className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-2">Plan Utilisation</p>
            <h2 className="text-2xl font-black text-bauhaus-black">How much of allocated funding is used</h2>
            <p className="text-sm text-bauhaus-muted font-medium mt-2">Lower utilisation = thinner market = plans can&apos;t be spent</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">State</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Avg Utilisation</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Min District</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Max District</th>
                </tr>
              </thead>
              <tbody>
                {data.utilisationByState.map((row, i) => (
                  <tr key={String(row.state)} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 font-bold text-bauhaus-black">{String(row.state)}</td>
                    <td className="p-3 text-right font-mono font-black">{pct(Number(row.avg_util))}</td>
                    <td className="p-3 text-right font-mono text-bauhaus-red">{pct(Number(row.min_util))}</td>
                    <td className="p-3 text-right font-mono text-green-700">{pct(Number(row.max_util))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t-4 border-bauhaus-black bg-bauhaus-red/10">
            <p className="text-sm font-medium text-bauhaus-black/80">
              Nationally, <strong>~30% of allocated NDIS plan budgets go unused</strong>. In thin markets,
              participants are allocated support they cannot access because no providers exist nearby.
              This is the invisible cost of market failure.
            </p>
          </div>
        </div>
      </section>

      {/* First Nations National */}
      <section className="mb-10">
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-black text-white border-b-4 border-bauhaus-black p-5">
            <p className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">National View</p>
            <h2 className="text-2xl font-black">First Nations NDIS by state</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-canvas">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">State</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Total FN Participants</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Very Remote</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Avg Budget</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">VR Budget</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Gap</th>
                </tr>
              </thead>
              <tbody>
                {data.firstNationsNational.filter(r => r.state !== 'ALL').map((row, i) => {
                  const avgB = Number(row.avg_budget) || 0;
                  const vrB = Number(row.vr_budget) || 0;
                  const gap = avgB > 0 && vrB > 0 ? Math.round((1 - vrB / avgB) * 100) : null;
                  return (
                    <tr key={String(row.state)} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-3 font-bold text-bauhaus-black">{String(row.state)}</td>
                      <td className="p-3 text-right font-mono">{row.total ? fmt(Number(row.total)) : '—'}</td>
                      <td className="p-3 text-right font-mono text-bauhaus-red">{row.very_remote ? fmt(Number(row.very_remote)) : '<11'}</td>
                      <td className="p-3 text-right font-mono">{avgB ? money(avgB) : '—'}</td>
                      <td className="p-3 text-right font-mono">{vrB ? money(vrB) : '—'}</td>
                      <td className="p-3 text-right font-mono font-black">
                        {gap !== null && gap > 0 ? <span className="text-bauhaus-red">-{gap}%</span> : gap !== null ? <span className="text-green-700">+{Math.abs(gap)}%</span> : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-4 border-bauhaus-black bg-bauhaus-yellow/20 p-6">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-2">Counter-AI</p>
        <h2 className="text-2xl font-black text-bauhaus-black mb-3">When algorithms decide disability plans, who watches the algorithm?</h2>
        <p className="text-sm text-bauhaus-black/80 font-medium max-w-4xl leading-relaxed">
          From mid-2026, NDIS participant plans will be generated by an algorithmic &ldquo;budget model engine.&rdquo;
          CivicGraph builds the transparency layer: cross-referencing algorithmic budget outputs against actual
          support needs, geographic access, and market capacity. This report is powered by {fmt(Number(cs.ndis) || 0)} linked
          NDIS providers across {Number(cs.max_systems) || 0} government systems — the kind of cross-system visibility no
          single department currently has.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Link href="/reports/ndis-market" className="border-2 border-bauhaus-black bg-white p-4 hover:bg-bauhaus-black hover:text-white transition-colors group">
            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue group-hover:text-bauhaus-yellow">Market Power</p>
            <h3 className="mt-2 text-lg font-black">NDIS Market Concentration</h3>
            <p className="mt-2 text-sm font-medium text-bauhaus-muted group-hover:text-white/70">
              Where the top 10 providers capture outsized payment shares.
            </p>
          </Link>
          <Link href="/reports/funding-deserts" className="border-2 border-bauhaus-black bg-white p-4 hover:bg-bauhaus-black hover:text-white transition-colors group">
            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red group-hover:text-bauhaus-yellow">Funding Deserts</p>
            <h3 className="mt-2 text-lg font-black">Full Desert Analysis</h3>
            <p className="mt-2 text-sm font-medium text-bauhaus-muted group-hover:text-white/70">
              Now includes NDIS thin market penalty in desert scoring.
            </p>
          </Link>
          <Link href="/graph" className="border-2 border-bauhaus-black bg-white p-4 hover:bg-bauhaus-black hover:text-white transition-colors group">
            <p className="text-[10px] font-black uppercase tracking-widest text-green-700 group-hover:text-bauhaus-yellow">Network View</p>
            <h3 className="mt-2 text-lg font-black">Visualize Connections</h3>
            <p className="mt-2 text-sm font-medium text-bauhaus-muted group-hover:text-white/70">
              Force-directed graph showing how disability providers connect to justice, procurement, and evidence.
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}

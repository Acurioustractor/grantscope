import type { Metadata } from 'next';
import { getServiceSupabase } from '@/lib/supabase';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

function money(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}
function fmt(n: number): string { return n.toLocaleString(); }
function pct(n: number | null): string { return n != null ? `${n}%` : '—'; }

interface FoundationScore {
  foundation_id: string;
  name: string;
  acnc_abn: string;
  total_giving_annual: number;
  type: string;
  parent_company: string | null;
  transparency_score: number;
  need_alignment_score: number;
  evidence_score: number;
  concentration_score: number;
  foundation_score: number;
  grantee_count: number;
  lgas_funded: number;
  avg_desert_score: number;
  community_controlled_grantees: number;
  evidence_backed_orgs: number;
  interventions_funded: number;
  states_funded: number;
  unique_lgas: number;
  total_trustees: number;
  overlapping_trustees: number;
  overlap_instances: number;
}

interface Grantee {
  grantee_name: string;
  grantee_abn: string;
  grantee_gs_id: string;
  grantee_type: string;
  grantee_state: string;
  grantee_community_controlled: boolean;
  grant_amount: number;
  grant_year: string;
  link_method: string;
}

interface TrendYear {
  ais_year: number;
  giving: number;
  revenue: number;
  expenses: number;
  assets: number;
  net_assets: number;
  staff_fte: number;
  giving_growth_pct: number | null;
  giving_ratio_pct: number | null;
  self_sufficiency_pct: number | null;
}

interface TrusteeOverlap {
  trustee_name: string;
  grantee_name: string;
  grantee_abn: string;
}

interface RegrантChain {
  regranter_name: string;
  regranter_abn: string;
  ultimate_grantee: string;
  ultimate_grantee_abn: string;
  downstream_amount: number;
}

interface EvidenceLink {
  grantee_name: string;
  intervention_name: string;
  intervention_type: string;
  evidence_level: string;
  cultural_authority: boolean;
  portfolio_score: number;
}

export async function generateMetadata({ params }: { params: Promise<{ abn: string }> }): Promise<Metadata> {
  const { abn } = await params;
  const supabase = getServiceSupabase();
  const { data } = await supabase
    .from('mv_foundation_scores')
    .select('name, foundation_score, total_giving_annual')
    .eq('acnc_abn', abn)
    .single();

  if (!data) return { title: 'Foundation Not Found | CivicGraph' };
  return {
    title: `${data.name} | Foundation Intelligence | CivicGraph`,
    description: `${data.name}: Foundation Score ${data.foundation_score}/100. ${money(Number(data.total_giving_annual))} annual giving. Transparency, need alignment, evidence, and governance analysis.`,
  };
}

async function getData(abn: string) {
  const supabase = getServiceSupabase();

  const [
    scoreResult,
    granteesResult,
    trendsResult,
    trusteeResult,
    regrantResult,
    evidenceResult,
    peerResult,
  ] = await Promise.all([
    // Foundation scores
    supabase
      .from('mv_foundation_scores')
      .select('*')
      .eq('acnc_abn', abn)
      .single(),
    // Grantees
    supabase
      .from('mv_foundation_grantees')
      .select('grantee_name, grantee_abn, grantee_gs_id, grantee_type, grantee_state, grantee_community_controlled, grant_amount, grant_year, link_method')
      .eq('foundation_abn', abn)
      .order('grant_amount', { ascending: false, nullsFirst: false })
      .limit(100),
    // Trends
    supabase
      .from('mv_foundation_trends')
      .select('ais_year, giving, revenue, expenses, assets, net_assets, staff_fte, giving_growth_pct, giving_ratio_pct, self_sufficiency_pct')
      .eq('acnc_abn', abn)
      .order('ais_year', { ascending: true }),
    // Trustee overlaps
    supabase
      .from('mv_trustee_grantee_chain')
      .select('trustee_name, grantee_name, grantee_abn')
      .eq('foundation_abn', abn)
      .eq('trustee_on_grantee_board', true)
      .limit(50),
    // Regranting (where this foundation is the source)
    supabase
      .from('mv_foundation_regranting')
      .select('regranter_name, regranter_abn, ultimate_grantee, ultimate_grantee_abn, downstream_amount')
      .eq('source_abn', abn)
      .limit(50),
    // Evidence-backed grantees
    supabase
      .from('mv_evidence_backed_funding')
      .select('grantee_name, intervention_name, intervention_type, evidence_level, cultural_authority, portfolio_score')
      .eq('foundation_abn', abn)
      .order('portfolio_score', { ascending: false })
      .limit(30),
    // Peer foundations (similar score range)
    supabase
      .from('mv_foundation_scores')
      .select('foundation_id, name, acnc_abn, foundation_score, total_giving_annual, transparency_score, need_alignment_score, evidence_score')
      .neq('acnc_abn', abn)
      .gte('foundation_score', 10)
      .order('foundation_score', { ascending: false })
      .limit(10),
  ]);

  if (!scoreResult.data) return null;

  return {
    score: scoreResult.data as FoundationScore,
    grantees: (granteesResult.data || []) as Grantee[],
    trends: (trendsResult.data || []) as TrendYear[],
    trusteeOverlaps: (trusteeResult.data || []) as TrusteeOverlap[],
    regranting: (regrantResult.data || []) as RegrантChain[],
    evidence: (evidenceResult.data || []) as EvidenceLink[],
    peers: (peerResult.data || []) as FoundationScore[],
  };
}

function ScoreGauge({ score, label, color, description }: { score: number; label: string; color: string; description: string }) {
  return (
    <div className="text-center">
      <div className="relative w-20 h-20 mx-auto mb-2">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="35" stroke="#e5e7eb" strokeWidth="6" fill="none" />
          <circle
            cx="40" cy="40" r="35"
            stroke={color}
            strokeWidth="6"
            fill="none"
            strokeDasharray={`${(score / 100) * 220} 220`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-black">{score}</span>
        </div>
      </div>
      <div className="text-xs font-black uppercase tracking-widest text-bauhaus-black">{label}</div>
      <div className="text-[10px] text-bauhaus-muted mt-1">{description}</div>
    </div>
  );
}

function TrendSparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values.filter(v => v > 0));
  const min = Math.min(...values.filter(v => v > 0));
  const range = max - min || 1;
  const h = 32;
  const w = 120;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} className="inline-block">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

export default async function FoundationDetailPage({ params }: { params: Promise<{ abn: string }> }) {
  const { abn } = await params;
  const data = await getData(abn);
  if (!data) notFound();

  const { score: s, grantees, trends, trusteeOverlaps, regranting, evidence, peers } = data;

  // Aggregate grantee stats
  const uniqueGrantees = new Set(grantees.map(g => g.grantee_abn || g.grantee_name)).size;
  const ccGrantees = grantees.filter(g => g.grantee_community_controlled).length;
  const stateDistribution = new Map<string, number>();
  for (const g of grantees) {
    if (g.grantee_state) stateDistribution.set(g.grantee_state, (stateDistribution.get(g.grantee_state) || 0) + 1);
  }
  const sortedStates = [...stateDistribution.entries()].sort((a, b) => b[1] - a[1]);

  // Regranting stats
  const regrantingByRegranter = new Map<string, { name: string; abn: string; count: number }>();
  for (const r of regranting) {
    if (!regrantingByRegranter.has(r.regranter_abn)) {
      regrantingByRegranter.set(r.regranter_abn, { name: r.regranter_name, abn: r.regranter_abn, count: 0 });
    }
    regrantingByRegranter.get(r.regranter_abn)!.count++;
  }
  const regranters = [...regrantingByRegranter.values()].sort((a, b) => b.count - a.count);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link href="/reports/philanthropy" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; Foundation Intelligence
        </Link>
        <h1 className="text-2xl sm:text-3xl font-black text-bauhaus-black mt-4 mb-2">{s.name}</h1>
        <div className="flex flex-wrap gap-3 text-sm text-bauhaus-muted font-bold">
          <span>ABN: {s.acnc_abn}</span>
          <span>&middot;</span>
          <span>{s.type?.replace(/_/g, ' ')}</span>
          {s.parent_company && <><span>&middot;</span><span>{s.parent_company}</span></>}
          <span>&middot;</span>
          <span>{money(Number(s.total_giving_annual))} annual giving</span>
        </div>
      </div>

      {/* Score Overview */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black bg-white p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-black uppercase tracking-widest">Foundation Score</h2>
            <div className="text-4xl font-black text-bauhaus-black bg-bauhaus-canvas px-4 py-2 border-2 border-bauhaus-black">
              {s.foundation_score}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <ScoreGauge
              score={s.transparency_score}
              label="Transparency"
              color="#3b82f6"
              description={`${s.grantee_count} traceable grantees`}
            />
            <ScoreGauge
              score={s.need_alignment_score}
              label="Need Alignment"
              color="#f59e0b"
              description={`${s.lgas_funded} LGAs funded`}
            />
            <ScoreGauge
              score={s.evidence_score}
              label="Evidence"
              color="#14b8a6"
              description={`${s.evidence_backed_orgs} evidence-backed orgs`}
            />
            <ScoreGauge
              score={s.concentration_score}
              label="Geographic Reach"
              color="#8b5cf6"
              description={`${s.states_funded} states, ${s.unique_lgas} LGAs`}
            />
          </div>
        </div>
      </section>

      {/* Key Stats */}
      <section className="mb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
          <div className="border-4 border-bauhaus-black p-5 bg-bauhaus-black text-white">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-1">Annual Giving</div>
            <div className="text-2xl font-black">{money(Number(s.total_giving_annual))}</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 border-bauhaus-black p-5 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-1">Traceable Grantees</div>
            <div className="text-2xl font-black">{fmt(uniqueGrantees)}</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-5 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-1">Community-Controlled</div>
            <div className="text-2xl font-black text-green-700">{fmt(ccGrantees)}</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-5 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-1">Board Overlaps</div>
            <div className="text-2xl font-black text-bauhaus-red">{s.overlapping_trustees > 0 ? s.overlap_instances : 0}</div>
          </div>
        </div>
      </section>

      {/* Financial Trends */}
      {trends.length > 1 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">Financial Trends</h2>
          <p className="text-sm text-bauhaus-muted mb-4">
            {trends.length} years of ACNC Annual Information Statement data ({trends[0].ais_year}&ndash;{trends[trends.length - 1].ais_year}).
          </p>
          <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Year</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Grants Given</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Revenue</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">Assets</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Giving Ratio</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">YoY</th>
                </tr>
              </thead>
              <tbody>
                {trends.map((t, i) => (
                  <tr key={t.ais_year} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 font-black">{t.ais_year}</td>
                    <td className="p-3 text-right font-mono font-bold">{Number(t.giving) > 0 ? money(Number(t.giving)) : '—'}</td>
                    <td className="p-3 text-right font-mono hidden sm:table-cell">{Number(t.revenue) > 0 ? money(Number(t.revenue)) : '—'}</td>
                    <td className="p-3 text-right font-mono hidden md:table-cell">{Number(t.assets) > 0 ? money(Number(t.assets)) : '—'}</td>
                    <td className="p-3 text-right font-mono hidden sm:table-cell">{pct(t.giving_ratio_pct)}</td>
                    <td className="p-3 text-right font-mono font-bold">
                      {t.giving_growth_pct != null ? (
                        <span className={Number(t.giving_growth_pct) > 0 ? 'text-green-700' : Number(t.giving_growth_pct) < 0 ? 'text-red-600' : ''}>
                          {Number(t.giving_growth_pct) > 0 ? '+' : ''}{t.giving_growth_pct}%
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mini sparklines */}
          <div className="mt-4 flex gap-8 flex-wrap">
            <div>
              <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Giving Trend</div>
              <TrendSparkline values={trends.map(t => Number(t.giving))} color="#3b82f6" />
            </div>
            <div>
              <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Asset Trend</div>
              <TrendSparkline values={trends.map(t => Number(t.assets))} color="#8b5cf6" />
            </div>
          </div>
        </section>
      )}

      {/* Grantees */}
      {grantees.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">Grantees</h2>
          <p className="text-sm text-bauhaus-muted mb-4">
            {uniqueGrantees} traceable grantees across {sortedStates.length} states.
            {ccGrantees > 0 && ` ${ccGrantees} community-controlled.`}
          </p>

          {/* State distribution */}
          {sortedStates.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {sortedStates.map(([state, count]) => (
                <span key={state} className="inline-block px-2 py-1 text-[10px] font-bold bg-gray-100 border border-gray-200 rounded">
                  {state}: {count}
                </span>
              ))}
            </div>
          )}

          <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Grantee</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">State</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Amount</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">Year</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">Source</th>
                </tr>
              </thead>
              <tbody>
                {grantees.slice(0, 50).map((g, i) => (
                  <tr key={`${g.grantee_abn || g.grantee_name}-${g.grant_year}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3">
                      {g.grantee_gs_id ? (
                        <Link href={`/org/${g.grantee_gs_id}`} className="font-bold text-bauhaus-black hover:text-bauhaus-red">
                          {g.grantee_name}
                        </Link>
                      ) : (
                        <span className="font-bold text-bauhaus-black">{g.grantee_name}</span>
                      )}
                      {g.grantee_community_controlled && (
                        <span className="ml-2 text-[10px] font-black text-green-700">COMMUNITY</span>
                      )}
                    </td>
                    <td className="p-3 text-xs hidden sm:table-cell">{g.grantee_state || '—'}</td>
                    <td className="p-3 text-right font-mono font-bold">{Number(g.grant_amount) > 0 ? money(Number(g.grant_amount)) : '—'}</td>
                    <td className="p-3 text-xs hidden md:table-cell">{g.grant_year || '—'}</td>
                    <td className="p-3 hidden md:table-cell">
                      <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded font-bold">{g.link_method}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {grantees.length > 50 && (
            <div className="mt-2 text-xs text-bauhaus-muted font-bold text-right">
              Showing 50 of {grantees.length} grantees
            </div>
          )}
        </section>
      )}

      {/* Trustee-Grantee Overlaps */}
      {trusteeOverlaps.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
            Governance: Board Overlaps
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">
            Foundation trustees who also sit on the boards of organisations this foundation funds.
          </p>
          <div className="border-4 border-bauhaus-red/30 bg-red-50/30 p-4">
            {trusteeOverlaps.map((t, i) => (
              <div key={`${t.trustee_name}-${t.grantee_name}-${i}`} className="flex items-center gap-2 py-2 border-b border-red-100 last:border-0">
                <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-800 rounded">{t.trustee_name}</span>
                <span className="text-bauhaus-muted text-xs">&rarr;</span>
                <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded">{t.grantee_name}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Regranting Chain */}
      {regranters.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
            Regranting Chain
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">
            This foundation funds organisations that themselves regrant to downstream recipients.
            {regranting.length} downstream grants traced through {regranters.length} regranter{regranters.length !== 1 ? 's' : ''}.
          </p>
          <div className="border-4 border-bauhaus-black bg-white">
            {regranters.map((r) => (
              <div key={r.abn} className="p-4 border-b-2 border-bauhaus-black/10 last:border-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-bauhaus-black">{s.name}</span>
                  <span className="text-bauhaus-muted">&rarr;</span>
                  <Link href={`/foundation/${r.abn}`} className="font-bold text-bauhaus-blue hover:text-bauhaus-red">
                    {r.name}
                  </Link>
                  <span className="text-bauhaus-muted">&rarr;</span>
                  <span className="text-sm text-bauhaus-muted">{r.count} downstream grantees</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Evidence-Backed Grantees */}
      {evidence.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
            Evidence-Backed Grantees
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">
            Grantees with interventions documented in the Australian Living Map of Alternatives (ALMA).
          </p>
          <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-teal-700 text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Grantee</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Intervention</th>
                  <th className="text-center p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Evidence</th>
                  <th className="text-center p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Cultural</th>
                </tr>
              </thead>
              <tbody>
                {evidence.map((e, i) => (
                  <tr key={`${e.grantee_name}-${e.intervention_name}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-teal-50/30'}>
                    <td className="p-3 font-bold text-xs">{e.grantee_name}</td>
                    <td className="p-3 text-xs text-bauhaus-muted">{e.intervention_name}</td>
                    <td className="p-3 text-center hidden sm:table-cell">
                      <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold bg-teal-100 text-teal-800 rounded">
                        {e.evidence_level || 'N/A'}
                      </span>
                    </td>
                    <td className="p-3 text-center hidden sm:table-cell">
                      {e.cultural_authority && (
                        <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded">YES</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Peer Comparison */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Peer Foundations
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">Top-scored foundations for comparison.</p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left p-3 font-black uppercase tracking-widest text-[10px]">Foundation</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-[10px]">Giving</th>
                <th className="text-center p-3 font-black uppercase tracking-widest text-[10px] hidden sm:table-cell">T</th>
                <th className="text-center p-3 font-black uppercase tracking-widest text-[10px] hidden sm:table-cell">N</th>
                <th className="text-center p-3 font-black uppercase tracking-widest text-[10px] hidden sm:table-cell">E</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-[10px]">Score</th>
              </tr>
            </thead>
            <tbody>
              {/* Current foundation highlighted */}
              <tr className="bg-bauhaus-black text-white">
                <td className="p-3 font-bold">{s.name}</td>
                <td className="p-3 text-right font-mono">{money(Number(s.total_giving_annual))}</td>
                <td className="p-3 text-center font-mono hidden sm:table-cell">{s.transparency_score}</td>
                <td className="p-3 text-center font-mono hidden sm:table-cell">{s.need_alignment_score}</td>
                <td className="p-3 text-center font-mono hidden sm:table-cell">{s.evidence_score}</td>
                <td className="p-3 text-right font-mono font-black text-bauhaus-yellow">{s.foundation_score}</td>
              </tr>
              {peers.map((p, i) => (
                <tr key={p.foundation_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-3">
                    <Link href={`/foundation/${p.acnc_abn}`} className="font-bold hover:text-bauhaus-red">
                      {p.name}
                    </Link>
                  </td>
                  <td className="p-3 text-right font-mono">{money(Number(p.total_giving_annual))}</td>
                  <td className="p-3 text-center font-mono hidden sm:table-cell">{p.transparency_score}</td>
                  <td className="p-3 text-center font-mono hidden sm:table-cell">{p.need_alignment_score}</td>
                  <td className="p-3 text-center font-mono hidden sm:table-cell">{p.evidence_score}</td>
                  <td className="p-3 text-right font-mono font-black">{p.foundation_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* CTA */}
      <section className="mb-8">
        <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-canvas text-center">
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/reports/philanthropy"
              className="inline-block px-6 py-2 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-red transition-colors"
            >
              Full Report
            </Link>
            <Link
              href={`/graph?mode=hubs&type=foundation`}
              className="inline-block px-6 py-2 bg-purple-700 text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black transition-colors"
            >
              Foundation Network Graph
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

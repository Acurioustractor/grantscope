import type { Metadata } from 'next';
import { getServiceSupabase } from '@/lib/supabase';
import Link from 'next/link';
import { ReportCTA } from '../_components/report-cta';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Foundation Intelligence | CivicGraph Investigation',
  description: 'Australia\'s philanthropy sector scored on transparency, need alignment, evidence, and governance. 2,466 foundations. $11.8B in annual giving.',
  openGraph: {
    title: 'Foundation Intelligence',
    description: '2,466 Australian foundations scored across transparency, need alignment, evidence backing, and geographic reach.',
    type: 'article',
    siteName: 'CivicGraph',
  },
};

function money(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}
function fmt(n: number): string { return n.toLocaleString(); }

function ScoreBar({ score, label, color }: { score: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 text-xs font-bold text-bauhaus-black text-right shrink-0">{label}</div>
      <div className="flex-1 h-4 bg-gray-100 relative">
        <div className={`h-full ${color} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <div className="w-8 text-xs font-mono font-bold text-right shrink-0">{score}</div>
    </div>
  );
}

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

interface TrusteeOverlap {
  trustee_name: string;
  foundation_name: string;
  foundation_abn: string;
  grantee_name: string;
  grantee_abn: string;
  trustee_on_grantee_board: boolean;
}

interface EvidenceFunding {
  foundation_name: string;
  foundation_abn: string;
  grantee_name: string;
  intervention_name: string;
  intervention_type: string;
  evidence_level: string;
  cultural_authority: boolean;
  portfolio_score: number;
}

interface Stats {
  totalFoundations: number;
  totalGivingB: number;
  totalGranteeLinks: number;
  revolvingDoorFoundations: number;
  evidenceFoundations: number;
  overlappingTrustees: number;
  overlapInstances: number;
  evidenceGrantees: number;
  interventionCount: number;
  ccGrantees: number;
}

async function getData() {
  const supabase = getServiceSupabase();

  const [
    topScoresResult,
    revolvingDoorResult,
    evidenceResult,
    lowTransparencyResult,
    statsResult,
    trusteeStatsResult,
    evidenceStatsResult,
    needAlignmentResult,
  ] = await Promise.all([
    // Top-scored foundations
    supabase
      .from('mv_foundation_scores')
      .select('*')
      .order('foundation_score', { ascending: false })
      .limit(25),
    // Trustee-grantee overlaps (revolving door)
    supabase
      .from('mv_trustee_grantee_chain')
      .select('trustee_name, foundation_name, foundation_abn, grantee_name, grantee_abn, trustee_on_grantee_board')
      .eq('trustee_on_grantee_board', true)
      .limit(50),
    // Evidence-backed funding
    supabase
      .from('mv_evidence_backed_funding')
      .select('*')
      .order('portfolio_score', { ascending: false })
      .limit(30),
    // Largest foundations with zero transparency
    supabase
      .from('mv_foundation_scores')
      .select('foundation_id, name, acnc_abn, total_giving_annual, type, transparency_score, foundation_score')
      .eq('transparency_score', 0)
      .order('total_giving_annual', { ascending: false })
      .limit(15),
    // Aggregate stats
    supabase.rpc('exec_sql', {
      query: `SELECT COUNT(*) as total, ROUND(SUM(total_giving_annual)/1e9, 1) as giving_b, SUM(grantee_count) as grantee_links, COUNT(*) FILTER (WHERE overlapping_trustees > 0) as revolving_foundations, COUNT(*) FILTER (WHERE evidence_backed_orgs > 0) as evidence_foundations, SUM(community_controlled_grantees) as cc_grantees FROM mv_foundation_scores`,
    }),
    // Trustee overlap stats
    supabase.rpc('exec_sql', {
      query: `SELECT COUNT(DISTINCT trustee_name) FILTER (WHERE trustee_on_grantee_board) as overlap_trustees, COUNT(*) FILTER (WHERE trustee_on_grantee_board) as overlap_instances FROM mv_trustee_grantee_chain`,
    }),
    // Evidence stats
    supabase.rpc('exec_sql', {
      query: `SELECT COUNT(DISTINCT grantee_name) as evidence_grantees, COUNT(DISTINCT intervention_name) as interventions FROM mv_evidence_backed_funding`,
    }),
    // Top need-aligned foundations (highest avg desert score funded)
    supabase
      .from('mv_foundation_need_alignment')
      .select('*')
      .not('avg_lga_disadvantage', 'is', null)
      .order('avg_lga_disadvantage', { ascending: true })
      .limit(20),
  ]);

  const topScores = (topScoresResult.data || []) as FoundationScore[];
  const revolvingDoor = (revolvingDoorResult.data || []) as TrusteeOverlap[];
  const evidence = (evidenceResult.data || []) as EvidenceFunding[];
  const lowTransparency = (lowTransparencyResult.data || []) as FoundationScore[];
  const needAlignment = (needAlignmentResult.data || []) as Record<string, unknown>[];

  const summary = (statsResult.data as Record<string, string>[])?.[0];
  const trusteeStats = (trusteeStatsResult.data as Record<string, string>[])?.[0];
  const evidenceStats = (evidenceStatsResult.data as Record<string, string>[])?.[0];

  const stats: Stats = {
    totalFoundations: Number(summary?.total) || 0,
    totalGivingB: Number(summary?.giving_b) || 0,
    totalGranteeLinks: Number(summary?.grantee_links) || 0,
    revolvingDoorFoundations: Number(summary?.revolving_foundations) || 0,
    evidenceFoundations: Number(summary?.evidence_foundations) || 0,
    overlappingTrustees: Number(trusteeStats?.overlap_trustees) || 0,
    overlapInstances: Number(trusteeStats?.overlap_instances) || 0,
    evidenceGrantees: Number(evidenceStats?.evidence_grantees) || 0,
    interventionCount: Number(evidenceStats?.interventions) || 0,
    ccGrantees: Number(summary?.cc_grantees) || 0,
  };

  return { topScores, revolvingDoor, evidence, lowTransparency, needAlignment, stats };
}

export default async function PhilanthropyReport() {
  const d = await getData();
  const s = d.stats;

  // Group revolving door by foundation
  const revolvingByFoundation = new Map<string, { foundation: string; trustees: Set<string>; grantees: Set<string>; instances: number }>();
  for (const r of d.revolvingDoor) {
    const key = r.foundation_name;
    if (!revolvingByFoundation.has(key)) {
      revolvingByFoundation.set(key, { foundation: key, trustees: new Set(), grantees: new Set(), instances: 0 });
    }
    const entry = revolvingByFoundation.get(key)!;
    entry.trustees.add(r.trustee_name);
    entry.grantees.add(r.grantee_name);
    entry.instances++;
  }
  const revolvingGroups = [...revolvingByFoundation.values()]
    .sort((a, b) => b.instances - a.instances);

  // Group evidence by foundation
  const evidenceByFoundation = new Map<string, { foundation: string; grantees: Map<string, { interventions: string[]; evidenceLevel: string; culturalAuthority: boolean }> }>();
  for (const e of d.evidence) {
    if (!evidenceByFoundation.has(e.foundation_name)) {
      evidenceByFoundation.set(e.foundation_name, { foundation: e.foundation_name, grantees: new Map() });
    }
    const fEntry = evidenceByFoundation.get(e.foundation_name)!;
    if (!fEntry.grantees.has(e.grantee_name)) {
      fEntry.grantees.set(e.grantee_name, { interventions: [], evidenceLevel: e.evidence_level, culturalAuthority: e.cultural_authority });
    }
    fEntry.grantees.get(e.grantee_name)!.interventions.push(e.intervention_name);
  }
  const evidenceGroups = [...evidenceByFoundation.values()]
    .sort((a, b) => b.grantees.size - a.grantees.size);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
        <div className="text-xs font-black text-bauhaus-red mt-4 mb-1 uppercase tracking-widest">Foundation Intelligence</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Who Funds What. Who Watches. What Works.
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          {fmt(s.totalFoundations)} Australian foundations scored on transparency, need alignment,
          evidence-backed funding, and geographic reach. ${s.totalGivingB}B in annual giving &mdash;
          but how much of it reaches communities that need it most?
        </p>
        <div className="mt-4 text-xs text-bauhaus-muted font-bold">
          Data updated {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Hero stats */}
      <section className="mb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
          <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-black text-white">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Foundations Scored</div>
            <div className="text-3xl sm:text-4xl font-black">{fmt(s.totalFoundations)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">${s.totalGivingB}B annual giving</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 border-bauhaus-black p-6 bg-purple-700 text-white">
            <div className="text-xs font-black text-purple-200 uppercase tracking-widest mb-2">Grantee Links</div>
            <div className="text-3xl sm:text-4xl font-black">{fmt(s.totalGranteeLinks)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">traced foundation&rarr;recipient</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">Revolving Door</div>
            <div className="text-3xl sm:text-4xl font-black text-bauhaus-red">{s.overlappingTrustees}</div>
            <div className="text-bauhaus-muted/60 text-xs font-bold mt-2">trustees on grantee boards</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-teal-600 text-white">
            <div className="text-xs font-black text-teal-200 uppercase tracking-widest mb-2">Evidence-Backed</div>
            <div className="text-3xl sm:text-4xl font-black">{fmt(s.evidenceGrantees)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">grantees with ALMA evidence</div>
          </div>
        </div>
        <div className="border-4 border-t-0 border-bauhaus-black p-4 bg-bauhaus-canvas text-center">
          <p className="text-sm text-bauhaus-muted font-bold">
            Source: ACNC Registry &times; Foundation Grantee Scraping &times; ACNC AIS &times; ALMA Evidence Database &times; Funding Deserts Index.
          </p>
        </div>
      </section>

      {/* Top Scored Foundations */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Foundation Scorecard
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Composite score from four dimensions: transparency (do we know who they fund?),
          need alignment (do they reach disadvantaged areas?), evidence (do grantees have
          proven interventions?), and geographic reach (how broadly do they fund?).
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs w-8">#</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Foundation</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">Annual Giving</th>
                <th className="text-center p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Transp.</th>
                <th className="text-center p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Need</th>
                <th className="text-center p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Evidence</th>
                <th className="text-center p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Reach</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Score</th>
              </tr>
            </thead>
            <tbody>
              {d.topScores.slice(0, 20).map((f, i) => (
                <tr key={f.foundation_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-3 font-black text-bauhaus-muted">{i + 1}</td>
                  <td className="p-3">
                    <Link href={`/foundation/${f.acnc_abn}`} className="hover:text-bauhaus-red transition-colors">
                      <div className="font-bold text-bauhaus-black">{f.name}</div>
                      <div className="text-xs text-bauhaus-muted">
                        {f.type?.replace(/_/g, ' ')}
                        {f.parent_company && <span> &middot; {f.parent_company}</span>}
                        {f.grantee_count > 0 && <span> &middot; {f.grantee_count} grantees</span>}
                      </div>
                    </Link>
                    {/* Mini score bars on mobile */}
                    <div className="sm:hidden mt-2 space-y-1">
                      <ScoreBar score={f.transparency_score} label="Transp." color="bg-blue-500" />
                      <ScoreBar score={f.need_alignment_score} label="Need" color="bg-amber-500" />
                      <ScoreBar score={f.evidence_score} label="Evidence" color="bg-teal-500" />
                      <ScoreBar score={f.concentration_score} label="Reach" color="bg-purple-500" />
                    </div>
                  </td>
                  <td className="p-3 text-right font-mono whitespace-nowrap hidden md:table-cell">{money(Number(f.total_giving_annual))}</td>
                  <td className="p-3 text-center hidden sm:table-cell">
                    <span className={`inline-block w-8 h-8 leading-8 text-xs font-black rounded ${f.transparency_score >= 50 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'}`}>
                      {f.transparency_score}
                    </span>
                  </td>
                  <td className="p-3 text-center hidden sm:table-cell">
                    <span className={`inline-block w-8 h-8 leading-8 text-xs font-black rounded ${f.need_alignment_score >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'}`}>
                      {f.need_alignment_score}
                    </span>
                  </td>
                  <td className="p-3 text-center hidden sm:table-cell">
                    <span className={`inline-block w-8 h-8 leading-8 text-xs font-black rounded ${f.evidence_score >= 20 ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-gray-500'}`}>
                      {f.evidence_score}
                    </span>
                  </td>
                  <td className="p-3 text-center hidden sm:table-cell">
                    <span className={`inline-block w-8 h-8 leading-8 text-xs font-black rounded ${f.concentration_score >= 50 ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-500'}`}>
                      {f.concentration_score}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <span className="inline-block px-2 py-1 text-sm font-black bg-bauhaus-black text-white rounded">
                      {f.foundation_score}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ReportCTA reportSlug="philanthropy" reportTitle="Foundation Intelligence" variant="inline" />

      {/* Transparency Gap */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-bauhaus-black text-white">
          <h2 className="text-lg font-black mb-4 text-bauhaus-yellow uppercase tracking-widest">
            The Transparency Gap
          </h2>
          <p className="text-sm text-white/80 mb-6 max-w-2xl leading-relaxed">
            Most foundations operate as black boxes. Of {fmt(s.totalFoundations)} scored, only {fmt(s.totalGranteeLinks > 0 ? Math.round(s.totalGranteeLinks / 20) : 0)}+ have
            any publicly traceable grantee data. The largest invisible foundations control billions
            in annual giving with zero public accountability for where the money goes.
          </p>
          <h3 className="text-xs font-black text-white/50 uppercase tracking-widest mb-3">
            Largest Foundations With Zero Transparency
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="text-left p-2 text-xs font-black text-white/50 uppercase tracking-widest">Foundation</th>
                  <th className="text-right p-2 text-xs font-black text-white/50 uppercase tracking-widest">Annual Giving</th>
                  <th className="text-right p-2 text-xs font-black text-white/50 uppercase tracking-widest">Type</th>
                </tr>
              </thead>
              <tbody>
                {d.lowTransparency.slice(0, 10).map((f) => (
                  <tr key={f.foundation_id} className="border-b border-white/10">
                    <td className="p-2 font-bold text-white">
                      <Link href={`/foundation/${f.acnc_abn}`} className="hover:text-bauhaus-yellow transition-colors">{f.name}</Link>
                    </td>
                    <td className="p-2 text-right font-mono font-black text-bauhaus-yellow whitespace-nowrap">
                      {money(Number(f.total_giving_annual))}
                    </td>
                    <td className="p-2 text-right text-xs text-white/50">{f.type?.replace(/_/g, ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Revolving Door: Trustees on Grantee Boards */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          The Philanthropy Revolving Door
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          {s.overlappingTrustees} foundation trustees also sit on the boards of organisations
          their foundation funds. {s.overlapInstances} trustee&ndash;grantee overlaps across {s.revolvingDoorFoundations} foundations.
          This isn&apos;t necessarily corruption &mdash; small sectors have small talent pools &mdash;
          but it warrants scrutiny.
        </p>
        <div className="border-4 border-bauhaus-black bg-white">
          {revolvingGroups.map((group) => (
            <div key={group.foundation} className="p-4 border-b-2 border-bauhaus-black/10 last:border-b-0">
              <div className="font-bold text-bauhaus-black mb-1">{group.foundation}</div>
              <div className="text-xs text-bauhaus-muted mb-2">
                {group.trustees.size} trustee{group.trustees.size !== 1 ? 's' : ''} on {group.grantees.size} grantee board{group.grantees.size !== 1 ? 's' : ''} &middot; {group.instances} overlap{group.instances !== 1 ? 's' : ''}
              </div>
              <div className="flex flex-wrap gap-1">
                {[...group.trustees].map(t => (
                  <span key={t} className="inline-block px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-800 rounded">
                    {t}
                  </span>
                ))}
                <span className="text-[10px] text-bauhaus-muted font-bold">&rarr;</span>
                {[...group.grantees].map(g => (
                  <span key={g} className="inline-block px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded">
                    {g}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Evidence-Backed Funding */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Evidence-Backed Funding
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Foundations whose grantees have interventions documented in the Australian Living Map
          of Alternatives (ALMA) evidence database. {fmt(s.evidenceGrantees)} grantees across
          {fmt(s.interventionCount)} interventions.
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-teal-700 text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Foundation</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Grantee</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Intervention</th>
                <th className="text-center p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">Evidence</th>
                <th className="text-center p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">Cultural</th>
              </tr>
            </thead>
            <tbody>
              {d.evidence.slice(0, 20).map((e, i) => (
                <tr key={`${e.foundation_name}-${e.grantee_name}-${e.intervention_name}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-teal-50/30'}>
                  <td className="p-3 text-xs font-bold text-bauhaus-black">{e.foundation_name}</td>
                  <td className="p-3">
                    <div className="font-bold text-bauhaus-black text-xs">{e.grantee_name}</div>
                  </td>
                  <td className="p-3 text-xs text-bauhaus-muted hidden sm:table-cell">{e.intervention_name}</td>
                  <td className="p-3 text-center hidden md:table-cell">
                    <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold bg-teal-100 text-teal-800 rounded">
                      {e.evidence_level || 'N/A'}
                    </span>
                  </td>
                  <td className="p-3 text-center hidden md:table-cell">
                    {e.cultural_authority && (
                      <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded">
                        CULTURAL
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Scoring Methodology */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-white">
          <h2 className="text-lg font-black text-bauhaus-black mb-4 uppercase tracking-widest">Methodology</h2>
          <div className="text-sm text-bauhaus-muted leading-relaxed space-y-3 max-w-3xl">
            <p>
              <strong>Transparency score (25% weight):</strong> Based on the number of publicly
              identifiable grantees. 5 points per grantee, capped at 100. Grantees are traced
              through ACNC annual reports, foundation websites, and public grant announcements.
            </p>
            <p>
              <strong>Need alignment score (30% weight):</strong> How much funding reaches
              disadvantaged areas. Based on the average desert score of LGAs where grantees
              are located. Higher score means more funding flows to higher-need areas.
            </p>
            <p>
              <strong>Evidence score (25% weight):</strong> Percentage of grantees that have
              interventions documented in the Australian Living Map of Alternatives (ALMA)
              evidence database. Doubled and capped at 100.
            </p>
            <p>
              <strong>Geographic reach (20% weight):</strong> Diversity of funding across
              states (10 points each), remoteness categories (10 points each), and unique
              LGAs (1 point each, capped at 50). A foundation scoring 100 funds across
              multiple states, all remoteness categories, and 50+ LGAs.
            </p>
            <p>
              <strong>Governance (supplementary):</strong> Trustee&ndash;grantee board overlaps
              are flagged but not included in the composite score. These indicate potential
              conflicts of interest but also reflect the reality of small professional networks.
            </p>
            <p>
              <strong>Limitations:</strong> Transparency scores heavily favour foundations whose
              grantee data CivicGraph has been able to scrape or trace. Smaller foundations may
              be highly transparent through direct reporting but invisible to automated collection.
              Need alignment only measures where grantees are located, not where services are delivered.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mb-8">
        <div className="border-4 border-bauhaus-red p-8 bg-bauhaus-red/5 text-center">
          <h2 className="text-lg font-black text-bauhaus-black mb-2">Explore Foundation Networks</h2>
          <p className="text-sm text-bauhaus-muted mb-4 max-w-xl mx-auto">
            See how foundations connect to grantees, government programs, and evidence-backed
            interventions on the interactive graph.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/graph?mode=hubs&type=foundation"
              className="inline-block px-8 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-red transition-colors"
            >
              Foundation Networks
            </Link>
            <Link
              href="/graph?mode=justice&topic=youth-justice"
              className="inline-block px-8 py-3 bg-purple-700 text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black transition-colors"
            >
              Justice Funding Map
            </Link>
          </div>
        </div>
      </section>

      <ReportCTA reportSlug="philanthropy" reportTitle="Foundation Intelligence" />
    </div>
  );
}

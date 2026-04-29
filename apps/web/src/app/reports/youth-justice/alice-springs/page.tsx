import Link from 'next/link';
import { getServiceSupabase } from '@/lib/report-supabase';
import { safe } from '@/lib/services/utils';
import {
  getOutcomesMetrics,
  money,
} from '@/lib/services/report-service';

export const revalidate = 3600;

export function generateMetadata() {
  return {
    title: 'Alice Springs Youth Services — CivicGraph',
    description: 'Place-based accountability: 17 youth services, funding inversion analysis, and the case for prevention in Mparntwe/Alice Springs.',
  };
}

type AlmaRow = { name: string; type: string | null; evidence_level: string | null; geography: string | null; portfolio_score: number | null; gs_entity_id: string | null };
type MetricRow = { metric_name: string; metric_value: number; metric_unit: string; period: string; cohort: string | null; source: string; notes: string | null };

// Funding inversion data from Alice Springs Youth Services Mapping Project (2022)
const FUNDING_INVERSION = {
  ntg: [
    { tier: 'Reactive / Crisis', amount: 14_770_000, pct: 67, color: 'bg-red-500' },
    { tier: 'Early Intervention', amount: 4_790_000, pct: 22, color: 'bg-amber-400' },
    { tier: 'Prevention', amount: 2_020_000, pct: 9, color: 'bg-emerald-400' },
    { tier: 'Universal', amount: 410_000, pct: 2, color: 'bg-blue-400' },
  ],
  niaa: [
    { tier: 'Reactive / Crisis', amount: 3_960_000, pct: 39, color: 'bg-red-500' },
    { tier: 'Prevention', amount: 3_520_000, pct: 35, color: 'bg-emerald-400' },
    { tier: 'Early Intervention', amount: 2_560_000, pct: 26, color: 'bg-amber-400' },
  ],
};

const INTERVENTION_TYPES: Record<string, { label: string; color: string }> = {
  'Prevention': { label: 'Prevention', color: 'bg-emerald-100 text-emerald-700' },
  'Early Intervention': { label: 'Early Intervention', color: 'bg-amber-100 text-amber-700' },
  'Diversion': { label: 'Diversion', color: 'bg-blue-100 text-blue-700' },
  'Wraparound Support': { label: 'Wraparound', color: 'bg-purple-100 text-purple-700' },
  'Cultural Connection': { label: 'Cultural Connection', color: 'bg-amber-100 text-amber-800' },
  'Community-Led': { label: 'Community-Led', color: 'bg-teal-100 text-teal-700' },
  'Therapeutic': { label: 'Therapeutic', color: 'bg-indigo-100 text-indigo-700' },
};

const EVIDENCE_LEVELS: Record<string, { label: string; color: string }> = {
  'Effective': { label: 'Effective', color: 'bg-emerald-500 text-white' },
  'Indigenous-led': { label: 'Indigenous-led', color: 'bg-amber-500 text-white' },
  'Promising': { label: 'Promising', color: 'bg-blue-400 text-white' },
  'Untested': { label: 'Untested', color: 'bg-gray-300 text-gray-700' },
};

function evidenceTag(level: string | null) {
  if (!level) return null;
  const key = Object.keys(EVIDENCE_LEVELS).find(k => level.startsWith(k));
  if (!key) return <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-bold">{level}</span>;
  const { label, color } = EVIDENCE_LEVELS[key];
  return <span className={`text-[10px] ${color} px-1.5 py-0.5 rounded font-bold`}>{label}</span>;
}

async function getPageData() {
  const supabase = getServiceSupabase();

  const [almaData, ntOutcomes] = await Promise.all([
    safe(supabase.rpc('exec_sql', {
      query: `SELECT name, type, evidence_level, geography::text, portfolio_score, gs_entity_id
              FROM alma_interventions
              WHERE geography::text ILIKE '%Alice Springs%'
              ORDER BY type, name`,
    })) as Promise<AlmaRow[] | null>,
    getOutcomesMetrics('NT'),
  ]);

  const interventions = almaData || [];

  return {
    interventions,
    almaCount: interventions.length,
    outcomes: (ntOutcomes as MetricRow[] | null) || [],
  };
}

export default async function AliceSpringsPage() {
  const data = await getPageData();
  const om = data.outcomes;
  const m = (name: string): number | null => {
    const row = om.find(r => r.metric_name === name && (r.cohort === 'all' || r.cohort === 'indigenous'));
    return row?.metric_value ?? null;
  };

  // Group interventions by type
  const byType: Record<string, AlmaRow[]> = {};
  for (const a of data.interventions) {
    const t = a.type || 'Other';
    if (!byType[t]) byType[t] = [];
    byType[t].push(a);
  }

  const totalNtg = FUNDING_INVERSION.ntg.reduce((s, r) => s + r.amount, 0);
  const totalNiaa = FUNDING_INVERSION.niaa.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero */}
      <div className="mb-8">
        <Link href="/reports/youth-justice/nt" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; NT Youth Justice
        </Link>
        <div className="flex items-center gap-3 mt-4 mb-1">
          <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">Place-Based Accountability</span>
          <span className="text-[10px] font-bold text-white bg-bauhaus-black px-2 py-0.5 rounded-sm uppercase tracking-wider">Mparntwe / Alice Springs</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Alice Springs Youth Services
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          67% of government youth spending in Alice Springs goes to reactive/crisis services.
          Only 9% goes to prevention. Meanwhile, 17 community-led alternatives exist with documented evidence —
          most receive a fraction of the funding. This is the funding inversion.
        </p>
        <div className="flex gap-2 mt-4">
          <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded uppercase tracking-wider">ALMA</span>
          <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded uppercase tracking-wider">NIAA Mapping 2022</span>
          <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded uppercase tracking-wider">YAP 2023-27</span>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-red-600">67%</div>
          <div className="text-xs text-gray-500 mt-1">Reactive Spending (NTG)</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-emerald-600">9%</div>
          <div className="text-xs text-gray-500 mt-1">Prevention Spending (NTG)</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-amber-600">{data.almaCount}</div>
          <div className="text-xs text-gray-500 mt-1">ALMA Interventions</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-blue-600">{m('avg_daily_detention') ?? '62'}</div>
          <div className="text-xs text-gray-500 mt-1">NT Avg Daily Detention</div>
        </div>
      </div>

      {/* ━━━━ The Funding Inversion ━━━━ */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-red pb-2">
          The Funding Inversion
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6">
          Source: Alice Springs Youth Services Mapping Project (NIAA + CM&C, 2022).
          ${money(totalNtg + totalNiaa)} total youth services spending mapped by intervention tier.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          {/* NTG */}
          <div className="border-4 border-bauhaus-black rounded-sm p-5">
            <h3 className="text-sm font-black text-bauhaus-black uppercase tracking-wider mb-3">NT Government — {money(totalNtg)}</h3>
            <div className="space-y-3">
              {FUNDING_INVERSION.ntg.map(row => (
                <div key={row.tier}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold">{row.tier}</span>
                    <span className="font-mono">{money(row.amount)} ({row.pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div className={`${row.color} rounded-full h-4`} style={{ width: `${row.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* NIAA */}
          <div className="border-4 border-bauhaus-black rounded-sm p-5">
            <h3 className="text-sm font-black text-bauhaus-black uppercase tracking-wider mb-3">NIAA (Federal) — {money(totalNiaa)}</h3>
            <div className="space-y-3">
              {FUNDING_INVERSION.niaa.map(row => (
                <div key={row.tier}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold">{row.tier}</span>
                    <span className="font-mono">{money(row.amount)} ({row.pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div className={`${row.color} rounded-full h-4`} style={{ width: `${row.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[10px] text-gray-500 italic">
              NIAA has a better balance — 35% prevention vs NTG&apos;s 9%
            </div>
          </div>
        </div>

        {/* The cost of inversion */}
        <div className="bg-gray-900 text-white rounded-xl p-6">
          <h3 className="text-sm font-black uppercase tracking-wider mb-3">The Cost of Getting It Backwards</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="border-l-4 border-red-500 pl-3">
              <div className="text-2xl font-black text-red-400">$15.2B</div>
              <div className="text-xs text-gray-400">Annual cost of late intervention across Australia</div>
              <div className="text-[10px] text-gray-500 mt-1">Telethon Kids / Minderoo</div>
            </div>
            <div className="border-l-4 border-emerald-500 pl-3">
              <div className="text-2xl font-black text-emerald-400">$2 saved</div>
              <div className="text-xs text-gray-400">For every $1 spent on early intervention</div>
              <div className="text-[10px] text-gray-500 mt-1">Social Ventures Australia</div>
            </div>
            <div className="border-l-4 border-amber-500 pl-3">
              <div className="text-2xl font-black text-amber-400">7:1</div>
              <div className="text-xs text-gray-400">Return on early intervention (UK evidence)</div>
              <div className="text-[10px] text-gray-500 mt-1">UK National Children&apos;s Bureau</div>
            </div>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">
            Alice Springs spends {money(FUNDING_INVERSION.ntg[0].amount)} on reactive services and {money(FUNDING_INVERSION.ntg[2].amount)} on prevention.
            If just 10% of reactive spend was redirected to prevention, that&apos;s {money(FUNDING_INVERSION.ntg[0].amount * 0.1)} —
            more than the entire current prevention budget — with a projected 2:1 return within 10 years.
          </p>
        </div>
      </section>

      {/* ━━━━ NT Outcomes Context ━━━━ */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-black pb-2">
          NT Youth Justice Outcomes
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">Territory-wide data from AIHW and ROGS. Alice Springs is the NT&apos;s largest youth justice hub.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { name: 'avg_daily_detention', label: 'Avg daily detention', suffix: '' },
            { name: 'detention_rate_per_10k', label: 'Detention rate per 10K', suffix: '' },
            { name: 'indigenous_overrepresentation_ratio', label: 'Indigenous overrep.', suffix: 'x' },
            { name: 'pct_unsentenced', label: 'Unsentenced (remand)', suffix: '%' },
            { name: 'cost_per_day_detention', label: 'Cost/day detention', prefix: '$', suffix: '' },
          ].map(stat => {
            const val = m(stat.name);
            return (
              <div key={stat.name} className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                <div className="text-xl font-black text-gray-800">
                  {val !== null ? `${stat.prefix || ''}${val.toLocaleString()}${stat.suffix}` : '—'}
                </div>
                <div className="text-[10px] text-gray-500 mt-1">{stat.label}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ━━━━ The Intervention Spectrum ━━━━ */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-black pb-2">
          What Exists: {data.almaCount} Interventions
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6">
          From the Australian Living Map of Alternatives (ALMA) — community programs operating in Alice Springs with documented evidence.
        </p>

        {Object.entries(byType).map(([type, interventions]) => {
          const typeInfo = INTERVENTION_TYPES[type] || { label: type, color: 'bg-gray-100 text-gray-600' };
          return (
            <div key={type} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${typeInfo.color}`}>{typeInfo.label}</span>
                <span className="text-xs text-gray-400">{interventions.length} program{interventions.length > 1 ? 's' : ''}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {interventions.map(a => (
                  <div key={a.name} className="border border-gray-200 rounded-lg p-4 hover:border-bauhaus-blue transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="font-bold text-sm leading-tight">{a.name}</span>
                      {a.gs_entity_id && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold shrink-0">Linked</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {evidenceTag(a.evidence_level)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* ━━━━ What the Reports Recommend ━━━━ */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-black pb-2">
          What Every Report Recommends
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          6 priority reforms from the Alice Springs Youth Services Mapping Project (2022).
          Every review reaches the same conclusions — the system needs to shift from reactive to preventive.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { num: 1, title: 'Shift to Prevention', desc: 'Redirect funding from reactive crisis services to prevention and early intervention. The evidence is overwhelming.' },
            { num: 2, title: 'Support ACCOs', desc: 'Community-controlled organisations deliver culturally safe services. Fund them properly with flexible, long-term contracts.' },
            { num: 3, title: 'Person-Centred Coordination', desc: 'Follow the young person across service silos. Collaborative case management, not fragmented referrals.' },
            { num: 4, title: 'Place-Based Design', desc: 'Services designed locally, not imported from interstate. Alice Springs is not Sydney. Cultural authority matters.' },
            { num: 5, title: 'Relational Contracting', desc: 'Multi-year, outcome-focused contracts that allow adaptation. Stop the annual funding cliff that destroys continuity.' },
            { num: 6, title: 'Data & Accountability', desc: 'Track outcomes by wellbeing domains (ARACY Nest), not service outputs. Make the funding inversion visible.' },
          ].map(r => (
            <div key={r.num} className="border-2 border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg font-black text-bauhaus-red">{r.num}</span>
                <span className="font-black text-sm uppercase tracking-wider">{r.title}</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ━━━━ Data Sources ━━━━ */}
      <section className="mb-10">
        <div className="bg-gray-50 border border-gray-200 rounded-sm p-6">
          <h3 className="font-black text-sm uppercase tracking-wider mb-3">Data Sources</h3>
          <ul className="text-sm text-gray-600 space-y-1.5 list-disc pl-5">
            <li>Alice Springs Youth Services Mapping Project Report — CM&C + NIAA (March 2022)</li>
            <li>Mparntwe/Alice Springs Youth Action Plan 2023-2027 — Local Action Group / TFHC</li>
            <li>NT Youth Strategy 2023-2033 — Territory Families, Housing and Communities</li>
            <li>Alice Springs Youth Activities 2024-25 Grant Guidelines — TFHC</li>
            <li>Australian Living Map of Alternatives (ALMA) — JusticeHub evidence database</li>
            <li>AIHW Youth Justice in Australia 2023-24</li>
            <li>Productivity Commission ROGS 2026</li>
            <li>Telethon Kids Institute / Minderoo Foundation — Early Years Initiative</li>
            <li>Social Ventures Australia — Investment analysis of early intervention</li>
          </ul>
          <p className="text-xs text-gray-400 mt-4">
            This is a place-based accountability page. All data is sourced from public datasets and published reports.
            Intervention data from CivicGraph&apos;s ALMA database.
          </p>
        </div>
      </section>

      {/* Graph Link */}
      <section className="mb-12">
        <div className="bg-bauhaus-black text-white rounded-xl p-6 flex items-center justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Network Graph</div>
            <div className="text-lg font-black">Alice Springs Youth Services Network</div>
            <p className="text-sm text-gray-400 mt-1">Explore service providers, funding flows, and evidence links</p>
          </div>
          <Link
            href="/graph?preset=NT%20Youth%20Justice"
            className="bg-bauhaus-red text-white font-black uppercase tracking-wider text-sm px-5 py-3 rounded hover:bg-red-700 transition-colors whitespace-nowrap"
          >
            Open Graph
          </Link>
        </div>
      </section>
    </div>
  );
}

import type { Metadata } from 'next';
import { getServiceSupabase } from '@/lib/supabase';
import Link from 'next/link';
import { money } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Foundation Intelligence | CivicGraph',
  description: 'Browse 2,400+ Australian foundations scored on transparency, need alignment, evidence backing, and geographic reach.',
};

interface Foundation {
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
  community_controlled_grantees: number;
  states_funded: number;
}

async function getData(search?: string, sort?: string) {
  const supabase = getServiceSupabase();

  let query = supabase
    .from('mv_foundation_scores')
    .select('foundation_id, name, acnc_abn, total_giving_annual, type, parent_company, transparency_score, need_alignment_score, evidence_score, concentration_score, foundation_score, grantee_count, community_controlled_grantees, states_funded');

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const sortCol = sort === 'giving' ? 'total_giving_annual'
    : sort === 'transparency' ? 'transparency_score'
    : sort === 'evidence' ? 'evidence_score'
    : sort === 'need' ? 'need_alignment_score'
    : 'foundation_score';

  query = query.order(sortCol, { ascending: false }).limit(200);

  const { data, error } = await query;
  if (error) return [];
  return (data || []) as Foundation[];
}

function ScorePill({ score, color }: { score: number; color: string }) {
  return (
    <span className={`inline-block w-8 text-center text-[10px] font-black py-0.5 rounded ${color}`}>
      {score}
    </span>
  );
}

export default async function FoundationIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const foundations = await getData(params.q, params.sort);

  const sorts = [
    { key: 'score', label: 'Score' },
    { key: 'giving', label: 'Giving' },
    { key: 'transparency', label: 'Transparency' },
    { key: 'evidence', label: 'Evidence' },
    { key: 'need', label: 'Need Alignment' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-bauhaus-black uppercase tracking-widest mb-2">
          Foundation Intelligence
        </h1>
        <p className="text-sm text-bauhaus-muted max-w-2xl">
          {foundations.length} Australian foundations scored across transparency, need alignment,
          evidence backing, and geographic reach.
        </p>
      </div>

      {/* Search + Sort */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <form className="flex-1 min-w-[200px]">
          <input
            type="text"
            name="q"
            defaultValue={params.q || ''}
            placeholder="Search foundations..."
            className="w-full px-4 py-2 border-4 border-bauhaus-black text-sm font-bold focus:outline-none focus:border-bauhaus-blue"
          />
          {params.sort && <input type="hidden" name="sort" value={params.sort} />}
        </form>
        <div className="flex gap-1">
          {sorts.map((s) => {
            const active = (params.sort || 'score') === s.key;
            const qParam = params.q ? `&q=${encodeURIComponent(params.q)}` : '';
            return (
              <Link
                key={s.key}
                href={`/foundation?sort=${s.key}${qParam}`}
                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border-2 transition-colors ${
                  active
                    ? 'bg-bauhaus-black text-white border-bauhaus-black'
                    : 'bg-white text-bauhaus-black border-bauhaus-black/20 hover:border-bauhaus-black'
                }`}
              >
                {s.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Foundation Table */}
      <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bauhaus-black text-white">
              <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Foundation</th>
              <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Giving</th>
              <th className="text-center p-3 font-black uppercase tracking-widest text-[10px] hidden md:table-cell">T</th>
              <th className="text-center p-3 font-black uppercase tracking-widest text-[10px] hidden md:table-cell">N</th>
              <th className="text-center p-3 font-black uppercase tracking-widest text-[10px] hidden md:table-cell">E</th>
              <th className="text-center p-3 font-black uppercase tracking-widest text-[10px] hidden md:table-cell">G</th>
              <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Score</th>
              <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Grantees</th>
            </tr>
          </thead>
          <tbody>
            {foundations.map((f, i) => (
              <tr key={f.foundation_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="p-3">
                  <Link href={`/foundation/${f.acnc_abn}`} className="font-bold text-bauhaus-black hover:text-bauhaus-red">
                    {f.name}
                  </Link>
                  <div className="flex gap-1.5 mt-0.5">
                    {f.type && (
                      <span className="text-[9px] font-bold text-bauhaus-muted">{f.type.replace(/_/g, ' ')}</span>
                    )}
                    {f.community_controlled_grantees > 0 && (
                      <span className="text-[9px] font-black text-green-700">CC:{f.community_controlled_grantees}</span>
                    )}
                  </div>
                </td>
                <td className="p-3 text-right font-mono font-bold hidden sm:table-cell">
                  {Number(f.total_giving_annual) > 0 ? money(Number(f.total_giving_annual)) : '—'}
                </td>
                <td className="p-3 text-center hidden md:table-cell">
                  <ScorePill score={f.transparency_score} color="bg-blue-100 text-blue-800" />
                </td>
                <td className="p-3 text-center hidden md:table-cell">
                  <ScorePill score={f.need_alignment_score} color="bg-amber-100 text-amber-800" />
                </td>
                <td className="p-3 text-center hidden md:table-cell">
                  <ScorePill score={f.evidence_score} color="bg-teal-100 text-teal-800" />
                </td>
                <td className="p-3 text-center hidden md:table-cell">
                  <ScorePill score={f.concentration_score} color="bg-purple-100 text-purple-800" />
                </td>
                <td className="p-3 text-right">
                  <span className="font-black text-lg">{f.foundation_score}</span>
                </td>
                <td className="p-3 text-right font-mono hidden sm:table-cell">{f.grantee_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {foundations.length === 0 && (
        <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-12 text-center">
          <div className="text-lg font-black text-bauhaus-muted">No foundations found</div>
          <Link href="/foundation" className="text-sm text-bauhaus-blue hover:text-bauhaus-red mt-2 inline-block">
            Clear search
          </Link>
        </div>
      )}

      {/* Legend + CTA */}
      <div className="mt-6 flex flex-wrap gap-6 items-center justify-between">
        <div className="flex flex-wrap gap-3 text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">
          <span>T = Transparency</span>
          <span>N = Need Alignment</span>
          <span>E = Evidence</span>
          <span>G = Geographic Reach</span>
        </div>
        <Link
          href="/reports/philanthropy"
          className="px-4 py-2 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-red transition-colors"
        >
          Full Report
        </Link>
      </div>
    </div>
  );
}

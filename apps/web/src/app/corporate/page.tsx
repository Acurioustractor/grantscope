import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface CorporateFoundation {
  id: string;
  name: string;
  parent_company: string | null;
  asx_code: string | null;
  total_giving_annual: number | null;
  giving_ratio: number | null;
  revenue_sources: string[];
  thematic_focus: string[];
}

function formatMoney(amount: number | null): string {
  if (!amount) return '\u2014';
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

export default async function CorporatePage() {
  const supabase = getServiceSupabase();

  const { data: foundations, count } = await supabase
    .from('foundations')
    .select('id, name, parent_company, asx_code, total_giving_annual, giving_ratio, revenue_sources, thematic_focus', { count: 'exact' })
    .eq('type', 'corporate_foundation')
    .order('total_giving_annual', { ascending: false, nullsFirst: false })
    .limit(100);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-navy-900 mb-2">Corporate Giving Transparency</h1>
        <p className="text-navy-500">
          How much do Australia&apos;s biggest companies give back? {count || 0} corporate foundations tracked.
        </p>
      </div>

      <div className="bg-warning-light border border-amber-300 rounded-lg p-4 mb-6">
        <div className="font-semibold text-sm text-navy-900">Phase E — Coming Soon</div>
        <p className="text-sm text-navy-600 mt-1">
          We&apos;re building ASX200 company-to-foundation mapping, sustainability report scraping,
          and revenue-vs-giving ratio calculations. The data below is from ACNC foundations
          identified as corporate foundations.
        </p>
      </div>

      {(foundations as CorporateFoundation[] || []).length > 0 ? (
        <div className="bg-white border border-navy-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-navy-200 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Foundation</th>
                  <th className="px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Parent</th>
                  <th className="px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">ASX</th>
                  <th className="px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider text-right">Annual Giving</th>
                  <th className="px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider text-right">Giving Ratio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {(foundations as CorporateFoundation[]).map(f => (
                  <tr key={f.id} className="hover:bg-navy-50 transition-colors">
                    <td className="px-4 py-3">
                      <a href={`/foundations/${f.id}`} className="text-link hover:underline font-medium text-sm">{f.name}</a>
                    </td>
                    <td className="px-4 py-3 text-sm text-navy-500">{f.parent_company || '\u2014'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-navy-500">{f.asx_code || '\u2014'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-money text-sm tabular-nums">{formatMoney(f.total_giving_annual)}</td>
                    <td className={`px-4 py-3 text-right font-semibold text-sm tabular-nums ${f.giving_ratio ? 'text-link' : 'text-navy-300'}`}>
                      {f.giving_ratio ? `${f.giving_ratio}%` : '\u2014'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 text-navy-400">
          <p className="text-lg">No corporate foundations loaded yet.</p>
          <p className="text-sm mt-1">Run the ACNC import to populate foundation data.</p>
        </div>
      )}
    </div>
  );
}

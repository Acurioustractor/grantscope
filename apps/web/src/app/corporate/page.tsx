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
        <p className="text-xs font-black text-bauhaus-yellow uppercase tracking-[0.3em] mb-2">Directory</p>
        <h1 className="text-3xl font-black text-bauhaus-black mb-2">Corporate Giving Transparency</h1>
        <p className="text-bauhaus-muted font-medium">
          How much do Australia&apos;s biggest companies give back? {count || 0} corporate foundations tracked.
        </p>
      </div>

      <div className="bg-bauhaus-yellow border-4 border-bauhaus-black p-4 mb-6 bauhaus-shadow-sm">
        <div className="font-black text-sm text-bauhaus-black uppercase tracking-widest">Phase E — Coming Soon</div>
        <p className="text-sm text-bauhaus-black/70 mt-1 font-medium">
          We&apos;re building ASX200 company-to-foundation mapping, sustainability report scraping,
          and revenue-vs-giving ratio calculations. The data below is from ACNC foundations
          identified as corporate foundations.
        </p>
      </div>

      {(foundations as CorporateFoundation[] || []).length > 0 ? (
        <div className="bg-white border-4 border-bauhaus-black overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white text-left">
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-widest">Foundation</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-widest">Parent</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-widest">ASX</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-widest text-right">Annual Giving</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-widest text-right">Giving Ratio</th>
                </tr>
              </thead>
              <tbody>
                {(foundations as CorporateFoundation[]).map(f => (
                  <tr key={f.id} className="border-b-2 border-bauhaus-black/20 hover:bg-bauhaus-canvas transition-colors">
                    <td className="px-4 py-3">
                      <a href={`/foundations/${f.id}`} className="text-bauhaus-blue hover:text-bauhaus-red font-bold text-sm">{f.name}</a>
                    </td>
                    <td className="px-4 py-3 text-sm text-bauhaus-muted font-medium">{f.parent_company || '\u2014'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-bauhaus-muted font-bold">{f.asx_code || '\u2014'}</td>
                    <td className="px-4 py-3 text-right font-black text-money text-sm tabular-nums">{formatMoney(f.total_giving_annual)}</td>
                    <td className={`px-4 py-3 text-right font-black text-sm tabular-nums ${f.giving_ratio ? 'text-bauhaus-blue' : 'text-bauhaus-muted/30'}`}>
                      {f.giving_ratio ? `${f.giving_ratio}%` : '\u2014'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 text-bauhaus-muted border-4 border-bauhaus-black bg-white">
          <p className="text-lg font-black uppercase">No corporate foundations loaded yet.</p>
          <p className="text-sm mt-1">Run the ACNC import to populate foundation data.</p>
        </div>
      )}
    </div>
  );
}

import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface FoundationRow {
  id: string;
  name: string;
  type: string | null;
  website: string | null;
  description: string | null;
  total_giving_annual: number | null;
  thematic_focus: string[];
  geographic_focus: string[];
  profile_confidence: string;
  enriched_at: string | null;
}

function formatGiving(amount: number | null): string {
  if (!amount) return 'Unknown';
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

function typeLabel(type: string | null): string {
  const labels: Record<string, string> = {
    private_ancillary_fund: 'Private Ancillary Fund',
    public_ancillary_fund: 'Public Ancillary Fund',
    trust: 'Trust',
    corporate_foundation: 'Corporate Foundation',
  };
  return type ? labels[type] || type : 'Foundation';
}

export default async function FoundationsPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; focus?: string; profiled?: string; page?: string }> }) {
  const params = await searchParams;
  const query = params.q || '';
  const typeFilter = params.type || '';
  const focusFilter = params.focus || '';
  const profiledOnly = params.profiled === '1';
  const page = parseInt(params.page || '1', 10);
  const pageSize = 25;
  const offset = (page - 1) * pageSize;

  const supabase = getServiceSupabase();
  let dbQuery = supabase
    .from('foundations')
    .select('id, name, type, website, description, total_giving_annual, thematic_focus, geographic_focus, profile_confidence, enriched_at', { count: 'exact' });

  if (query) {
    dbQuery = dbQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
  }
  if (typeFilter) {
    dbQuery = dbQuery.eq('type', typeFilter);
  }
  if (focusFilter) {
    dbQuery = dbQuery.contains('thematic_focus', [focusFilter]);
  }
  if (profiledOnly) {
    dbQuery = dbQuery.not('enriched_at', 'is', null);
  }

  dbQuery = dbQuery
    .order('total_giving_annual', { ascending: false, nullsFirst: false })
    .range(offset, offset + pageSize - 1);

  const { data: foundations, count } = await dbQuery;
  const totalPages = Math.ceil((count || 0) / pageSize);

  const types = ['private_ancillary_fund', 'public_ancillary_fund', 'trust', 'corporate_foundation'];
  const focuses = ['arts', 'indigenous', 'health', 'education', 'community', 'environment', 'research'];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-navy-900 mb-2">Australian Foundations</h1>
        <p className="text-navy-500">{(count || 0).toLocaleString()} foundations, trusts, and ancillary funds from the ACNC register</p>
      </div>

      <form method="get" className="flex flex-col sm:flex-row gap-2 mb-6 flex-wrap">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search foundations..."
          className="flex-1 min-w-[200px] px-4 py-2.5 border border-navy-200 rounded-lg text-sm focus:border-link focus:outline-none bg-white"
        />
        <select name="type" defaultValue={typeFilter} className="px-4 py-2.5 border border-navy-200 rounded-lg text-sm bg-white focus:border-link focus:outline-none">
          <option value="">All types</option>
          {types.map(t => (
            <option key={t} value={t}>{typeLabel(t)}</option>
          ))}
        </select>
        <select name="focus" defaultValue={focusFilter} className="px-4 py-2.5 border border-navy-200 rounded-lg text-sm bg-white focus:border-link focus:outline-none">
          <option value="">All focus areas</option>
          {focuses.map(f => (
            <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-navy-600 cursor-pointer px-2">
          <input type="checkbox" name="profiled" value="1" defaultChecked={profiledOnly} className="rounded" />
          Profiled only
        </label>
        <button type="submit" className="px-5 py-2.5 bg-navy-900 text-white text-sm font-medium rounded-lg hover:bg-navy-800 transition-colors cursor-pointer">
          Filter
        </button>
      </form>

      <div className="space-y-3">
        {(foundations as FoundationRow[] || []).map((f) => (
          <a key={f.id} href={`/foundations/${f.id}`} className="block group">
            <div className="bg-white border border-navy-200 rounded-lg p-4 sm:px-5 transition-all group-hover:border-navy-300 group-hover:shadow-sm">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-navy-900 text-[15px] group-hover:text-link transition-colors">{f.name}</h3>
                  <div className="text-sm text-navy-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{typeLabel(f.type)}</span>
                    {f.enriched_at && (
                      <span className={`text-[11px] px-1.5 py-0.5 rounded ${
                        f.profile_confidence === 'high' ? 'bg-money-light text-money' :
                        f.profile_confidence === 'medium' ? 'bg-warning-light text-warning' :
                        'bg-navy-100 text-navy-500'
                      }`}>
                        {f.profile_confidence} profile
                      </span>
                    )}
                  </div>
                  {f.description && (
                    <div className="text-sm text-navy-400 mt-1 line-clamp-2">
                      {f.description}
                    </div>
                  )}
                </div>
                <div className="sm:text-right sm:ml-4 flex-shrink-0">
                  <div className="text-base font-bold text-money tabular-nums">
                    {formatGiving(f.total_giving_annual)}/yr
                  </div>
                </div>
              </div>
              {(f.thematic_focus?.length > 0 || f.geographic_focus?.length > 0) && (
                <div className="flex gap-1.5 mt-2.5 flex-wrap">
                  {f.thematic_focus?.map(t => (
                    <span key={t} className="text-[11px] px-2 py-0.5 bg-money-light text-money rounded">{t}</span>
                  ))}
                  {f.geographic_focus?.map(g => (
                    <span key={g} className="text-[11px] px-2 py-0.5 bg-navy-100 text-navy-600 rounded">{g}</span>
                  ))}
                </div>
              )}
            </div>
          </a>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-8">
          {page > 1 && (
            <a href={`/foundations?q=${query}&type=${typeFilter}&focus=${focusFilter}${profiledOnly ? '&profiled=1' : ''}&page=${page - 1}`} className="px-4 py-2 text-sm border border-navy-200 rounded-lg text-navy-600 hover:bg-navy-100 transition-colors">
              Previous
            </a>
          )}
          <span className="px-4 py-2 text-sm text-navy-500">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <a href={`/foundations?q=${query}&type=${typeFilter}&focus=${focusFilter}${profiledOnly ? '&profiled=1' : ''}&page=${page + 1}`} className="px-4 py-2 text-sm border border-navy-200 rounded-lg text-navy-600 hover:bg-navy-100 transition-colors">
              Next
            </a>
          )}
        </div>
      )}
    </div>
  );
}

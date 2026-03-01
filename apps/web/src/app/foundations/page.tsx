import { getServiceSupabase } from '@/lib/supabase';
import { FilterBar } from '../components/filter-bar';

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

const STATES = [
  { value: 'AU-National', label: 'National' },
  { value: 'AU-QLD', label: 'Queensland' },
  { value: 'AU-NSW', label: 'New South Wales' },
  { value: 'AU-VIC', label: 'Victoria' },
  { value: 'AU-WA', label: 'Western Australia' },
  { value: 'AU-SA', label: 'South Australia' },
  { value: 'AU-TAS', label: 'Tasmania' },
  { value: 'AU-ACT', label: 'ACT' },
  { value: 'AU-NT', label: 'Northern Territory' },
];

interface SearchParams {
  q?: string;
  type?: string;
  focus?: string;
  profiled?: string;
  page?: string;
  sort?: string;
  geo?: string;
  giving_min?: string;
  giving_max?: string;
}

export default async function FoundationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = params.q || '';
  const typeFilter = params.type || '';
  const focusFilter = params.focus || '';
  const profiledOnly = params.profiled === '1';
  const sortBy = params.sort || 'giving';
  const geoFilter = params.geo || '';
  const givingMin = params.giving_min ? parseInt(params.giving_min, 10) : null;
  const givingMax = params.giving_max ? parseInt(params.giving_max, 10) : null;
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
  if (geoFilter) {
    dbQuery = dbQuery.contains('geographic_focus', [geoFilter]);
  }
  if (givingMin) {
    dbQuery = dbQuery.gte('total_giving_annual', givingMin);
  }
  if (givingMax) {
    dbQuery = dbQuery.lte('total_giving_annual', givingMax);
  }

  // Sort
  if (sortBy === 'profiled') {
    dbQuery = dbQuery.order('enriched_at', { ascending: false, nullsFirst: false });
  } else if (sortBy === 'name') {
    dbQuery = dbQuery.order('name', { ascending: true });
  } else {
    dbQuery = dbQuery.order('total_giving_annual', { ascending: false, nullsFirst: false });
  }

  dbQuery = dbQuery.range(offset, offset + pageSize - 1);

  const { data: foundations, count } = await dbQuery;
  const totalPages = Math.ceil((count || 0) / pageSize);

  const types = ['private_ancillary_fund', 'public_ancillary_fund', 'trust', 'corporate_foundation'];
  const focuses = ['arts', 'indigenous', 'health', 'education', 'community', 'environment', 'research'];
  const sortOptions = [
    { value: 'giving', label: 'Highest Giving' },
    { value: 'profiled', label: 'Recently Profiled' },
    { value: 'name', label: 'Name A-Z' },
  ];

  // Build filter query string for pagination
  const filterParams = new URLSearchParams();
  if (query) filterParams.set('q', query);
  if (typeFilter) filterParams.set('type', typeFilter);
  if (focusFilter) filterParams.set('focus', focusFilter);
  if (profiledOnly) filterParams.set('profiled', '1');
  if (sortBy !== 'giving') filterParams.set('sort', sortBy);
  if (geoFilter) filterParams.set('geo', geoFilter);
  if (givingMin) filterParams.set('giving_min', String(givingMin));
  if (givingMax) filterParams.set('giving_max', String(givingMax));
  const filterQS = filterParams.toString();

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-2">Directory</p>
        <h1 className="text-3xl font-black text-bauhaus-black mb-2">Australian Foundations</h1>
        <p className="text-bauhaus-muted font-medium">{(count || 0).toLocaleString()} foundations, trusts, and ancillary funds from the ACNC register</p>
      </div>

      <form method="get" className="flex flex-col sm:flex-row gap-0 mb-4 flex-wrap">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search foundations..."
          className="flex-1 min-w-[200px] px-4 py-2.5 border-4 border-bauhaus-black text-sm font-bold bg-white focus:bg-bauhaus-yellow focus:outline-none"
        />
        <select name="type" defaultValue={typeFilter} className="px-4 py-2.5 border-4 border-l-0 border-bauhaus-black text-sm font-bold bg-white focus:outline-none">
          <option value="">All types</option>
          {types.map(t => (
            <option key={t} value={t}>{typeLabel(t)}</option>
          ))}
        </select>
        <select name="focus" defaultValue={focusFilter} className="px-4 py-2.5 border-4 border-l-0 border-bauhaus-black text-sm font-bold bg-white focus:outline-none">
          <option value="">All focus areas</option>
          {focuses.map(f => (
            <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
          ))}
        </select>
        <select name="sort" defaultValue={sortBy} className="px-4 py-2.5 border-4 border-l-0 border-bauhaus-black text-sm font-bold bg-white focus:outline-none">
          {sortOptions.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs font-black text-bauhaus-black cursor-pointer px-4 py-2.5 border-4 border-l-0 border-bauhaus-black bg-white uppercase tracking-wider">
          <input type="checkbox" name="profiled" value="1" defaultChecked={profiledOnly} className="accent-bauhaus-red" />
          Profiled
        </label>
        <button type="submit" className="px-5 py-2.5 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-red cursor-pointer border-4 border-bauhaus-black">
          Filter
        </button>
      </form>

      {/* Additional filters */}
      <FilterBar>
        <form method="get" className="flex flex-col sm:flex-row gap-0 border-4 border-bauhaus-black bg-white">
          {query && <input type="hidden" name="q" value={query} />}
          {typeFilter && <input type="hidden" name="type" value={typeFilter} />}
          {focusFilter && <input type="hidden" name="focus" value={focusFilter} />}
          {profiledOnly && <input type="hidden" name="profiled" value="1" />}
          {sortBy !== 'giving' && <input type="hidden" name="sort" value={sortBy} />}
          <div className="flex items-center px-3 py-2 border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
            <span className="text-[11px] font-black text-bauhaus-muted uppercase tracking-wider mr-2 whitespace-nowrap">Annual Giving</span>
            <input
              type="number"
              name="giving_min"
              defaultValue={givingMin || ''}
              placeholder="Min $"
              className="w-20 px-2 py-1 text-xs font-bold border-2 border-bauhaus-black/20 bg-bauhaus-canvas focus:outline-none tabular-nums"
            />
            <span className="mx-1 text-bauhaus-muted">–</span>
            <input
              type="number"
              name="giving_max"
              defaultValue={givingMax || ''}
              placeholder="Max $"
              className="w-20 px-2 py-1 text-xs font-bold border-2 border-bauhaus-black/20 bg-bauhaus-canvas focus:outline-none tabular-nums"
            />
          </div>
          <div className="flex items-center px-3 py-2 border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
            <span className="text-[11px] font-black text-bauhaus-muted uppercase tracking-wider mr-2">State</span>
            <select name="geo" defaultValue={geoFilter} className="text-xs font-bold bg-bauhaus-canvas border-2 border-bauhaus-black/20 px-2 py-1 focus:outline-none">
              <option value="">All</option>
              {STATES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="px-4 py-2 bg-bauhaus-black text-white text-[11px] font-black uppercase tracking-widest hover:bg-bauhaus-red cursor-pointer">
            Apply
          </button>
        </form>
      </FilterBar>

      <div className="space-y-3">
        {(foundations as FoundationRow[] || []).map((f) => (
          <a key={f.id} href={`/foundations/${f.id}`} className="block group">
            <div className="bg-white border-4 border-bauhaus-black p-4 sm:px-5 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-bauhaus-black text-[15px] group-hover:text-bauhaus-blue">{f.name}</h3>
                  <div className="text-sm text-bauhaus-muted mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="font-bold">{typeLabel(f.type)}</span>
                    {f.enriched_at && (
                      <span className={`text-[11px] px-1.5 py-0.5 font-black uppercase tracking-wider border-2 ${
                        f.profile_confidence === 'high' ? 'border-money bg-money-light text-money' :
                        f.profile_confidence === 'medium' ? 'border-bauhaus-yellow bg-warning-light text-bauhaus-black' :
                        'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted'
                      }`}>
                        {f.profile_confidence}
                      </span>
                    )}
                  </div>
                  {f.description && (
                    <div className="text-sm text-bauhaus-muted mt-1 line-clamp-2">
                      {f.description}
                    </div>
                  )}
                </div>
                <div className="sm:text-right sm:ml-4 flex-shrink-0">
                  <div className="text-base font-black text-money tabular-nums">
                    {formatGiving(f.total_giving_annual)}/yr
                  </div>
                </div>
              </div>
              {(f.thematic_focus?.length > 0 || f.geographic_focus?.length > 0) && (
                <div className="flex gap-1.5 mt-2.5 flex-wrap">
                  {f.thematic_focus?.map(t => (
                    <span key={t} className="text-[11px] px-2 py-0.5 bg-money-light text-money font-bold border-2 border-money/20">{t}</span>
                  ))}
                  {f.geographic_focus?.map(g => (
                    <span key={g} className="text-[11px] px-2 py-0.5 bg-bauhaus-canvas text-bauhaus-black font-bold border-2 border-bauhaus-black/20">{g}</span>
                  ))}
                </div>
              )}
            </div>
          </a>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-0 mt-8">
          {page > 1 && (
            <a href={`/foundations?${filterQS}&page=${page - 1}`} className="px-4 py-2 text-xs font-black uppercase tracking-widest border-4 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white">
              Previous
            </a>
          )}
          <span className="px-4 py-2 text-xs font-black uppercase tracking-widest border-4 border-l-0 border-bauhaus-black bg-bauhaus-canvas">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <a href={`/foundations?${filterQS}&page=${page + 1}`} className="px-4 py-2 text-xs font-black uppercase tracking-widest border-4 border-l-0 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white">
              Next
            </a>
          )}
        </div>
      )}
    </div>
  );
}

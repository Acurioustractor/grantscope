import { getServiceSupabase } from '@/lib/supabase';
import { searchGrantsSemantic } from '@grantscope/engine/src/embeddings.js';
import { FilterBar } from '../components/filter-bar';

export const dynamic = 'force-dynamic';

interface Grant {
  id: string;
  name: string;
  provider: string;
  program: string | null;
  amount_min: number | null;
  amount_max: number | null;
  closes_at: string | null;
  url: string | null;
  categories: string[];
  status: string;
  sources: unknown;
  similarity?: number;
}

function formatAmount(min: number | null, max: number | null): string {
  if (min && max) return `$${min.toLocaleString()} – $${max.toLocaleString()}`;
  if (max) return `Up to $${max.toLocaleString()}`;
  if (min) return `From $${min.toLocaleString()}`;
  return 'Amount not specified';
}

function formatDate(date: string | null): string {
  if (!date) return 'Ongoing';
  return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
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
  category?: string;
  page?: string;
  type?: string;
  mode?: string;
  amount_min?: string;
  amount_max?: string;
  geo?: string;
  closing?: string;
}

export default async function GrantsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = params.q || '';
  const category = params.category || '';
  const grantType = params.type || 'open_opportunity';
  const searchMode = params.mode || 'keyword';
  const amountMin = params.amount_min ? parseInt(params.amount_min, 10) : null;
  const amountMax = params.amount_max ? parseInt(params.amount_max, 10) : null;
  const geoFilter = params.geo || '';
  const closingFilter = params.closing || '';
  const page = parseInt(params.page || '1', 10);
  const pageSize = 25;
  const offset = (page - 1) * pageSize;

  const supabase = getServiceSupabase();
  let grants: Grant[] = [];
  let count = 0;
  let usedSemantic = false;

  const forceSemantic = searchMode === 'ai';
  const shouldSemantic = forceSemantic || (query && (query.trim().split(/\s+/).length > 5 || query.includes('?')));

  if (query && shouldSemantic && process.env.OPENAI_API_KEY) {
    try {
      const results = await searchGrantsSemantic(supabase, query, {
        apiKey: process.env.OPENAI_API_KEY,
        matchThreshold: 0.65,
        matchCount: 50,
        category: category || undefined,
        grantType: grantType !== 'all' ? grantType : undefined,
      });

      grants = results.map(r => ({
        id: r.id,
        name: r.name,
        provider: r.provider,
        program: null,
        amount_min: r.amount_min,
        amount_max: r.amount_max,
        closes_at: r.closes_at,
        url: r.url,
        categories: r.categories || [],
        status: 'open',
        sources: null,
        similarity: r.similarity,
      }));

      // Apply client-side filters to semantic results
      // Exclude expired grants by default
      if (closingFilter !== 'all') {
        const now = new Date().toISOString();
        grants = grants.filter(g => !g.closes_at || g.closes_at > now);
      }
      if (amountMin) grants = grants.filter(g => (g.amount_max || 0) >= amountMin);
      if (amountMax) grants = grants.filter(g => (g.amount_min || 0) <= amountMax);
      if (closingFilter === '30') {
        const cutoff = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        grants = grants.filter(g => g.closes_at && g.closes_at <= cutoff);
      } else if (closingFilter === '90') {
        const cutoff = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
        grants = grants.filter(g => g.closes_at && g.closes_at <= cutoff);
      }

      count = grants.length;
      usedSemantic = true;
    } catch {
      usedSemantic = false;
    }
  }

  if (!usedSemantic) {
    let dbQuery = supabase
      .from('grant_opportunities')
      .select('*', { count: 'exact' });

    if (grantType !== 'all') {
      dbQuery = dbQuery.eq('grant_type', grantType);
    }

    if (query) {
      dbQuery = dbQuery.or(`name.ilike.%${query}%,provider.ilike.%${query}%`);
    }

    if (category) {
      dbQuery = dbQuery.contains('categories', [category]);
    }

    if (amountMin) {
      dbQuery = dbQuery.gte('amount_max', amountMin);
    }
    if (amountMax) {
      dbQuery = dbQuery.lte('amount_min', amountMax);
    }

    if (geoFilter) {
      dbQuery = dbQuery.contains('geography', [geoFilter]);
    }

    if (closingFilter === '30') {
      dbQuery = dbQuery.gt('closes_at', new Date().toISOString());
      dbQuery = dbQuery.lt('closes_at', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
    } else if (closingFilter === '90') {
      dbQuery = dbQuery.gt('closes_at', new Date().toISOString());
      dbQuery = dbQuery.lt('closes_at', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString());
    } else if (closingFilter !== 'all') {
      // Default: exclude expired grants (past close date)
      dbQuery = dbQuery.or(`closes_at.gt.${new Date().toISOString()},closes_at.is.null`);
    }

    dbQuery = dbQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    const result = await dbQuery;
    grants = (result.data || []) as Grant[];
    count = result.count || 0;
  }

  const totalPages = usedSemantic ? 1 : Math.ceil((count || 0) / pageSize);

  const categories = ['indigenous', 'arts', 'community', 'health', 'education', 'enterprise', 'regenerative', 'technology', 'justice'];
  const grantTypes = [
    { value: 'open_opportunity', label: 'Open Opportunities' },
    { value: 'historical_award', label: 'Historical Awards' },
    { value: 'all', label: 'All' },
  ];

  // Build filter query string for pagination
  const filterParams = new URLSearchParams();
  filterParams.set('type', grantType);
  if (query) filterParams.set('q', query);
  if (category) filterParams.set('category', category);
  if (searchMode !== 'keyword') filterParams.set('mode', searchMode);
  if (amountMin) filterParams.set('amount_min', String(amountMin));
  if (amountMax) filterParams.set('amount_max', String(amountMax));
  if (geoFilter) filterParams.set('geo', geoFilter);
  if (closingFilter) filterParams.set('closing', closingFilter);
  const filterQS = filterParams.toString();

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-black text-bauhaus-blue uppercase tracking-[0.3em] mb-2">Directory</p>
        <h1 className="text-3xl font-black text-bauhaus-black mb-2">Government Grants</h1>
        <p className="text-bauhaus-muted font-medium">
          {count.toLocaleString()} {grantType === 'historical_award' ? 'historical awards' : grantType === 'all' ? 'grants' : 'open opportunities'}
        </p>
      </div>

      <div className="flex gap-0 mb-6">
        {grantTypes.map(t => (
          <a
            key={t.value}
            href={`/grants?type=${t.value}&q=${query}&category=${category}&mode=${searchMode}`}
            className={`px-4 py-2 text-xs font-black uppercase tracking-widest border-4 border-r-0 last:border-r-4 border-bauhaus-black ${grantType === t.value ? 'bg-bauhaus-black text-white' : 'bg-white text-bauhaus-black hover:bg-bauhaus-canvas'}`}
          >
            {t.label}
          </a>
        ))}
      </div>

      {/* Search mode toggle + search bar */}
      <div className="flex gap-0 mb-0">
        <a
          href={`/grants?type=${grantType}&q=${query}&category=${category}&mode=keyword`}
          className={`px-4 py-2 text-[11px] font-black uppercase tracking-widest border-4 border-b-0 border-bauhaus-black ${searchMode !== 'ai' ? 'bg-bauhaus-black text-white' : 'bg-white text-bauhaus-black hover:bg-bauhaus-canvas'}`}
        >
          Keyword
        </a>
        <a
          href={`/grants?type=${grantType}&q=${query}&category=${category}&mode=ai`}
          className={`px-4 py-2 text-[11px] font-black uppercase tracking-widest border-4 border-b-0 border-l-0 border-bauhaus-black ${searchMode === 'ai' ? 'bg-bauhaus-blue text-white' : 'bg-white text-bauhaus-black hover:bg-bauhaus-canvas'}`}
        >
          AI Search
        </a>
      </div>

      <form method="get" className="flex flex-col sm:flex-row gap-0 mb-4">
        <input type="hidden" name="type" value={grantType} />
        <input type="hidden" name="mode" value={searchMode} />
        {amountMin && <input type="hidden" name="amount_min" value={amountMin} />}
        {amountMax && <input type="hidden" name="amount_max" value={amountMax} />}
        {geoFilter && <input type="hidden" name="geo" value={geoFilter} />}
        {closingFilter && <input type="hidden" name="closing" value={closingFilter} />}
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder={searchMode === 'ai' ? 'Describe what you need funding for...' : 'Search grants...'}
          className="flex-1 px-4 py-2.5 border-4 border-bauhaus-black text-sm font-bold bg-white focus:bg-bauhaus-yellow focus:outline-none uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal"
        />
        <select name="category" defaultValue={category} className="px-4 py-2.5 border-4 border-l-0 border-bauhaus-black text-sm font-bold bg-white focus:outline-none uppercase">
          <option value="">All categories</option>
          {categories.map(c => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
        <button type="submit" className="px-5 py-2.5 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-red cursor-pointer border-4 border-bauhaus-black">
          Search
        </button>
      </form>

      {/* Filters */}
      <FilterBar>
        <form method="get" className="flex flex-col sm:flex-row gap-0 border-4 border-bauhaus-black bg-white">
          <input type="hidden" name="type" value={grantType} />
          <input type="hidden" name="mode" value={searchMode} />
          {query && <input type="hidden" name="q" value={query} />}
          {category && <input type="hidden" name="category" value={category} />}
          <div className="flex items-center px-3 py-2 border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
            <span className="text-[11px] font-black text-bauhaus-muted uppercase tracking-wider mr-2 whitespace-nowrap">Amount</span>
            <input
              type="number"
              name="amount_min"
              defaultValue={amountMin || ''}
              placeholder="Min $"
              className="w-20 px-2 py-1 text-xs font-bold border-2 border-bauhaus-black/20 bg-bauhaus-canvas focus:outline-none tabular-nums"
            />
            <span className="mx-1 text-bauhaus-muted">–</span>
            <input
              type="number"
              name="amount_max"
              defaultValue={amountMax || ''}
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
          <div className="flex items-center px-3 py-2 border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black gap-1">
            <span className="text-[11px] font-black text-bauhaus-muted uppercase tracking-wider mr-1">Closing</span>
            {[{ v: '', label: 'Upcoming' }, { v: '30', label: '30 Days' }, { v: '90', label: '90 Days' }, { v: 'all', label: 'All' }].map(({ v, label }) => (
              <a
                key={v}
                href={`/grants?${new URLSearchParams({ type: grantType, mode: searchMode, ...(query ? { q: query } : {}), ...(category ? { category } : {}), ...(amountMin ? { amount_min: String(amountMin) } : {}), ...(amountMax ? { amount_max: String(amountMax) } : {}), ...(geoFilter ? { geo: geoFilter } : {}), closing: v }).toString()}`}
                className={`px-2 py-0.5 text-[11px] font-black uppercase tracking-wider border-2 border-bauhaus-black/20 ${closingFilter === v ? 'bg-bauhaus-black text-white border-bauhaus-black' : 'bg-bauhaus-canvas text-bauhaus-black hover:bg-bauhaus-black/10'}`}
              >
                {label}
              </a>
            ))}
          </div>
          <button type="submit" className="px-4 py-2 bg-bauhaus-black text-white text-[11px] font-black uppercase tracking-widest hover:bg-bauhaus-red cursor-pointer">
            Apply
          </button>
        </form>
      </FilterBar>

      {/* Semantic search banner */}
      {usedSemantic && (
        <div className="mb-4 p-3 bg-link-light border-4 border-bauhaus-blue">
          <span className="text-xs font-black text-bauhaus-blue uppercase tracking-wider">
            AI found {count} grants matching: &ldquo;{query}&rdquo;
          </span>
        </div>
      )}

      <div className="space-y-0">
        {grants.map((grant) => (
          <a
            key={grant.id}
            href={`/grants/${grant.id}`}
            className="block group"
          >
            <div className="bg-white border-4 border-b-0 border-bauhaus-black p-4 sm:px-5 transition-all group-hover:bg-bauhaus-blue group-hover:text-white last:border-b-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-bauhaus-black text-[15px] group-hover:text-white">{grant.name}</h3>
                  <div className="text-sm text-bauhaus-muted mt-0.5 group-hover:text-white/70">{grant.provider}</div>
                </div>
                <div className="sm:text-right sm:ml-4 flex-shrink-0">
                  <div className="text-sm font-black text-bauhaus-blue tabular-nums group-hover:text-bauhaus-yellow">
                    {formatAmount(grant.amount_min, grant.amount_max)}
                  </div>
                  <div className={`text-xs mt-0.5 font-bold ${grant.closes_at ? 'text-bauhaus-red' : 'text-bauhaus-muted'} group-hover:text-white/70`}>
                    {grant.closes_at ? `Closes ${formatDate(grant.closes_at)}` : 'Ongoing'}
                  </div>
                  {usedSemantic && grant.similarity != null && (
                    <div className="flex items-center gap-1.5 mt-1 justify-end">
                      <div className="w-16 h-1.5 bg-bauhaus-canvas border border-bauhaus-black/20 group-hover:border-white/30">
                        <div className="h-full bg-bauhaus-blue group-hover:bg-bauhaus-yellow" style={{ width: `${Math.round(grant.similarity * 100)}%` }}></div>
                      </div>
                      <span className="text-[10px] font-black text-bauhaus-muted group-hover:text-white/50 uppercase tracking-wider tabular-nums">
                        {Math.round(grant.similarity * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {grant.categories?.length > 0 && (
                <div className="flex gap-1.5 mt-2.5 flex-wrap">
                  {grant.categories.map(c => (
                    <span key={c} className="text-[11px] px-2 py-0.5 bg-bauhaus-canvas text-bauhaus-black font-black uppercase tracking-wider border-2 border-bauhaus-black/20 group-hover:bg-white/20 group-hover:text-white group-hover:border-white/30">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </a>
        ))}
        {grants.length > 0 && <div className="border-b-4 border-bauhaus-black -mt-0"></div>}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-0 mt-8">
          {page > 1 && (
            <a href={`/grants?${filterQS}&page=${page - 1}`} className="px-4 py-2 text-xs font-black uppercase tracking-widest border-4 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white">
              Previous
            </a>
          )}
          <span className="px-4 py-2 text-xs font-black uppercase tracking-widest border-4 border-l-0 border-bauhaus-black bg-bauhaus-canvas">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <a href={`/grants?${filterQS}&page=${page + 1}`} className="px-4 py-2 text-xs font-black uppercase tracking-widest border-4 border-l-0 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white">
              Next
            </a>
          )}
        </div>
      )}
    </div>
  );
}

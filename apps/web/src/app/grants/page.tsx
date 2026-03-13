import { getServiceSupabase } from '@/lib/supabase';
import { searchGrantsSemantic } from '@grant-engine/embeddings';
import { FilterBar } from '../components/filter-bar';
import { FundingIntelligenceRail } from '../components/funding-intelligence-rail';
import { ListPreviewProvider, GrantPreviewTrigger } from '../components/list-preview';
import { dedupeGrantList, sortGrantList, type GrantListItem } from './grant-list-utils';

export const dynamic = 'force-dynamic';

interface Grant extends GrantListItem {}

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

const GEO_SOURCE_MAP: Record<string, string[]> = {
  'AU-National': ['arc-grants', 'grantconnect', 'nhmrc', 'data-gov-au'],
  'AU-QLD': ['qld-grants', 'qld-arts-data', 'brisbane-grants'],
  'AU-NSW': ['nsw-grants'],
  'AU-VIC': ['vic-grants'],
  'AU-WA': ['wa-grants'],
  'AU-SA': ['sa-grants'],
  'AU-TAS': ['tas-grants'],
  'AU-ACT': ['act-grants'],
  'AU-NT': ['nt-grants'],
};

const SOURCES = [
  { value: 'foundation_program', label: 'Foundation Programs' },
  { value: 'grantconnect', label: 'GrantConnect' },
  { value: 'arc-grants', label: 'ARC Grants' },
  { value: 'nhmrc', label: 'NHMRC' },
  { value: 'ghl_sync', label: 'Curated' },
];

const PROGRAM_TYPES = [
  { value: 'fellowship', label: 'Fellowships' },
  { value: 'scholarship', label: 'Scholarships' },
  { value: 'grant', label: 'Grants' },
  { value: 'program', label: 'Programs' },
  { value: 'award', label: 'Awards' },
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
  sort?: string;
  hide_ongoing?: string;
  source?: string;
  program_type?: string;
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
  const sortOrder = params.sort || 'newest';
  const hideOngoing = params.hide_ongoing === '1';
  const sourceFilter = params.source || '';
  const programTypeFilter = params.program_type || '';
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

      const semanticIds = results.map((result) => result.id);
      const { data: semanticDetails } = semanticIds.length > 0
        ? await supabase
            .from('grant_opportunities')
            .select('id, program, program_type, source, status, sources, created_at, updated_at, last_verified_at')
            .in('id', semanticIds)
        : { data: [] };
      const semanticDetailMap = new Map(
        (semanticDetails || []).map((row) => [row.id, row]),
      );

      grants = results.map(r => ({
        ...(semanticDetailMap.get(r.id) || {}),
        id: r.id,
        name: r.name,
        provider: r.provider,
        program: semanticDetailMap.get(r.id)?.program ?? null,
        program_type: semanticDetailMap.get(r.id)?.program_type ?? null,
        amount_min: r.amount_min,
        amount_max: r.amount_max,
        closes_at: r.closes_at,
        url: r.url,
        description: r.description ?? null,
        categories: r.categories || [],
        source: semanticDetailMap.get(r.id)?.source ?? null,
        status: semanticDetailMap.get(r.id)?.status || 'open',
        sources: semanticDetailMap.get(r.id)?.sources ?? null,
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
      if (sourceFilter) {
        grants = grants.filter(g => g.source === sourceFilter);
      }
      if (programTypeFilter) {
        grants = grants.filter(g => g.program_type === programTypeFilter);
      }
      if (geoFilter) {
        const sources = GEO_SOURCE_MAP[geoFilter];
        if (sources) grants = grants.filter(g => g.source && sources.includes(g.source));
      }
      if (closingFilter === '30') {
        const cutoff = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        grants = grants.filter(g => g.closes_at && g.closes_at <= cutoff);
      } else if (closingFilter === '90') {
        const cutoff = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
        grants = grants.filter(g => g.closes_at && g.closes_at <= cutoff);
      }

      grants = sortGrantList(
        dedupeGrantList(grants),
        sortOrder,
        { semantic: true },
      ) as Grant[];
      count = grants.length;
      usedSemantic = true;
    } catch {
      usedSemantic = false;
    }
  }

  if (!usedSemantic) {
    const grantFields = [
      'id',
      'name',
      'provider',
      'program',
      'program_type',
      'amount_min',
      'amount_max',
      'closes_at',
      'url',
      'description',
      'categories',
      'source',
      'status',
      'sources',
      'created_at',
      'updated_at',
      'last_verified_at',
    ].join(', ');

    let dbQuery = supabase
      .from('grant_opportunities')
      .select(grantFields);

    if (grantType !== 'all') {
      dbQuery = dbQuery.eq('grant_type', grantType);
    }

    if (query) {
      const escapedQuery = query.replace(/[%_]/g, '');
      dbQuery = dbQuery.or(`name.ilike.%${escapedQuery}%,provider.ilike.%${escapedQuery}%`);
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

    if (sourceFilter) {
      dbQuery = dbQuery.eq('source', sourceFilter);
    }

    if (programTypeFilter) {
      dbQuery = dbQuery.eq('program_type', programTypeFilter);
    }

    if (geoFilter) {
      const sources = GEO_SOURCE_MAP[geoFilter];
      if (sources) {
        dbQuery = dbQuery.in('source', sources);
      }
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

    if (hideOngoing) {
      dbQuery = dbQuery.not('closes_at', 'is', null);
    }

    const result = await dbQuery;
    const filteredRows = ((result.data || []) as unknown) as Grant[];
    const uniqueGrants = sortGrantList(
      dedupeGrantList(filteredRows),
      sortOrder,
    ) as Grant[];

    count = uniqueGrants.length;
    grants = uniqueGrants.slice(offset, offset + pageSize);
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
  if (sortOrder !== 'newest') filterParams.set('sort', sortOrder);
  if (hideOngoing) filterParams.set('hide_ongoing', '1');
  if (sourceFilter) filterParams.set('source', sourceFilter);
  if (programTypeFilter) filterParams.set('program_type', programTypeFilter);
  const filterQS = filterParams.toString();

  return (
    <ListPreviewProvider>
    <div>
      <FundingIntelligenceRail
        current="grants"
        totalLabel={`${count.toLocaleString()} ${grantType === 'historical_award' ? 'historical awards' : grantType === 'all' ? 'grants and opportunities' : 'open opportunities'} in the current funding search`}
        query={query}
        theme={category || query}
        geography={geoFilter}
        trackerHref="/tracker"
      />

      <div className="mb-6">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-bold text-bauhaus-black">Grants &amp; Opportunities</h1>
            <p className="text-sm text-bauhaus-muted mt-0.5">
              {count.toLocaleString()} {grantType === 'historical_award' ? 'historical awards' : grantType === 'all' ? 'grants' : 'open opportunities'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {grantTypes.map(t => (
              <a
                key={t.value}
                href={`/grants?type=${t.value}&q=${query}&category=${category}&mode=${searchMode}`}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${grantType === t.value ? 'bg-bauhaus-black text-white' : 'text-bauhaus-muted hover:bg-bauhaus-canvas'}`}
              >
                {t.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Search bar */}
      <form method="get" className="flex gap-2 mb-3">
        <input type="hidden" name="type" value={grantType} />
        <input type="hidden" name="mode" value={searchMode} />
        {amountMin && <input type="hidden" name="amount_min" value={amountMin} />}
        {amountMax && <input type="hidden" name="amount_max" value={amountMax} />}
        {geoFilter && <input type="hidden" name="geo" value={geoFilter} />}
        {closingFilter && <input type="hidden" name="closing" value={closingFilter} />}
        <div className="flex-1 relative">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder={searchMode === 'ai' ? 'Describe what you need funding for...' : 'Search grants...'}
            className="w-full px-4 py-2.5 border border-bauhaus-black/20 rounded-lg text-sm bg-white focus:border-bauhaus-blue focus:ring-1 focus:ring-bauhaus-blue focus:outline-none placeholder:text-bauhaus-muted/50"
          />
        </div>
        <select name="category" defaultValue={category} className="px-3 py-2.5 border border-bauhaus-black/20 rounded-lg text-sm bg-white focus:outline-none">
          <option value="">All categories</option>
          {categories.map(c => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
        <div className="flex rounded-lg overflow-hidden border border-bauhaus-black/20">
          <a
            href={`/grants?type=${grantType}&q=${query}&category=${category}&mode=keyword`}
            className={`px-3 py-2.5 text-xs font-semibold transition-colors ${searchMode !== 'ai' ? 'bg-bauhaus-black text-white' : 'bg-white text-bauhaus-muted hover:bg-bauhaus-canvas'}`}
          >
            Keyword
          </a>
          <a
            href={`/grants?type=${grantType}&q=${query}&category=${category}&mode=ai`}
            className={`px-3 py-2.5 text-xs font-semibold transition-colors border-l border-bauhaus-black/20 ${searchMode === 'ai' ? 'bg-bauhaus-blue text-white' : 'bg-white text-bauhaus-muted hover:bg-bauhaus-canvas'}`}
          >
            AI
          </a>
        </div>
        <button type="submit" className="px-5 py-2.5 bg-bauhaus-black text-white text-xs font-semibold rounded-lg hover:bg-bauhaus-black/80 cursor-pointer transition-colors">
          Search
        </button>
      </form>

      {/* Filters — single compact row */}
      <FilterBar>
        <form method="get" className="flex items-center gap-3 py-2 px-3 bg-bauhaus-canvas/50 border border-bauhaus-black/10 rounded-lg flex-wrap">
          <input type="hidden" name="type" value={grantType} />
          <input type="hidden" name="mode" value={searchMode} />
          {query && <input type="hidden" name="q" value={query} />}
          {category && <input type="hidden" name="category" value={category} />}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-bauhaus-muted uppercase tracking-wide">Amount</span>
            <input
              type="number"
              name="amount_min"
              defaultValue={amountMin || ''}
              placeholder="Min"
              className="w-16 px-2 py-1 text-xs border border-bauhaus-black/15 rounded bg-white focus:outline-none tabular-nums"
            />
            <span className="text-bauhaus-muted/50">–</span>
            <input
              type="number"
              name="amount_max"
              defaultValue={amountMax || ''}
              placeholder="Max"
              className="w-16 px-2 py-1 text-xs border border-bauhaus-black/15 rounded bg-white focus:outline-none tabular-nums"
            />
          </div>
          <div className="w-px h-5 bg-bauhaus-black/10"></div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-bauhaus-muted uppercase tracking-wide">State</span>
            <select name="geo" defaultValue={geoFilter} className="text-xs border border-bauhaus-black/15 rounded bg-white px-2 py-1 focus:outline-none">
              <option value="">All</option>
              {STATES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="w-px h-5 bg-bauhaus-black/10"></div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-bauhaus-muted uppercase tracking-wide">Source</span>
            <select name="source" defaultValue={sourceFilter} className="text-xs border border-bauhaus-black/15 rounded bg-white px-2 py-1 focus:outline-none">
              <option value="">All</option>
              {SOURCES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="w-px h-5 bg-bauhaus-black/10"></div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-bauhaus-muted uppercase tracking-wide">Type</span>
            <select name="program_type" defaultValue={programTypeFilter} className="text-xs border border-bauhaus-black/15 rounded bg-white px-2 py-1 focus:outline-none">
              <option value="">All</option>
              {PROGRAM_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="w-px h-5 bg-bauhaus-black/10"></div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-bauhaus-muted uppercase tracking-wide">Closing</span>
            {[{ v: '', label: 'Upcoming' }, { v: '30', label: '30d' }, { v: '90', label: '90d' }, { v: 'all', label: 'All' }].map(({ v, label }) => (
              <a
                key={v}
                href={`/grants?${new URLSearchParams({ type: grantType, mode: searchMode, ...(query ? { q: query } : {}), ...(category ? { category } : {}), ...(amountMin ? { amount_min: String(amountMin) } : {}), ...(amountMax ? { amount_max: String(amountMax) } : {}), ...(geoFilter ? { geo: geoFilter } : {}), ...(sourceFilter ? { source: sourceFilter } : {}), ...(programTypeFilter ? { program_type: programTypeFilter } : {}), closing: v }).toString()}`}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors ${closingFilter === v ? 'bg-bauhaus-black text-white' : 'text-bauhaus-muted hover:bg-bauhaus-black/5'}`}
              >
                {label}
              </a>
            ))}
          </div>
          <button type="submit" className="ml-auto px-3 py-1 bg-bauhaus-black text-white text-[11px] font-semibold rounded hover:bg-bauhaus-black/80 cursor-pointer transition-colors">
            Apply
          </button>
        </form>
      </FilterBar>

      {/* Sort controls — inline, subtle */}
      <div className="flex items-center gap-2 mb-4 mt-3">
        <span className="text-[11px] font-semibold text-bauhaus-muted uppercase tracking-wide">Sort</span>
        {[
          { v: 'newest', label: 'Newest' },
          { v: 'closing_asc', label: 'Closing Soon' },
          { v: 'closing_desc', label: 'Closing Last' },
          { v: 'amount_desc', label: '$ High' },
          { v: 'amount_asc', label: '$ Low' },
          { v: 'name_asc', label: 'A-Z' },
        ].map(({ v, label }) => (
          <a
            key={v}
            href={`/grants?${new URLSearchParams({ type: grantType, mode: searchMode, ...(query ? { q: query } : {}), ...(category ? { category } : {}), ...(closingFilter ? { closing: closingFilter } : {}), ...(geoFilter ? { geo: geoFilter } : {}), ...(amountMin ? { amount_min: String(amountMin) } : {}), ...(amountMax ? { amount_max: String(amountMax) } : {}), ...(hideOngoing ? { hide_ongoing: '1' } : {}), ...(sourceFilter ? { source: sourceFilter } : {}), ...(programTypeFilter ? { program_type: programTypeFilter } : {}), sort: v }).toString()}`}
            className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors ${sortOrder === v ? 'bg-bauhaus-black text-white' : 'text-bauhaus-muted hover:bg-bauhaus-black/5'}`}
          >
            {label}
          </a>
        ))}
        <div className="w-px h-4 bg-bauhaus-black/10 mx-1"></div>
        <a
          href={`/grants?${new URLSearchParams({ type: grantType, mode: searchMode, ...(query ? { q: query } : {}), ...(category ? { category } : {}), ...(closingFilter ? { closing: closingFilter } : {}), ...(geoFilter ? { geo: geoFilter } : {}), ...(amountMin ? { amount_min: String(amountMin) } : {}), ...(amountMax ? { amount_max: String(amountMax) } : {}), ...(sortOrder !== 'newest' ? { sort: sortOrder } : {}), ...(sourceFilter ? { source: sourceFilter } : {}), ...(programTypeFilter ? { program_type: programTypeFilter } : {}), ...(!hideOngoing ? { hide_ongoing: '1' } : {}) }).toString()}`}
          className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors ${hideOngoing ? 'bg-bauhaus-black text-white' : 'text-bauhaus-muted hover:bg-bauhaus-black/5'}`}
        >
          {hideOngoing ? 'Show Ongoing' : 'Hide Ongoing'}
        </a>
      </div>

      {/* Semantic search banner */}
      {usedSemantic && (
        <div className="mb-4 p-3 bg-link-light border border-bauhaus-blue/30 rounded-lg">
          <span className="text-xs font-semibold text-bauhaus-blue">
            AI found {count} grants matching: &ldquo;{query}&rdquo;
          </span>
        </div>
      )}

      <div className="space-y-2">
        {grants.map((grant) => (
          <GrantPreviewTrigger
            key={grant.id}
            grant={{
              id: grant.id,
              name: grant.name,
              provider: grant.provider,
              description: grant.description ?? null,
              amount_min: grant.amount_min,
              amount_max: grant.amount_max,
              closes_at: grant.closes_at,
              categories: grant.categories || [],
              url: grant.url ?? null,
              source: grant.source ?? null,
            }}
          >
            <div className="bg-white border border-bauhaus-black/10 rounded-lg p-4 sm:px-5 transition-all hover:border-bauhaus-blue/30 hover:shadow-sm group-hover:bg-bauhaus-blue group-hover:text-white group-hover:border-bauhaus-blue">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-bauhaus-black text-[15px] group-hover:text-white">{grant.name}</h3>
                    {grant.program_type && grant.program_type !== 'open_opportunity' && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 uppercase tracking-wider rounded flex-shrink-0 ${
                        grant.program_type === 'fellowship' ? 'bg-link-light text-bauhaus-blue' :
                        grant.program_type === 'scholarship' ? 'bg-warning-light text-bauhaus-black' :
                        grant.program_type === 'historical_award' ? 'bg-bauhaus-canvas text-bauhaus-muted' :
                        'bg-money-light text-money'
                      } group-hover:bg-white/20 group-hover:text-white`}>
                        {grant.program_type.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-bauhaus-muted mt-0.5 group-hover:text-white/70">
                    {grant.provider}{grant.program ? ` — ${grant.program}` : ''}
                  </div>
                  {grant.description && (
                    <div className="text-sm text-bauhaus-muted/70 mt-1 line-clamp-1 group-hover:text-white/50">
                      {grant.description}
                    </div>
                  )}
                </div>
                <div className="sm:text-right sm:ml-4 flex-shrink-0">
                  <div className="text-sm font-bold text-bauhaus-blue tabular-nums group-hover:text-bauhaus-yellow">
                    {formatAmount(grant.amount_min, grant.amount_max)}
                  </div>
                  <div className={`text-xs mt-0.5 font-medium ${grant.closes_at ? 'text-bauhaus-red' : 'text-bauhaus-muted'} group-hover:text-white/70`}>
                    {grant.closes_at ? `Closes ${formatDate(grant.closes_at)}` : 'Ongoing'}
                  </div>
                  {usedSemantic && grant.similarity != null && (
                    <div className="flex items-center gap-1.5 mt-1 justify-end">
                      <div className="w-16 h-1.5 bg-bauhaus-canvas rounded-full overflow-hidden">
                        <div className="h-full bg-bauhaus-blue group-hover:bg-bauhaus-yellow rounded-full" style={{ width: `${Math.round(grant.similarity * 100)}%` }}></div>
                      </div>
                      <span className="text-[10px] font-semibold text-bauhaus-muted group-hover:text-white/50 tabular-nums">
                        {Math.round(grant.similarity * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                {grant.categories?.length > 0 && grant.categories.map(c => (
                    <span key={c} className="text-[11px] px-2 py-0.5 bg-bauhaus-canvas text-bauhaus-muted font-medium rounded group-hover:bg-white/20 group-hover:text-white">
                      {c}
                    </span>
                  ))}
                <span className="ml-auto text-[11px] font-semibold text-bauhaus-muted group-hover:text-white/70">
                  Open details &rarr;
                </span>
              </div>
            </div>
          </GrantPreviewTrigger>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-8">
          {page > 1 && (
            <a href={`/grants?${filterQS}&page=${page - 1}`} className="px-4 py-2 text-xs font-semibold border border-bauhaus-black/20 rounded-lg text-bauhaus-black hover:bg-bauhaus-canvas transition-colors">
              Previous
            </a>
          )}
          <span className="px-4 py-2 text-xs font-medium text-bauhaus-muted">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <a href={`/grants?${filterQS}&page=${page + 1}`} className="px-4 py-2 text-xs font-semibold border border-bauhaus-black/20 rounded-lg text-bauhaus-black hover:bg-bauhaus-canvas transition-colors">
              Next
            </a>
          )}
        </div>
      )}
    </div>
    </ListPreviewProvider>
  );
}

import type { Metadata } from 'next';
import { getServiceSupabase } from '@/lib/supabase';
import { FilterBar } from '../components/filter-bar';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Search 64,000+ Australian Charities | CivicGraph',
  description: 'Search every registered charity in Australia by mission alignment, geography, cause area, organisation size, and financial health. Open data from the ACNC register.',
};

const PURPOSES = [
  { value: 'Education', label: 'Education' },
  { value: 'Health', label: 'Health' },
  { value: 'Social Welfare', label: 'Social Welfare' },
  { value: 'Religion', label: 'Religion' },
  { value: 'Culture', label: 'Culture' },
  { value: 'Environment', label: 'Environment' },
  { value: 'Reconciliation', label: 'Reconciliation' },
  { value: 'Human Rights', label: 'Human Rights' },
  { value: 'Animal Welfare', label: 'Animal Welfare' },
  { value: 'General Public', label: 'General Public' },
  { value: 'Law & Policy', label: 'Law & Policy' },
  { value: 'Security', label: 'Security' },
];

const BENEFICIARIES = [
  { value: 'First Nations', label: 'First Nations' },
  { value: 'Children', label: 'Children' },
  { value: 'Youth', label: 'Youth' },
  { value: 'Aged', label: 'Aged' },
  { value: 'Disability', label: 'Disability' },
  { value: 'Rural & Remote', label: 'Rural & Remote' },
  { value: 'Financially Disadvantaged', label: 'Financially Disadvantaged' },
  { value: 'Migrants & Refugees', label: 'Migrants & Refugees' },
  { value: 'LGBTIQA+', label: 'LGBTIQA+' },
  { value: 'Families', label: 'Families' },
  { value: 'Homelessness Risk', label: 'Homelessness Risk' },
  { value: 'Veterans', label: 'Veterans' },
  { value: 'Overseas', label: 'Overseas' },
  { value: 'Chronic Illness', label: 'Chronic Illness' },
];

const STATES = [
  { value: 'NSW', label: 'NSW' },
  { value: 'VIC', label: 'VIC' },
  { value: 'QLD', label: 'QLD' },
  { value: 'WA', label: 'WA' },
  { value: 'SA', label: 'SA' },
  { value: 'TAS', label: 'TAS' },
  { value: 'ACT', label: 'ACT' },
  { value: 'NT', label: 'NT' },
];

const SIZES = ['Small', 'Medium', 'Large'];

const SORT_OPTIONS = [
  { value: 'name', label: 'Name A-Z' },
  { value: 'revenue', label: 'Highest Revenue' },
  { value: 'grants', label: 'Highest Grants' },
  { value: 'newest', label: 'Newest Registered' },
];

interface CharityRow {
  abn: string;
  name: string;
  charity_size: string | null;
  state: string | null;
  pbi: boolean;
  hpc: boolean;
  purposes: string[];
  beneficiaries: string[];
  operating_states: string[];
  is_foundation: boolean;
  website: string | null;
  total_revenue: number | null;
  total_grants_given: number | null;
  total_assets: number | null;
  latest_financial_year: number | null;
  has_enrichment: boolean;
}

function formatCurrency(amount: number | null): string {
  if (!amount) return '';
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

function sizeBadgeClass(size: string | null): string {
  switch (size) {
    case 'Large': return 'border-bauhaus-red bg-bauhaus-red/10 text-bauhaus-red';
    case 'Medium': return 'border-bauhaus-blue bg-link-light text-bauhaus-blue';
    case 'Small': return 'border-bauhaus-black/30 bg-bauhaus-canvas text-bauhaus-muted';
    default: return 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted';
  }
}

interface SearchParams {
  q?: string;
  size?: string;
  purpose?: string;
  beneficiary?: string;
  pbi?: string;
  hpc?: string;
  state?: string;
  reg_state?: string;
  revenue_min?: string;
  revenue_max?: string;
  grants?: string;
  foundation?: string;
  sort?: string;
  page?: string;
}

export default async function CharitiesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = params.q || '';
  const sizeFilter = params.size || '';
  const purposeFilter = params.purpose || '';
  const beneficiaryFilter = params.beneficiary || '';
  const pbiOnly = params.pbi === '1';
  const hpcOnly = params.hpc === '1';
  const stateFilter = params.state || '';
  const regStateFilter = params.reg_state || '';
  const revenueMin = params.revenue_min ? parseInt(params.revenue_min, 10) : null;
  const revenueMax = params.revenue_max ? parseInt(params.revenue_max, 10) : null;
  const grantsOnly = params.grants === '1';
  const foundationsOnly = params.foundation === '1';
  const sortBy = params.sort || 'name';
  const page = parseInt(params.page || '1', 10);
  const pageSize = 50;
  const offset = (page - 1) * pageSize;

  const supabase = getServiceSupabase();

  // Build query
  let dbQuery = supabase
    .from('v_charity_explorer')
    .select('abn, name, charity_size, state, pbi, hpc, purposes, beneficiaries, operating_states, is_foundation, website, total_revenue, total_grants_given, total_assets, latest_financial_year, has_enrichment', { count: 'exact' });

  if (query) {
    dbQuery = dbQuery.ilike('name', `%${query}%`);
  }
  if (sizeFilter) {
    dbQuery = dbQuery.eq('charity_size', sizeFilter);
  }
  if (purposeFilter) {
    dbQuery = dbQuery.contains('purposes', [purposeFilter]);
  }
  if (beneficiaryFilter) {
    dbQuery = dbQuery.contains('beneficiaries', [beneficiaryFilter]);
  }
  if (pbiOnly) {
    dbQuery = dbQuery.eq('pbi', true);
  }
  if (hpcOnly) {
    dbQuery = dbQuery.eq('hpc', true);
  }
  if (stateFilter) {
    dbQuery = dbQuery.contains('operating_states', [stateFilter]);
  }
  if (regStateFilter) {
    dbQuery = dbQuery.eq('state', regStateFilter);
  }
  if (revenueMin) {
    dbQuery = dbQuery.gte('total_revenue', revenueMin);
  }
  if (revenueMax) {
    dbQuery = dbQuery.lte('total_revenue', revenueMax);
  }
  if (grantsOnly) {
    dbQuery = dbQuery.gt('total_grants_given', 0);
  }
  if (foundationsOnly) {
    dbQuery = dbQuery.eq('is_foundation', true);
  }

  // Sort
  if (sortBy === 'revenue') {
    dbQuery = dbQuery.order('total_revenue', { ascending: false, nullsFirst: false });
  } else if (sortBy === 'grants') {
    dbQuery = dbQuery.order('total_grants_given', { ascending: false, nullsFirst: false });
  } else if (sortBy === 'newest') {
    dbQuery = dbQuery.order('registration_date', { ascending: false, nullsFirst: false });
  } else {
    dbQuery = dbQuery.order('name', { ascending: true });
  }

  dbQuery = dbQuery.range(offset, offset + pageSize - 1);

  const { data: charities, count } = await dbQuery;
  const totalPages = Math.ceil((count || 0) / pageSize);

  // Build filter query string for pagination
  const filterParams = new URLSearchParams();
  if (query) filterParams.set('q', query);
  if (sizeFilter) filterParams.set('size', sizeFilter);
  if (purposeFilter) filterParams.set('purpose', purposeFilter);
  if (beneficiaryFilter) filterParams.set('beneficiary', beneficiaryFilter);
  if (pbiOnly) filterParams.set('pbi', '1');
  if (hpcOnly) filterParams.set('hpc', '1');
  if (stateFilter) filterParams.set('state', stateFilter);
  if (regStateFilter) filterParams.set('reg_state', regStateFilter);
  if (revenueMin) filterParams.set('revenue_min', String(revenueMin));
  if (revenueMax) filterParams.set('revenue_max', String(revenueMax));
  if (grantsOnly) filterParams.set('grants', '1');
  if (foundationsOnly) filterParams.set('foundation', '1');
  if (sortBy !== 'name') filterParams.set('sort', sortBy);
  const filterQS = filterParams.toString();

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-2">Directory</p>
        <h1 className="text-3xl font-black text-bauhaus-black mb-2">Australian Charities</h1>
        <p className="text-bauhaus-muted font-medium">
          {(count || 0).toLocaleString()} charities from the ACNC register — every registered charity in Australia. Search by mission, geography, cause area, size, and financial health.
        </p>
      </div>

      {/* Insights banner */}
      <a href="/charities/insights" className="block mb-6 group">
        <div className="bg-bauhaus-blue border-4 border-bauhaus-black p-4 flex items-center justify-between transition-all group-hover:-translate-y-0.5 bauhaus-shadow-sm">
          <div>
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-1">New</div>
            <div className="text-sm font-black text-white">Sector Insights &mdash; visualise where money concentrates, who it serves, and 7-year trends</div>
          </div>
          <span className="text-white font-black text-lg ml-4 flex-shrink-0">&rarr;</span>
        </div>
      </a>

      {/* Primary filters */}
      <form method="get" className="flex flex-col sm:flex-row gap-0 mb-4 flex-wrap">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search charities by name..."
          className="flex-1 min-w-[200px] px-4 py-2.5 border-4 border-bauhaus-black text-sm font-bold bg-white focus:bg-bauhaus-yellow focus:outline-none"
        />
        <select name="size" defaultValue={sizeFilter} className="px-4 py-2.5 border-4 border-l-0 border-bauhaus-black text-sm font-bold bg-white focus:outline-none">
          <option value="">All sizes</option>
          {SIZES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select name="purpose" defaultValue={purposeFilter} className="px-4 py-2.5 border-4 border-l-0 border-bauhaus-black text-sm font-bold bg-white focus:outline-none">
          <option value="">All purposes</option>
          {PURPOSES.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <select name="sort" defaultValue={sortBy} className="px-4 py-2.5 border-4 border-l-0 border-bauhaus-black text-sm font-bold bg-white focus:outline-none">
          {SORT_OPTIONS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        {/* Preserve hidden filters */}
        {beneficiaryFilter && <input type="hidden" name="beneficiary" value={beneficiaryFilter} />}
        {pbiOnly && <input type="hidden" name="pbi" value="1" />}
        {hpcOnly && <input type="hidden" name="hpc" value="1" />}
        {stateFilter && <input type="hidden" name="state" value={stateFilter} />}
        {regStateFilter && <input type="hidden" name="reg_state" value={regStateFilter} />}
        {revenueMin && <input type="hidden" name="revenue_min" value={String(revenueMin)} />}
        {revenueMax && <input type="hidden" name="revenue_max" value={String(revenueMax)} />}
        {grantsOnly && <input type="hidden" name="grants" value="1" />}
        {foundationsOnly && <input type="hidden" name="foundation" value="1" />}
        <button type="submit" className="px-5 py-2.5 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-red cursor-pointer border-4 border-bauhaus-black">
          Filter
        </button>
      </form>

      {/* Advanced filters */}
      <FilterBar>
        <form method="get" className="flex flex-col sm:flex-row gap-0 border-4 border-bauhaus-black bg-white flex-wrap">
          {/* Preserve primary filters */}
          {query && <input type="hidden" name="q" value={query} />}
          {sizeFilter && <input type="hidden" name="size" value={sizeFilter} />}
          {purposeFilter && <input type="hidden" name="purpose" value={purposeFilter} />}
          {sortBy !== 'name' && <input type="hidden" name="sort" value={sortBy} />}

          <div className="flex items-center px-3 py-2 border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
            <span className="text-[11px] font-black text-bauhaus-muted uppercase tracking-wider mr-2">Beneficiary</span>
            <select name="beneficiary" defaultValue={beneficiaryFilter} className="text-xs font-bold bg-bauhaus-canvas border-2 border-bauhaus-black/20 px-2 py-1 focus:outline-none">
              <option value="">All</option>
              {BENEFICIARIES.map(b => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center px-3 py-2 border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
            <span className="text-[11px] font-black text-bauhaus-muted uppercase tracking-wider mr-2">Operates In</span>
            <select name="state" defaultValue={stateFilter} className="text-xs font-bold bg-bauhaus-canvas border-2 border-bauhaus-black/20 px-2 py-1 focus:outline-none">
              <option value="">All</option>
              {STATES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center px-3 py-2 border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
            <span className="text-[11px] font-black text-bauhaus-muted uppercase tracking-wider mr-2 whitespace-nowrap">Revenue</span>
            <input
              type="number"
              name="revenue_min"
              defaultValue={revenueMin || ''}
              placeholder="Min $"
              className="w-20 px-2 py-1 text-xs font-bold border-2 border-bauhaus-black/20 bg-bauhaus-canvas focus:outline-none tabular-nums"
            />
            <span className="mx-1 text-bauhaus-muted">&ndash;</span>
            <input
              type="number"
              name="revenue_max"
              defaultValue={revenueMax || ''}
              placeholder="Max $"
              className="w-20 px-2 py-1 text-xs font-bold border-2 border-bauhaus-black/20 bg-bauhaus-canvas focus:outline-none tabular-nums"
            />
          </div>

          <div className="flex items-center gap-3 px-3 py-2 border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
            <label className="flex items-center gap-1.5 text-[11px] font-black text-bauhaus-black cursor-pointer uppercase tracking-wider">
              <input type="checkbox" name="pbi" value="1" defaultChecked={pbiOnly} className="accent-bauhaus-red" />
              PBI
            </label>
            <label className="flex items-center gap-1.5 text-[11px] font-black text-bauhaus-black cursor-pointer uppercase tracking-wider">
              <input type="checkbox" name="grants" value="1" defaultChecked={grantsOnly} className="accent-bauhaus-red" />
              Grants
            </label>
            <label className="flex items-center gap-1.5 text-[11px] font-black text-bauhaus-black cursor-pointer uppercase tracking-wider">
              <input type="checkbox" name="foundation" value="1" defaultChecked={foundationsOnly} className="accent-bauhaus-red" />
              Foundation
            </label>
          </div>

          <button type="submit" className="px-4 py-2 bg-bauhaus-black text-white text-[11px] font-black uppercase tracking-widest hover:bg-bauhaus-red cursor-pointer">
            Apply
          </button>
        </form>
      </FilterBar>

      {/* Results */}
      <div className="space-y-3">
        {((charities || []) as CharityRow[]).map((c) => (
          <a key={c.abn} href={`/charities/${c.abn}`} className="block bg-white border-4 border-bauhaus-black p-4 sm:px-5 transition-all hover:-translate-y-0.5 bauhaus-shadow-sm group">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-bauhaus-black text-[15px] group-hover:text-bauhaus-blue">{c.name}</h3>
                  <span className={`text-[11px] px-1.5 py-0.5 font-black uppercase tracking-wider border-2 ${sizeBadgeClass(c.charity_size)}`}>
                    {c.charity_size || 'Unknown'}
                  </span>
                  {c.pbi && (
                    <span className="text-[11px] px-1.5 py-0.5 font-black uppercase tracking-wider border-2 border-money bg-money-light text-money">PBI</span>
                  )}
                  {c.hpc && (
                    <span className="text-[11px] px-1.5 py-0.5 font-black uppercase tracking-wider border-2 border-bauhaus-blue bg-link-light text-bauhaus-blue">HPC</span>
                  )}
                  {c.is_foundation && (
                    <span className="text-[11px] px-1.5 py-0.5 font-black uppercase tracking-wider border-2 border-bauhaus-yellow bg-warning-light text-bauhaus-black">
                      Foundation
                    </span>
                  )}
                  {c.has_enrichment && (
                    <span className="text-[11px] px-1.5 py-0.5 font-black uppercase tracking-wider border-2 border-bauhaus-yellow bg-bauhaus-yellow/20 text-bauhaus-black">
                      Enriched
                    </span>
                  )}
                </div>
                <div className="text-xs text-bauhaus-muted mt-1">
                  <span className="font-bold">{c.state || 'Unknown'}</span>
                  {c.operating_states?.length > 0 && c.operating_states.length < 8 && (
                    <span className="ml-2">Operates in: {c.operating_states.join(', ')}</span>
                  )}
                  {c.operating_states?.length >= 8 && (
                    <span className="ml-2">Operates nationally</span>
                  )}
                </div>
              </div>
              <div className="sm:text-right sm:ml-4 flex-shrink-0">
                {c.total_revenue != null && c.total_revenue > 0 && (
                  <div className="text-sm font-black text-bauhaus-black tabular-nums">
                    {formatCurrency(c.total_revenue)} rev
                  </div>
                )}
                {c.total_grants_given != null && c.total_grants_given > 0 && (
                  <div className="text-xs font-bold text-money tabular-nums">
                    {formatCurrency(c.total_grants_given)} granted
                  </div>
                )}
                {c.total_assets != null && c.total_assets > 0 && (
                  <div className="text-[11px] text-bauhaus-muted font-bold tabular-nums">
                    {formatCurrency(c.total_assets)} assets
                  </div>
                )}
                {c.latest_financial_year && (
                  <div className="text-[10px] text-bauhaus-muted/60 font-bold tabular-nums">
                    FY{c.latest_financial_year}
                  </div>
                )}
              </div>
            </div>
            {(c.purposes?.length > 0 || c.beneficiaries?.length > 0) && (
              <div className="flex gap-1 mt-2.5 flex-wrap">
                {c.purposes?.map(t => (
                  <span key={t} className="text-[10px] px-1.5 py-0.5 bg-money-light text-money font-bold border border-money/20">{t}</span>
                ))}
                {c.beneficiaries?.slice(0, 6).map(b => (
                  <span key={b} className="text-[10px] px-1.5 py-0.5 bg-bauhaus-canvas text-bauhaus-muted font-bold border border-bauhaus-black/10">{b}</span>
                ))}
                {c.beneficiaries?.length > 6 && (
                  <span className="text-[10px] px-1.5 py-0.5 text-bauhaus-muted font-bold">+{c.beneficiaries.length - 6} more</span>
                )}
              </div>
            )}
          </a>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-0 mt-8">
          {page > 1 && (
            <a href={`/charities?${filterQS}&page=${page - 1}`} className="px-4 py-2 text-xs font-black uppercase tracking-widest border-4 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white">
              Previous
            </a>
          )}
          <span className="px-4 py-2 text-xs font-black uppercase tracking-widest border-4 border-l-0 border-bauhaus-black bg-bauhaus-canvas">
            Page {page} of {totalPages.toLocaleString()}
          </span>
          {page < totalPages && (
            <a href={`/charities?${filterQS}&page=${page + 1}`} className="px-4 py-2 text-xs font-black uppercase tracking-widest border-4 border-l-0 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white">
              Next
            </a>
          )}
        </div>
      )}
    </div>
  );
}

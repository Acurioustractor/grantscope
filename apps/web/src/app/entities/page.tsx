import { getServiceSupabase } from '@/lib/supabase';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function formatMoney(amount: number | null): string {
  if (!amount) return '\u2014';
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

const ENTITY_TYPES = [
  { value: 'charity', label: 'Charity' },
  { value: 'foundation', label: 'Foundation' },
  { value: 'company', label: 'Company' },
  { value: 'indigenous_corp', label: 'Indigenous Corp' },
  { value: 'government_body', label: 'Government' },
  { value: 'political_party', label: 'Political Party' },
  { value: 'social_enterprise', label: 'Social Enterprise' },
  { value: 'trust', label: 'Trust' },
  { value: 'person', label: 'Person' },
];

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

const SORT_OPTIONS = [
  { value: 'source_count', label: 'Most Data Sources' },
  { value: 'latest_revenue', label: 'Revenue' },
  { value: 'canonical_name', label: 'Name A-Z' },
];

function entityTypeBadge(type: string): string {
  const styles: Record<string, string> = {
    charity: 'border-money bg-money-light text-money',
    foundation: 'border-bauhaus-blue bg-link-light text-bauhaus-blue',
    company: 'border-bauhaus-black/30 bg-bauhaus-canvas text-bauhaus-black',
    government_body: 'border-bauhaus-yellow bg-warning-light text-bauhaus-black',
    indigenous_corp: 'border-bauhaus-red bg-error-light text-bauhaus-red',
    political_party: 'border-bauhaus-red bg-error-light text-bauhaus-red',
    social_enterprise: 'border-money bg-money-light text-money',
  };
  return styles[type] || 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted';
}

export default async function EntityGraphPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; view?: string; state?: string; sort?: string }>;
}) {
  const { q, type, view, state: stateFilter, sort } = await searchParams;
  const supabase = getServiceSupabase();

  // Default view: donor-contractors (the flagship)
  const showDonorContractors = view === 'donor-contractors' || !view;

  if (showDonorContractors) {
    const { data: donorContractors } = await supabase
      .from('mv_gs_donor_contractors')
      .select('*')
      .order('total_donated', { ascending: false })
      .limit(100);

    const { count: totalEntities } = await supabase.from('gs_entities').select('*', { count: 'exact', head: true });
    const { count: totalRels } = await supabase.from('gs_relationships').select('*', { count: 'exact', head: true });

    return (
      <div className="max-w-5xl">
        <h1 className="text-2xl sm:text-3xl font-black text-bauhaus-black mb-2">Entity Graph</h1>
        <p className="text-bauhaus-muted font-medium mb-6">
          {(totalEntities || 0).toLocaleString()} entities &middot; {(totalRels || 0).toLocaleString()} relationships &middot; Mapping money, contracts, and political influence across Australia
        </p>

        {/* View tabs */}
        <div className="flex gap-0 mb-8 border-4 border-bauhaus-black">
          <Link
            href="/entities?view=donor-contractors"
            className={`px-4 py-2 text-xs font-black uppercase tracking-widest ${showDonorContractors ? 'bg-bauhaus-black text-white' : 'bg-white text-bauhaus-black hover:bg-bauhaus-canvas'}`}
          >
            Donor-Contractors ({donorContractors?.length || 0})
          </Link>
          <Link
            href="/entities?view=search"
            className="px-4 py-2 text-xs font-black uppercase tracking-widest bg-white text-bauhaus-black hover:bg-bauhaus-canvas border-l-2 border-bauhaus-black/10"
          >
            Search All
          </Link>
        </div>

        {/* Donor-Contractors Table */}
        <div className="border-4 border-bauhaus-black">
          <div className="bg-bauhaus-black text-white px-4 py-2">
            <h2 className="text-xs font-black uppercase tracking-widest">
              Entities that Donate to Political Parties AND Hold Government Contracts
            </h2>
          </div>
          <div className="divide-y-2 divide-bauhaus-black/5">
            {(donorContractors || []).map((dc: Record<string, unknown>, i: number) => (
              <Link key={i} href={`/entities/${dc.gs_id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-bauhaus-canvas transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-bauhaus-black truncate">{dc.canonical_name as string}</div>
                  <div className="text-[11px] text-bauhaus-muted font-medium">
                    {dc.entity_type as string} &middot; {dc.state as string || 'National'}
                    {dc.sector ? <span> &middot; {String(dc.sector)}</span> : null}
                  </div>
                </div>
                <div className="text-right ml-4 shrink-0">
                  <div className="text-sm font-black text-bauhaus-red">{formatMoney(dc.total_donated as number)}</div>
                  <div className="text-[10px] font-bold text-bauhaus-muted">
                    {(dc.donation_count as number)} donations &middot; {(dc.contract_count as number)} contracts
                  </div>
                </div>
                <div className="text-right ml-4 shrink-0 hidden sm:block">
                  <div className="text-sm font-black text-bauhaus-black">{formatMoney(dc.total_contract_value as number)}</div>
                  <div className="text-[10px] font-bold text-bauhaus-muted">contract value</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Search view with filters
  const sortField = sort || 'source_count';
  const sortAsc = sortField === 'canonical_name';

  let results: Record<string, unknown>[] = [];
  const needsQuery = q || type || stateFilter;

  if (needsQuery) {
    let dbQuery = supabase
      .from('gs_entities')
      .select('id, gs_id, canonical_name, entity_type, abn, state, source_count, latest_revenue, latest_assets, sector');

    if (q) {
      const escapedQ = q.replace(/[%_]/g, '');
      dbQuery = dbQuery.or(`canonical_name.ilike.%${escapedQ}%,abn.eq.${escapedQ}`);
    }
    if (type) {
      dbQuery = dbQuery.eq('entity_type', type);
    }
    if (stateFilter) {
      dbQuery = dbQuery.eq('state', stateFilter);
    }

    dbQuery = dbQuery.order(sortField, { ascending: sortAsc, nullsFirst: false }).limit(50);
    const { data } = await dbQuery;
    results = (data || []) as Record<string, unknown>[];
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl sm:text-3xl font-black text-bauhaus-black mb-6">Entity Graph</h1>

      {/* View tabs */}
      <div className="flex gap-0 mb-8 border-4 border-bauhaus-black">
        <Link
          href="/entities?view=donor-contractors"
          className="px-4 py-2 text-xs font-black uppercase tracking-widest bg-white text-bauhaus-black hover:bg-bauhaus-canvas"
        >
          Donor-Contractors
        </Link>
        <Link
          href="/entities?view=search"
          className="px-4 py-2 text-xs font-black uppercase tracking-widest bg-bauhaus-black text-white border-l-2 border-bauhaus-black/10"
        >
          Search All
        </Link>
      </div>

      {/* Search */}
      <form className="mb-6">
        <input type="hidden" name="view" value="search" />
        <div className="flex gap-0 border-4 border-bauhaus-black">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search by name or ABN..."
            className="flex-1 px-4 py-2 font-bold text-bauhaus-black placeholder:text-bauhaus-muted outline-none"
          />
          <button type="submit" className="px-6 py-2 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black/80">
            Search
          </button>
        </div>
      </form>

      {/* Filters row */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Type filters */}
        <div>
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1.5">Entity Type</div>
          <div className="flex flex-wrap gap-1.5">
            <Link href={`/entities?view=search${q ? `&q=${q}` : ''}${stateFilter ? `&state=${stateFilter}` : ''}${sort ? `&sort=${sort}` : ''}`}
              className={`text-[11px] font-black px-2.5 py-1 border-2 uppercase tracking-widest ${!type ? 'border-bauhaus-black bg-bauhaus-black text-white' : 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-black hover:border-bauhaus-black'}`}>
              All
            </Link>
            {ENTITY_TYPES.map(t => (
              <Link key={t.value} href={`/entities?view=search&type=${t.value}${q ? `&q=${q}` : ''}${stateFilter ? `&state=${stateFilter}` : ''}${sort ? `&sort=${sort}` : ''}`}
                className={`text-[11px] font-black px-2.5 py-1 border-2 uppercase tracking-widest ${type === t.value ? 'border-bauhaus-black bg-bauhaus-black text-white' : 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-black hover:border-bauhaus-black'}`}>
                {t.label}
              </Link>
            ))}
          </div>
        </div>

        {/* State filter */}
        <div>
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1.5">State</div>
          <div className="flex flex-wrap gap-1.5">
            <Link href={`/entities?view=search${q ? `&q=${q}` : ''}${type ? `&type=${type}` : ''}${sort ? `&sort=${sort}` : ''}`}
              className={`text-[11px] font-black px-2.5 py-1 border-2 uppercase tracking-widest ${!stateFilter ? 'border-bauhaus-black bg-bauhaus-black text-white' : 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-black hover:border-bauhaus-black'}`}>
              All
            </Link>
            {STATES.map(s => (
              <Link key={s} href={`/entities?view=search&state=${s}${q ? `&q=${q}` : ''}${type ? `&type=${type}` : ''}${sort ? `&sort=${sort}` : ''}`}
                className={`text-[11px] font-black px-2.5 py-1 border-2 uppercase tracking-widest ${stateFilter === s ? 'border-bauhaus-black bg-bauhaus-black text-white' : 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-black hover:border-bauhaus-black'}`}>
                {s}
              </Link>
            ))}
          </div>
        </div>

        {/* Sort */}
        <div>
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1.5">Sort By</div>
          <div className="flex flex-wrap gap-1.5">
            {SORT_OPTIONS.map(s => (
              <Link key={s.value} href={`/entities?view=search&sort=${s.value}${q ? `&q=${q}` : ''}${type ? `&type=${type}` : ''}${stateFilter ? `&state=${stateFilter}` : ''}`}
                className={`text-[11px] font-black px-2.5 py-1 border-2 uppercase tracking-widest ${(sort || 'source_count') === s.value ? 'border-bauhaus-black bg-bauhaus-black text-white' : 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-black hover:border-bauhaus-black'}`}>
                {s.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="border-4 border-bauhaus-black divide-y-2 divide-bauhaus-black/5">
          {results.map((r, i) => (
            <Link key={i} href={`/entities/${r.gs_id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-bauhaus-canvas transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-bauhaus-black truncate">{r.canonical_name as string}</span>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 border uppercase tracking-widest shrink-0 ${entityTypeBadge(r.entity_type as string)}`}>
                    {(r.entity_type as string).replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-[11px] text-bauhaus-muted font-medium mt-0.5">
                  {r.abn ? <span>ABN {String(r.abn)}</span> : <span>No ABN</span>}
                  {r.state ? <span> &middot; {String(r.state)}</span> : null}
                  {r.sector ? <span> &middot; {String(r.sector)}</span> : null}
                </div>
              </div>
              <div className="text-right ml-4 shrink-0">
                {(r.latest_revenue as number) ? (
                  <div className="text-sm font-black text-bauhaus-black">{formatMoney(r.latest_revenue as number)}</div>
                ) : null}
                <div className="text-[10px] font-bold text-bauhaus-muted">
                  {r.source_count as number} source{(r.source_count as number) !== 1 ? 's' : ''}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {needsQuery && results.length === 0 && (
        <p className="text-bauhaus-muted font-medium">
          {q ? <>No entities found for &ldquo;{q}&rdquo;</> : 'No entities match these filters'}
          {type || stateFilter ? ' — try broadening your filters' : ''}
        </p>
      )}

      {!needsQuery && (
        <div className="text-center py-12">
          <p className="text-bauhaus-muted font-medium mb-2">Search by name or ABN, or select a type filter above</p>
          <p className="text-xs text-bauhaus-muted">Tip: Use <kbd className="px-1.5 py-0.5 border border-bauhaus-black/20 font-black">&#8984;K</kbd> for global search from anywhere</p>
        </div>
      )}
    </div>
  );
}

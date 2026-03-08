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

export default async function EntityGraphPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; view?: string }>;
}) {
  const { q, type, view } = await searchParams;
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

  // Search view
  let results: Record<string, unknown>[] = [];
  if (q) {
    const { data } = await supabase
      .from('gs_entities')
      .select('id, gs_id, canonical_name, entity_type, abn, state, source_count, latest_revenue')
      .or(`canonical_name.ilike.%${q}%,abn.eq.${q}`)
      .order('source_count', { ascending: false })
      .limit(50);
    results = (data || []) as Record<string, unknown>[];
  } else if (type) {
    const { data } = await supabase
      .from('gs_entities')
      .select('id, gs_id, canonical_name, entity_type, abn, state, source_count, latest_revenue')
      .eq('entity_type', type)
      .order('source_count', { ascending: false })
      .limit(50);
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

      {/* Type filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {['charity', 'foundation', 'company', 'indigenous_corp', 'government_body', 'political_party'].map(t => (
          <Link key={t} href={`/entities?view=search&type=${t}`}
            className={`text-[11px] font-black px-2.5 py-1 border-2 uppercase tracking-widest ${type === t ? 'border-bauhaus-black bg-bauhaus-black text-white' : 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-black hover:border-bauhaus-black'}`}>
            {t.replace(/_/g, ' ')}
          </Link>
        ))}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="border-4 border-bauhaus-black divide-y-2 divide-bauhaus-black/5">
          {results.map((r, i) => (
            <Link key={i} href={`/entities/${r.gs_id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-bauhaus-canvas transition-colors">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-bauhaus-black truncate">{r.canonical_name as string}</div>
                <div className="text-[11px] text-bauhaus-muted font-medium">
                  {(r.entity_type as string).replace(/_/g, ' ')} &middot; {r.abn as string || 'No ABN'}
                  {r.state ? <span> &middot; {String(r.state)}</span> : null}
                </div>
              </div>
              <div className="text-right ml-4">
                <div className="text-xs font-bold text-bauhaus-muted">{r.source_count as number} source{(r.source_count as number) !== 1 ? 's' : ''}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {q && results.length === 0 && (
        <p className="text-bauhaus-muted font-medium">No entities found for &ldquo;{q}&rdquo;</p>
      )}
    </div>
  );
}

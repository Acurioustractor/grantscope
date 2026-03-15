import { getServiceSupabase } from '@/lib/supabase';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Market Scanner | CivicGraph',
  description: 'Search and explore the Australian government and social sector entity graph',
};

export const revalidate = 300;

interface MvEntityRow {
  id: string;
  gs_id: string;
  canonical_name: string;
  entity_type: string;
  abn: string | null;
  total_relationships: number;
  total_outbound_amount: number;
  total_inbound_amount: number;
  top_counterparty_share: number;
  distinct_counterparties: number;
}

function formatMoney(amount: number | null): string {
  if (!amount) return '\u2014';
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

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

function entityTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    charity: 'Charity', foundation: 'Foundation', company: 'Company',
    government_body: 'Government', indigenous_corp: 'Indigenous Corp',
    political_party: 'Political Party', social_enterprise: 'Social Enterprise',
  };
  return labels[type] || type;
}

function EntityRow({ e }: { e: MvEntityRow }) {
  const concentrationRisk = e.top_counterparty_share >= 0.6;
  return (
    <Link
      href={`/entities/${e.gs_id}`}
      className="flex items-center justify-between py-4 border-b-2 border-bauhaus-black/5 hover:bg-bauhaus-canvas/50 transition-colors -mx-2 px-2"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-black text-bauhaus-black truncate">{e.canonical_name}</span>
          <span className={`text-[9px] font-black px-1.5 py-0.5 border uppercase tracking-widest shrink-0 ${entityTypeBadge(e.entity_type)}`}>
            {entityTypeLabel(e.entity_type)}
          </span>
          {concentrationRisk && (
            <span className="text-[9px] font-black px-1.5 py-0.5 border-2 border-bauhaus-red bg-error-light text-bauhaus-red uppercase tracking-widest shrink-0">
              Concentration
            </span>
          )}
        </div>
        <div className="text-[11px] text-bauhaus-muted font-medium mt-0.5">
          {e.abn && <span>ABN {e.abn} &middot; </span>}
          {e.total_relationships.toLocaleString()} relationships &middot;{' '}
          {e.distinct_counterparties.toLocaleString()} counterparties
        </div>
      </div>
      <div className="text-right ml-4 shrink-0">
        <div className="font-black text-bauhaus-black">{formatMoney(e.total_outbound_amount + e.total_inbound_amount)}</div>
        <div className="text-[10px] text-bauhaus-muted font-medium">total value</div>
      </div>
    </Link>
  );
}

export default async function MarketScannerPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; sort?: string }>;
}) {
  const resolved = await searchParams;
  const query = resolved.q || '';
  const typeFilter = resolved.type || '';
  const sortBy = resolved.sort || 'relationships';
  const db = getServiceSupabase();

  // Search results
  let searchResults: MvEntityRow[] = [];
  if (query) {
    const escaped = query.replace(/[%_]/g, '');
    let q = db
      .from('mv_gs_entity_stats')
      .select('id, gs_id, canonical_name, entity_type, abn, total_relationships, total_outbound_amount, total_inbound_amount, top_counterparty_share, distinct_counterparties')
      .or(`canonical_name.ilike.%${escaped}%,abn.eq.${escaped}`)
      .limit(50);

    if (typeFilter) {
      q = q.eq('entity_type', typeFilter);
    }

    if (sortBy === 'amount') {
      q = q.order('total_outbound_amount', { ascending: false });
    } else {
      q = q.order('total_relationships', { ascending: false });
    }

    const { data } = await q;
    searchResults = (data || []) as MvEntityRow[];
  }

  // Leaderboards (always shown)
  const [
    { data: topByContracts },
    { data: topByRelationships },
    { data: topCharities },
  ] = await Promise.all([
    db
      .from('mv_gs_entity_stats')
      .select('id, gs_id, canonical_name, entity_type, abn, total_relationships, total_outbound_amount, total_inbound_amount, top_counterparty_share, distinct_counterparties')
      .order('total_outbound_amount', { ascending: false })
      .limit(10),
    db
      .from('mv_gs_entity_stats')
      .select('id, gs_id, canonical_name, entity_type, abn, total_relationships, total_outbound_amount, total_inbound_amount, top_counterparty_share, distinct_counterparties')
      .order('total_relationships', { ascending: false })
      .limit(10),
    db
      .from('mv_gs_entity_stats')
      .select('id, gs_id, canonical_name, entity_type, abn, total_relationships, total_outbound_amount, total_inbound_amount, top_counterparty_share, distinct_counterparties')
      .eq('entity_type', 'charity')
      .order('total_inbound_amount', { ascending: false })
      .limit(10),
  ]);

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl sm:text-3xl font-black text-bauhaus-black mb-2">Market Scanner</h1>
      <p className="text-sm text-bauhaus-muted font-medium mb-6">
        Search and explore the Australian government and social sector entity graph.
      </p>

      {/* Search form */}
      <form method="GET" className="mb-8">
        <div className="flex gap-0 border-4 border-bauhaus-black">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search by name or ABN..."
            className="flex-1 px-4 py-3 text-sm font-bold text-bauhaus-black placeholder:text-bauhaus-muted focus:outline-none"
          />
          <select
            name="type"
            defaultValue={typeFilter}
            className="px-3 py-3 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted border-l-2 border-bauhaus-black/10 focus:outline-none bg-white"
          >
            <option value="">All Types</option>
            <option value="charity">Charity</option>
            <option value="company">Company</option>
            <option value="government_body">Government</option>
            <option value="foundation">Foundation</option>
            <option value="indigenous_corp">Indigenous Corp</option>
            <option value="social_enterprise">Social Enterprise</option>
          </select>
          <select
            name="sort"
            defaultValue={sortBy}
            className="px-3 py-3 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted border-l-2 border-bauhaus-black/10 focus:outline-none bg-white"
          >
            <option value="relationships">Most Relationships</option>
            <option value="amount">Highest Value</option>
          </select>
          <button
            type="submit"
            className="px-6 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-blue transition-colors"
          >
            Search
          </button>
        </div>
      </form>

      {/* Search results */}
      {query && (
        <div className="mb-12">
          <h2 className="text-sm font-black text-bauhaus-black mb-4 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
            Results for &ldquo;{query}&rdquo; ({searchResults.length})
          </h2>
          {searchResults.length > 0 ? (
            <div>
              {searchResults.map((e) => (
                <EntityRow key={e.id} e={e} />
              ))}
            </div>
          ) : (
            <p className="text-bauhaus-muted font-bold py-8 text-center">No entities found matching &ldquo;{query}&rdquo;</p>
          )}
        </div>
      )}

      {/* Leaderboards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div>
          <h2 className="text-sm font-black text-bauhaus-black mb-4 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
            Top by Value
          </h2>
          {(topByContracts as MvEntityRow[] || []).map((e, i) => (
            <Link key={e.id} href={`/entities/${e.gs_id}`} className="flex items-center justify-between py-2 border-b border-bauhaus-black/5 hover:bg-bauhaus-canvas/50 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-black text-bauhaus-muted w-5">{i + 1}</span>
                <span className="text-sm font-bold text-bauhaus-black truncate">{e.canonical_name}</span>
              </div>
              <span className="text-xs font-black text-bauhaus-black shrink-0 ml-2">{formatMoney(e.total_outbound_amount)}</span>
            </Link>
          ))}
        </div>
        <div>
          <h2 className="text-sm font-black text-bauhaus-black mb-4 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
            Most Connected
          </h2>
          {(topByRelationships as MvEntityRow[] || []).map((e, i) => (
            <Link key={e.id} href={`/entities/${e.gs_id}`} className="flex items-center justify-between py-2 border-b border-bauhaus-black/5 hover:bg-bauhaus-canvas/50 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-black text-bauhaus-muted w-5">{i + 1}</span>
                <span className="text-sm font-bold text-bauhaus-black truncate">{e.canonical_name}</span>
              </div>
              <span className="text-xs font-black text-bauhaus-black shrink-0 ml-2">{e.total_relationships.toLocaleString()}</span>
            </Link>
          ))}
        </div>
        <div>
          <h2 className="text-sm font-black text-bauhaus-black mb-4 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
            Top Charities by Funding
          </h2>
          {(topCharities as MvEntityRow[] || []).map((e, i) => (
            <Link key={e.id} href={`/entities/${e.gs_id}`} className="flex items-center justify-between py-2 border-b border-bauhaus-black/5 hover:bg-bauhaus-canvas/50 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-black text-bauhaus-muted w-5">{i + 1}</span>
                <span className="text-sm font-bold text-bauhaus-black truncate">{e.canonical_name}</span>
              </div>
              <span className="text-xs font-black text-bauhaus-black shrink-0 ml-2">{formatMoney(e.total_inbound_amount)}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

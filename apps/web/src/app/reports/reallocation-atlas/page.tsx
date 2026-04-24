import type { Metadata } from 'next';
import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';
import { ReallocationAtlasClient } from './reallocation-atlas-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Reallocation Atlas | CivicGraph',
  description:
    'A place-first atlas showing where money goes, who holds power, and what community-led reallocation could unlock across Australia.',
};

type AtlasStatRow = { value: number | string | null };

type AtlasDesertRow = {
  lga_name: string;
  state: string;
  remoteness: string | null;
  desert_score: number | null;
  total_funding_all_sources: number | null;
  indexed_entities: number | null;
  community_controlled_entities: number | null;
};

type AtlasPowerRow = {
  canonical_name: string;
  entity_type: string;
  state: string | null;
  system_count: number | null;
  power_score: number | null;
  total_dollar_flow: number | null;
  procurement_dollars: number | null;
  justice_dollars: number | null;
  donation_dollars: number | null;
  is_community_controlled: boolean | null;
};

type AtlasSupplierRow = {
  supplier_name: string;
  supplier_abn: string | null;
  total_value: number | null;
  buyer_count: number | null;
};

type AtlasFlowRow = {
  domain: string;
  total_amount: number | null;
  flow_count: number | null;
};

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error('Reallocation atlas query failed:', error);
    return fallback;
  }
}

function firstValue(rows: AtlasStatRow[] | null | undefined): number {
  return Number(rows?.[0]?.value || 0);
}

async function getAtlasData() {
  const supabase = getServiceSupabase();

  const [
    fundingDeserts,
    peopleMapped,
    boardInterlocks,
    totalTracked,
    topDeserts,
    powerHolders,
    topSuppliers,
    flowDomains,
  ] = await Promise.all([
    safe(
      async () => {
        const { data, error } = await supabase.rpc('exec_sql', {
          query: 'SELECT COUNT(*) AS value FROM mv_funding_deserts',
        });
        if (error) throw error;
        return (data || []) as AtlasStatRow[];
      },
      [] as AtlasStatRow[],
    ),
    safe(
      async () => {
        const { data, error } = await supabase.rpc('exec_sql', {
          query: 'SELECT COUNT(*) AS value FROM mv_person_network',
        });
        if (error) throw error;
        return (data || []) as AtlasStatRow[];
      },
      [] as AtlasStatRow[],
    ),
    safe(
      async () => {
        const { data, error } = await supabase.rpc('exec_sql', {
          query: 'SELECT COUNT(*) AS value FROM mv_board_interlocks',
        });
        if (error) throw error;
        return (data || []) as AtlasStatRow[];
      },
      [] as AtlasStatRow[],
    ),
    safe(
      async () => {
        const { data, error } = await supabase.rpc('exec_sql', {
          query: 'SELECT COALESCE(SUM(amount), 0) AS value FROM money_flows WHERE year = 2025',
        });
        if (error) throw error;
        return (data || []) as AtlasStatRow[];
      },
      [] as AtlasStatRow[],
    ),
    safe(
      async () => {
        const { data, error } = await supabase.rpc('exec_sql', {
          query: `SELECT lga_name, state, remoteness, desert_score,
                         total_funding_all_sources, indexed_entities, community_controlled_entities
                  FROM mv_funding_deserts
                  WHERE desert_score IS NOT NULL
                    AND COALESCE(state, '') <> ''
                  ORDER BY desert_score DESC, community_controlled_entities ASC, total_funding_all_sources ASC
                  LIMIT 8`,
        });
        if (error) throw error;
        return (data || []) as AtlasDesertRow[];
      },
      [] as AtlasDesertRow[],
    ),
    safe(
      async () => {
        const { data, error } = await supabase.rpc('exec_sql', {
          query: `SELECT canonical_name, entity_type, state, system_count, power_score,
                         total_dollar_flow, procurement_dollars, justice_dollars,
                         donation_dollars, is_community_controlled
                  FROM mv_entity_power_index
                  WHERE canonical_name IS NOT NULL
                  ORDER BY power_score DESC NULLS LAST, total_dollar_flow DESC NULLS LAST
                  LIMIT 8`,
        });
        if (error) throw error;
        return (data || []) as AtlasPowerRow[];
      },
      [] as AtlasPowerRow[],
    ),
    safe(
      async () => {
        const { data, error } = await supabase.rpc('exec_sql', {
          query: `SELECT canonical_name AS supplier_name,
                         abn AS supplier_abn,
                         procurement_dollars AS total_value,
                         distinct_govt_buyers AS buyer_count
                  FROM mv_entity_power_index
                  WHERE procurement_dollars > 0
                    AND canonical_name IS NOT NULL
                  ORDER BY procurement_dollars DESC NULLS LAST
                  LIMIT 8`,
        });
        if (error) throw error;
        return (data || []) as AtlasSupplierRow[];
      },
      [] as AtlasSupplierRow[],
    ),
    safe(
      async () => {
        const { data, error } = await supabase.rpc('exec_sql', {
          query: `SELECT domain, SUM(amount) AS total_amount, COUNT(*) AS flow_count
                  FROM money_flows
                  WHERE year = 2025
                  GROUP BY domain
                  ORDER BY total_amount DESC
                  LIMIT 8`,
        });
        if (error) throw error;
        return (data || []) as AtlasFlowRow[];
      },
      [] as AtlasFlowRow[],
    ),
  ]);

  return {
    stats: {
      fundingDeserts: firstValue(fundingDeserts),
      peopleMapped: firstValue(peopleMapped),
      boardInterlocks: firstValue(boardInterlocks),
      totalTracked: firstValue(totalTracked),
    },
    topDeserts: topDeserts.map((row) => ({
      ...row,
      desert_score: Number(row.desert_score || 0),
      total_funding_all_sources: Number(row.total_funding_all_sources || 0),
      indexed_entities: Number(row.indexed_entities || 0),
      community_controlled_entities: Number(row.community_controlled_entities || 0),
    })),
    powerHolders: powerHolders.map((row) => ({
      ...row,
      system_count: Number(row.system_count || 0),
      power_score: Number(row.power_score || 0),
      total_dollar_flow: Number(row.total_dollar_flow || 0),
      procurement_dollars: Number(row.procurement_dollars || 0),
      justice_dollars: Number(row.justice_dollars || 0),
      donation_dollars: Number(row.donation_dollars || 0),
      is_community_controlled: Boolean(row.is_community_controlled),
    })),
    topSuppliers: topSuppliers.map((row) => ({
      ...row,
      total_value: Number(row.total_value || 0),
      buyer_count: Number(row.buyer_count || 0),
    })),
    flowDomains: flowDomains.map((row) => ({
      ...row,
      total_amount: Number(row.total_amount || 0),
      flow_count: Number(row.flow_count || 0),
    })),
  };
}

export default async function ReallocationAtlasPage() {
  const atlasData = await getAtlasData();

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/reports"
          className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black"
        >
          &larr; All Reports
        </Link>
        <div className="mt-4 mb-1 text-xs font-black uppercase tracking-widest text-bauhaus-blue">
          Flagship Atlas
        </div>
        <h1 className="mb-3 text-3xl font-black text-bauhaus-black sm:text-4xl">
          The Reallocation Atlas
        </h1>
        <p className="max-w-4xl text-base font-medium leading-relaxed text-bauhaus-muted sm:text-lg">
          A place-first operating surface for Australia: where money is thin, where power is concentrated,
          where community-controlled alternatives already exist, and how the next tranche of procurement,
          grants, and philanthropy could be re-routed toward community-led change.
        </p>
      </div>

      <ReallocationAtlasClient atlasData={atlasData} />
    </div>
  );
}

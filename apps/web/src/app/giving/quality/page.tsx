import { unstable_cache } from 'next/cache';
import { getServiceSupabase } from '@/lib/supabase';
import { PUBLIC_DATASET_KEYS, PUBLIC_DATASETS } from '@/lib/giving-commons';
import { GivingHeader, GivingSubnav } from '../_components';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Quality | Australian Giving Data Commons',
  description: 'Public data quality dashboard for the Australian Giving Data Commons.',
};

type CatalogHealth = {
  table_name: string;
  snapshot_at: string | null;
  row_count: number | null;
  freshness_hours: number | null;
  provenance_coverage_pct: number | null;
  confidence_coverage_pct: number | null;
  sla_hours: number | null;
};

function statusFor(row: CatalogHealth | undefined) {
  if (!row?.snapshot_at) return 'no snapshot';
  if (row.freshness_hours == null || row.sla_hours == null) return 'unknown';
  if (Number(row.freshness_hours) <= Number(row.sla_hours)) return 'fresh';
  if (Number(row.freshness_hours) <= Number(row.sla_hours) * 1.5) return 'watch';
  return 'stale';
}

function statusClass(status: string) {
  if (status === 'fresh') return 'bg-green-100 text-green-700 border-green-600';
  if (status === 'watch') return 'bg-yellow-100 text-yellow-700 border-yellow-600';
  if (status === 'stale') return 'bg-red-100 text-bauhaus-red border-bauhaus-red';
  return 'bg-bauhaus-canvas text-bauhaus-muted border-bauhaus-black/30';
}

function pct(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return 'n/a';
  return `${Number(value).toFixed(1)}%`;
}

function rows(value: number | null | undefined) {
  if (value == null) return 'n/a';
  return Number(value).toLocaleString('en-AU');
}

async function getCatalogHealth() {
  try {
    const db = getServiceSupabase();
    const tables = PUBLIC_DATASET_KEYS.map((key) => PUBLIC_DATASETS[key].table);
    const { data } = await db
      .from('v_data_catalog_latest')
      .select('table_name, snapshot_at, row_count, freshness_hours, provenance_coverage_pct, confidence_coverage_pct, sla_hours')
      .in('table_name', tables);

    return (data ?? []) as CatalogHealth[];
  } catch {
    return [] as CatalogHealth[];
  }
}

/** Cost + pooler load: catalog health is a nightly-grain measure; it does not need recomputing
 *  per request. Note the row shape above: this used to return a Map, which does NOT survive the
 *  cache — only plain JSON does — so the fetcher returns rows and the Map is built per render. */
const getCatalogHealthCached = unstable_cache(getCatalogHealth, ['giving-quality-catalog-health'], { revalidate: 3600 });

export default async function GivingQualityPage() {
  const health = new Map((await getCatalogHealthCached()).map((row) => [row.table_name, row]));
  const statuses = PUBLIC_DATASET_KEYS.map((key) => statusFor(health.get(PUBLIC_DATASETS[key].table)));
  const freshCount = statuses.filter((status) => status === 'fresh').length;
  const staleCount = statuses.filter((status) => status === 'stale').length;

  return (
    <div>
      <GivingHeader kicker="Quality dashboard" title="Show the gaps too.">
        Quality is public because trust depends on seeing freshness, provenance coverage, confidence coverage and caveats before using the data.
      </GivingHeader>
      <GivingSubnav />

      <section className="grid md:grid-cols-3 gap-0 mb-10">
        <div className="border-4 border-bauhaus-black bg-bauhaus-black text-white p-6">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">Public datasets</div>
          <div className="text-5xl font-black">{PUBLIC_DATASET_KEYS.length}</div>
        </div>
        <div className="border-4 md:border-l-0 max-md:border-t-0 border-bauhaus-black bg-white p-6">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Fresh</div>
          <div className="text-5xl font-black text-green-600">{freshCount}</div>
        </div>
        <div className="border-4 md:border-l-0 max-md:border-t-0 border-bauhaus-black bg-white p-6">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Stale</div>
          <div className="text-5xl font-black text-bauhaus-red">{staleCount}</div>
        </div>
      </section>

      <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bauhaus-black text-white">
              <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Dataset</th>
              <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Status</th>
              <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Rows</th>
              <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Freshness</th>
              <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Provenance</th>
              <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Confidence</th>
              <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Caveat</th>
            </tr>
          </thead>
          <tbody>
            {PUBLIC_DATASET_KEYS.map((key, index) => {
              const dataset = PUBLIC_DATASETS[key];
              const row = health.get(dataset.table);
              const status = statusFor(row);
              return (
                <tr key={key} className={index % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                  <td className="p-3 align-top min-w-56">
                    <div className="font-black text-bauhaus-black">{dataset.label}</div>
                    <div className="font-mono text-xs text-bauhaus-muted">{dataset.table}</div>
                  </td>
                  <td className="p-3 align-top">
                    <span className={`inline-block px-2 py-1 border-2 text-[10px] font-black uppercase tracking-widest ${statusClass(status)}`}>
                      {status}
                    </span>
                  </td>
                  <td className="p-3 align-top text-right font-mono">{rows(row?.row_count)}</td>
                  <td className="p-3 align-top text-right font-mono">{row?.freshness_hours == null ? 'n/a' : `${Number(row.freshness_hours).toFixed(1)}h`}</td>
                  <td className="p-3 align-top text-right font-mono">{pct(row?.provenance_coverage_pct)}</td>
                  <td className="p-3 align-top text-right font-mono">{pct(row?.confidence_coverage_pct)}</td>
                  <td className="p-3 align-top min-w-72 text-bauhaus-muted font-medium">{dataset.caveats[0]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

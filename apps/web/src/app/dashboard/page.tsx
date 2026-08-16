import Link from 'next/link';
import { Money, Buildings, LinkSimple, Files } from '@phosphor-icons/react/dist/ssr';
import { getDirectServiceSupabase } from '@/lib/supabase';
import { themeMoney, money, type ThemeMoney } from '@/lib/justice-money';
import { VIEW_REGISTRY } from '@/lib/view-registry';

/** Hourly is fresh enough for counts that change nightly; themeMoney is built for this cadence. */
export const revalidate = 3600;

interface RemotenessBucket {
  label: string;
  dollars: number;
  entities: number;
}

/** Canonical ABS remoteness order; raw values are matched by substring, unmatched rows are counted and disclosed. */
const REMOTENESS_ORDER: [string, string][] = [
  ['major cities', 'Major cities'],
  ['inner regional', 'Inner regional'],
  ['outer regional', 'Outer regional'],
  ['very remote', 'Very remote'],
  ['remote', 'Remote'],
];

async function fundingByRemoteness(): Promise<{ buckets: RemotenessBucket[]; unmapped: number }> {
  const supabase = getDirectServiceSupabase();
  const PAGE = 1000;
  const byLabel = new Map<string, RemotenessBucket>();
  let unmapped = 0;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('mv_funding_by_postcode')
      .select('remoteness,entity_count,total_funding')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`remoteness query failed: ${error.message}`);
    const page = (data ?? []) as { remoteness: string | null; entity_count: number | null; total_funding: number | null }[];
    for (const row of page) {
      const raw = (row.remoteness ?? '').toLowerCase();
      // 'remote' is a substring of 'very remote' — REMOTENESS_ORDER lists the longer match first.
      const hit = REMOTENESS_ORDER.find(([needle]) => raw.includes(needle));
      if (!hit) {
        unmapped += 1;
        continue;
      }
      const bucket = byLabel.get(hit[1]) ?? { label: hit[1], dollars: 0, entities: 0 };
      bucket.dollars += row.total_funding ?? 0;
      bucket.entities += row.entity_count ?? 0;
      byLabel.set(hit[1], bucket);
    }
    if (page.length < PAGE) break;
  }
  const display = ['Major cities', 'Inner regional', 'Outer regional', 'Remote', 'Very remote'];
  return { buckets: display.map((l) => byLabel.get(l)).filter((b): b is RemotenessBucket => Boolean(b)), unmapped };
}

async function count(table: string): Promise<number | null> {
  const supabase = getDirectServiceSupabase();
  const { count: n, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  return error ? null : n;
}

export default async function DashboardPage() {
  const [yj, remoteness, entityCount, contractCount] = await Promise.all([
    themeMoney(['youth-justice']),
    fundingByRemoteness(),
    count('gs_entities'),
    count('austender_contracts'),
  ]);

  const tiles = buildTiles(yj, entityCount, contractCount);
  const maxDollars = Math.max(...remoteness.buckets.map((b) => b.dollars), 1);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="shell-card flex flex-col gap-2 px-4.5 py-4">
            <div className="flex items-center gap-2">
              <span
                className="flex h-6 w-6 items-center justify-center"
                style={{ background: t.colour, borderRadius: 'var(--shell-r-sm)' }}
              >
                <t.icon size={14} weight="bold" color="#FFFFFF" />
              </span>
              <span className="text-[12.5px] font-semibold" style={{ color: 'var(--shell-muted)' }}>
                {t.label}
              </span>
            </div>
            <div className="font-display text-[30px] font-extrabold leading-none">{t.value}</div>
            <div className="text-xs" style={{ color: 'var(--shell-muted)' }}>
              {t.sub}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 xl:flex-row">
        <section className="shell-card flex min-w-0 flex-1 flex-col gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-[15px] font-bold">Where the money sits — by remoteness</h2>
            <div className="flex-1" />
            <span className="text-xs" style={{ color: 'var(--shell-muted)' }}>
              All funding on the graph, grouped by postcode remoteness
            </span>
          </div>
          <div className="flex h-64 items-end gap-6 px-2">
            {remoteness.buckets.map((b) => (
              <div key={b.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className="font-mono text-[11.5px]" style={{ color: 'var(--shell-muted)' }}>
                  {money(b.dollars)}
                </span>
                <div
                  className="w-full"
                  style={{
                    height: `${Math.max((b.dollars / maxDollars) * 100, 2)}%`,
                    background: 'var(--shell-ink)',
                    borderRadius: '4px 4px 0 0',
                  }}
                />
                <span className="text-xs font-medium" style={{ color: 'var(--shell-muted)' }}>
                  {b.label}
                </span>
              </div>
            ))}
          </div>
          {remoteness.unmapped > 0 && (
            <p className="text-[11px]" style={{ color: 'var(--shell-muted)' }}>
              {remoteness.unmapped.toLocaleString()} postcode rows had no remoteness classification and are not shown.
            </p>
          )}
        </section>

        <section className="shell-card flex w-full flex-col px-5 py-4 xl:w-[420px]">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-[15px] font-bold">Top recipients — youth justice</h2>
            <div className="flex-1" />
            <Link href="/themes/youth-justice" className="text-[12.5px] font-semibold" style={{ color: '#1040C0' }}>
              See all →
            </Link>
          </div>
          <div className="mt-2 flex flex-col">
            {(yj?.top ?? []).slice(0, 6).map((r) => (
              <div
                key={r.name}
                className="flex items-center gap-2.5 py-2.5"
                style={{ borderBottom: '1px solid var(--shell-line)' }}
              >
                <span
                  className="shell-control flex h-[30px] w-[30px] shrink-0 items-center justify-center font-display text-[13px] font-bold"
                  style={{ background: 'var(--shell-canvas)' }}
                >
                  {r.name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  {r.gsId ? (
                    <Link href={`/entity/${r.gsId}`} className="block truncate text-[13.5px] font-semibold">
                      {r.name}
                    </Link>
                  ) : (
                    <span className="block truncate text-[13.5px] font-semibold">{r.name}</span>
                  )}
                  <span className="text-[11.5px]" style={{ color: 'var(--shell-muted)' }}>
                    {r.grants.toLocaleString()} grants
                  </span>
                </div>
                <span className="font-mono text-[13px]">{money(r.dollars)}</span>
              </div>
            ))}
            {!yj && (
              <p className="py-4 text-sm" style={{ color: 'var(--shell-muted)' }}>
                Youth justice money is unavailable right now.
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {VIEW_REGISTRY.map((v) => (
          <Link key={v.id} href={v.href} className="shell-card flex flex-col gap-1.5 px-4.5 py-4">
            <span className="text-[13.5px] font-bold">{v.name}</span>
            <span className="text-[12.5px]" style={{ color: 'var(--shell-muted)' }}>
              {v.question}
            </span>
            {v.caveat && (
              <span className="text-[11px] italic" style={{ color: 'var(--shell-muted)' }}>
                {v.caveat}
              </span>
            )}
          </Link>
        ))}
      </section>
    </div>
  );
}

function buildTiles(yj: ThemeMoney | null, entityCount: number | null, contractCount: number | null) {
  return [
    {
      label: 'Youth justice grants',
      value: yj ? money(yj.total) : '—',
      sub: yj
        ? `${yj.firstYear ?? '?'}–${yj.lastYear ?? '?'} · ${money(yj.excludedDollars)} of aggregates excluded`
        : 'unavailable',
      colour: '#D02020',
      icon: Money,
    },
    {
      label: 'Organisations funded',
      value: yj ? yj.organisationCount.toLocaleString() : '—',
      sub: 'distinct youth justice recipients',
      colour: '#F0C020',
      icon: Buildings,
    },
    {
      label: 'Entities on the graph',
      value: entityCount != null ? compact(entityCount) : '—',
      sub: 'organisations and people, cross-linked',
      colour: '#1040C0',
      icon: LinkSimple,
    },
    {
      label: 'Contracts tracked',
      value: contractCount != null ? compact(contractCount) : '—',
      sub: 'AusTender, full published history',
      colour: '#059669',
      icon: Files,
    },
  ];
}

function compact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(n);
}

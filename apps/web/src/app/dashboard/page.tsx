import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { Money, Buildings, LinkSimple, Files } from '@phosphor-icons/react/dist/ssr';
import { getDirectServiceSupabase } from '@/lib/supabase';
import { themeMoney, money, type ThemeMoney } from '@/lib/justice-money';
import { VIEW_REGISTRY } from '@/lib/view-registry';
import { financialYearVocab, topicVocab, topicLabel } from '@/lib/vocab';
import { ShellFilters } from '@/components/shell/shell-filters';
import { allThemes } from '@/app/reports/theme/themes';

// Reading searchParams makes this page dynamic, so the hourly cadence moves from page-level
// `revalidate` to unstable_cache around each data loader — one DB scan per (topic, year)
// combination per hour, never one per hit (the August pooler-saturation pattern).

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

async function fundingByRemoteness(
  topic: string,
  fy: string,
): Promise<{ buckets: RemotenessBucket[]; unplacedDollars: number; unplacedGrants: number }> {
  const supabase = getDirectServiceSupabase();
  const { data, error } = await supabase.rpc('funding_remoteness_by_topic', {
    p_topic: topic,
    p_fy: fy === '' ? null : fy,
  });
  if (error) throw new Error(`remoteness query failed: ${error.message}`);
  const rows = (data ?? []) as { remoteness: string; dollars: number | null; grants: number | null }[];

  let unplacedDollars = 0;
  let unplacedGrants = 0;
  const byLabel = new Map<string, RemotenessBucket>();
  for (const row of rows) {
    const raw = (row.remoteness ?? '').toLowerCase();
    // 'remote' is a substring of 'very remote' — REMOTENESS_ORDER lists the longer match first.
    const hit = REMOTENESS_ORDER.find(([needle]) => raw.includes(needle));
    if (!hit) {
      unplacedDollars += Number(row.dollars ?? 0);
      unplacedGrants += Number(row.grants ?? 0);
      continue;
    }
    const bucket = byLabel.get(hit[1]) ?? { label: hit[1], dollars: 0, entities: 0 };
    bucket.dollars += Number(row.dollars ?? 0);
    bucket.entities += Number(row.grants ?? 0);
    byLabel.set(hit[1], bucket);
  }
  const display = ['Major cities', 'Inner regional', 'Outer regional', 'Remote', 'Very remote'];
  return {
    buckets: display.map((l) => byLabel.get(l)).filter((b): b is RemotenessBucket => Boolean(b)),
    unplacedDollars,
    unplacedGrants,
  };
}

async function count(table: string): Promise<number | null> {
  const supabase = getDirectServiceSupabase();
  const { count: n, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  return error ? null : n;
}

const cachedRemoteness = unstable_cache(fundingByRemoteness, ['dash-remoteness'], {
  revalidate: 3600,
});
const cachedCount = unstable_cache(count, ['dash-count'], { revalidate: 3600 });
const cachedTopicVocab = unstable_cache(topicVocab, ['dash-topic-vocab'], { revalidate: 3600 });
const cachedYearVocab = unstable_cache(financialYearVocab, ['dash-year-vocab'], {
  revalidate: 3600,
});
const cachedThemeMoney = unstable_cache(
  (topic: string, fy: string) =>
    themeMoney([topic], 15, { financialYear: fy === '' ? undefined : fy }),
  ['dash-theme-money'],
  { revalidate: 3600 },
);

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; fy?: string }>;
}) {
  const params = await searchParams;
  const [topics, years] = await Promise.all([cachedTopicVocab(), cachedYearVocab()]);

  // Params are only honoured when they exist in the DB vocabulary — an unknown value falls back
  // rather than feeding themeMoney a filter that silently matches nothing.
  const topic =
    params.topic && topics.some((t) => t.value === params.topic) ? params.topic : 'youth-justice';
  const fy = params.fy && years.some((y) => y.value === params.fy) ? params.fy : null;

  const [selected, remoteness, entityCount, contractCount] = await Promise.all([
    cachedThemeMoney(topic, fy ?? ''),
    cachedRemoteness(topic, fy ?? ''),
    cachedCount('gs_entities'),
    cachedCount('austender_contracts'),
  ]);

  const topicName = topicLabel(topic);
  const theme = allThemes().find((t) => t.topicTags.includes(topic));
  const tiles = buildTiles(selected, entityCount, contractCount, topicName, fy);
  const remotenessTotal = Math.max(remoteness.buckets.reduce((s, b) => s + b.dollars, 0), 1);

  return (
    <div className="flex flex-col gap-5">
      {(topics.length > 0 || years.length > 0) && (
        <div className="flex items-center gap-3">
          <ShellFilters topics={topics} years={years} activeTopic={topic} activeYear={fy} />
          <span className="text-xs" style={{ color: 'var(--shell-muted)' }}>
            Scopes the money tiles and top recipients. Options come from the data, not a list.
          </span>
        </div>
      )}
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
            <h2 className="font-display text-[15px] font-bold">
              Where {topicName.toLowerCase()} money sits — by remoteness
              {fy ? ` · ${fy}` : ''}
            </h2>
            <div className="flex-1" />
            <span className="text-xs" style={{ color: 'var(--shell-muted)' }}>
              Same basis as the tiles — grants only, aggregates and total-rows removed
            </span>
          </div>
          {/* Shares, not raw bars (Ben's call, SH-2): a linear dollar scale made every bucket
              except Major cities invisible — the exact inequity the chart exists to show. */}
          <div className="flex flex-col gap-3 px-2 py-1">
            {remoteness.buckets.map((b) => {
              const share = (b.dollars / remotenessTotal) * 100;
              return (
                <div key={b.label} className="flex items-center gap-3">
                  <span className="w-[104px] shrink-0 text-xs font-medium" style={{ color: 'var(--shell-muted)' }}>
                    {b.label}
                  </span>
                  <div className="h-4 min-w-0 flex-1" style={{ background: 'var(--shell-line)', borderRadius: 3 }}>
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.max(share, 0.5)}%`,
                        background: share >= 50 ? 'var(--shell-ink)' : '#D02020',
                        borderRadius: 3,
                      }}
                    />
                  </div>
                  <span className="w-[130px] shrink-0 text-right font-mono text-[11.5px]" style={{ color: 'var(--shell-muted)' }}>
                    {share >= 1 ? share.toFixed(0) : share.toFixed(1)}% · {money(b.dollars)}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[11px]" style={{ color: 'var(--shell-muted)' }}>
            Shares of the {topicName.toLowerCase()} money that could be placed. The red bars are the whole
            story: everywhere outside the major cities shares {(100 - (remoteness.buckets[0] ? (remoteness.buckets[0].dollars / remotenessTotal) * 100 : 0)).toFixed(0)}% of it.
          </p>
          {remoteness.unplacedDollars > 0 && (
            <p className="text-[11px]" style={{ color: 'var(--shell-muted)' }}>
              A further {money(remoteness.unplacedDollars)} across {remoteness.unplacedGrants.toLocaleString()} grants
              is not shown: the grant is not linked to an entity, or the entity has no remoteness. The shares
              above are of the placed money only.
            </p>
          )}
        </section>

        <section className="shell-card flex w-full flex-col px-5 py-4 xl:w-[420px]">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-[15px] font-bold">
              Top recipients — {topicName.toLowerCase()}
              {fy ? ` · ${fy}` : ''}
            </h2>
            <div className="flex-1" />
            <Link
              href={theme ? `/reports/theme/${theme.slug}` : '/reports/theme'}
              className="text-[12.5px] font-semibold"
              style={{ color: '#1040C0' }}
            >
              See all →
            </Link>
          </div>
          <div className="mt-2 flex flex-col">
            {(selected?.top ?? []).slice(0, 6).map((r) => (
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
                    {r.grants.toLocaleString()} grant{r.grants === 1 ? '' : 's'}
                  </span>
                </div>
                <span className="font-mono text-[13px]">{money(r.dollars)}</span>
              </div>
            ))}
            {!selected && (
              <p className="py-4 text-sm" style={{ color: 'var(--shell-muted)' }}>
                No {topicName.toLowerCase()} grants{fy ? ` in ${fy}` : ''}, or the query failed —
                nothing is shown rather than a stale figure.
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

function buildTiles(
  selected: ThemeMoney | null,
  entityCount: number | null,
  contractCount: number | null,
  topicName: string,
  fy: string | null,
) {
  return [
    {
      label: `${topicName} grants`,
      value: selected ? money(selected.total) : '—',
      // Zero-valued filter notes are noise (polish F3): the exclusion clause appears only when
      // the aggregate filter actually removed dollars for this scope.
      sub: selected
        ? `${fy ?? `${selected.firstYear ?? '?'}–${selected.lastYear ?? '?'}`}${
            selected.excludedDollars > 0
              ? ` · ${money(selected.excludedDollars)} of aggregates excluded`
              : ''
          }`
        : 'unavailable',
      colour: '#D02020',
      icon: Money,
    },
    {
      label: 'ACCO share',
      value: selected ? `${selected.accoPctOfLinked}%` : '—',
      sub: selected
        ? `${money(selected.accoDollars)} of ${money(selected.linkedDollars)} linked ${topicName.toLowerCase()} money`
        : 'unavailable',
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

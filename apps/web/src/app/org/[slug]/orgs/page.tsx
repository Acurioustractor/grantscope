// Orgs — one searchable list of every Org ACT holds a relationship with.
// This folds the old Listen lens: each row opens the Org record. Quiet Ledger
// skin; cards / table / compact density via URL param (GoodsViewToggle pattern).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isActSlug } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getActOrgList, DOMAIN_REL_LABEL, ASK_STAGE_LABEL, type ActDomainRelType, type ActOrgListRow } from '@/lib/services/act-org-record';
import { resolveViewMode, type GoodsViewMode } from '@/app/org/[slug]/goods/_components/goods-view-toggle';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Orgs — every relationship ACT holds — CivicGraph' };
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-AU')}`;

const REL_CHIP: Record<ActDomainRelType, string> = {
  funds: 'bg-ql-kind-funder', buys: 'bg-ql-kind-buyer', distributes: 'bg-ql-moss',
  auspices: 'bg-ql-accent', collaborates: 'bg-ql-kind-commitment', opens: 'bg-ql-kind-grant',
};

function ago(iso: string | null): string {
  if (!iso) return 'never';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days < 60) return `${days}d`;
  if (days < 730) return `${Math.round(days / 30)}mo`;
  return `${Math.round(days / 365)}y`;
}

function RelChips({ row }: { row: ActOrgListRow }) {
  return (
    <span className="flex flex-wrap gap-1">
      {row.relationships.map((rel) => (
        <span key={rel} className={`rounded px-1.5 py-0.5 font-ql-mono text-[8.5px] font-semibold uppercase tracking-[0.08em] text-ql-inverse ${REL_CHIP[rel]}`}>
          {DOMAIN_REL_LABEL[rel]}
        </span>
      ))}
      {row.relationships.length === 0 && <span className="font-ql-mono text-[9px] uppercase text-ql-muted">no type yet</span>}
    </span>
  );
}

function Warmth({ value }: { value: number | null }) {
  if (value == null) return <span className="font-ql-mono text-[10px] text-ql-muted">—</span>;
  const tone = value >= 70 ? 'text-ql-alert' : value >= 50 ? 'text-ql-accent' : value >= 25 ? 'text-ql-ink' : 'text-ql-muted';
  return <span className={`font-ql-mono text-[11px] font-semibold ${tone}`}>{value}</span>;
}

export default async function ActOrgsListPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  if (!isActSlug(slug)) notFound();
  const profile = await getOrgProfileBySlug(slug).catch(() => null);
  if (!profile) notFound();
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  const density = resolveViewMode(sp.density, 'table');

  const all = await getActOrgList(slug, profile.id);
  const rows = q ? all.filter((row) => row.name.toLowerCase().includes(q.toLowerCase())) : all;
  const href = (extra: Record<string, string>) => {
    const merged = new URLSearchParams({ ...(q ? { q } : {}), density, ...extra });
    return `/org/${slug}/orgs?${merged.toString()}`;
  };

  return (
    <main className="min-h-screen bg-ql-surface2 p-6 text-ql-ink" data-testid="act-orgs-list">
      <div className="mx-auto max-w-[1760px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-ql-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ql-accent">
              {rows.length} of {all.length} orgs
            </div>
            <h1 className="mt-1 font-ql-display text-4xl font-semibold">Orgs</h1>
            <p className="mt-1.5 text-sm text-ql-text2">Every organisation ACT holds a relationship with. Each row opens the Org record.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <form action={`/org/${slug}/orgs`} className="flex items-center gap-2">
              <input type="hidden" name="density" value={density} />
              <input
                type="search" name="q" defaultValue={q} placeholder="Search orgs…"
                className="rounded-md border border-ql-border bg-ql-surface px-3 py-1.5 text-sm text-ql-ink placeholder:text-ql-muted focus:border-ql-accent focus:outline-none"
              />
            </form>
            <span className="flex overflow-hidden rounded-md border border-ql-border">
              {(['cards', 'table', 'compact'] as GoodsViewMode[]).map((mode) => (
                <Link
                  key={mode} href={href({ density: mode })}
                  className={`px-3 py-1.5 font-ql-mono text-[10px] font-semibold uppercase tracking-[0.08em] ${density === mode ? 'bg-ql-bar text-ql-inverse' : 'bg-ql-surface text-ql-text2 hover:bg-ql-surface2'}`}
                >
                  {mode}
                </Link>
              ))}
            </span>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="mt-8 text-sm text-ql-text2">No orgs match{q ? ` “${q}”` : ''}.</p>
        ) : density === 'cards' ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => (
              <Link key={row.slug} href={`/org/${slug}/orgs/${row.slug}`} className="rounded-lg border border-ql-border bg-ql-surface p-4 hover:border-ql-muted">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-ql-display text-lg font-semibold leading-tight">{row.name}</span>
                  <Warmth value={row.warmth} />
                </div>
                <div className="mt-2"><RelChips row={row} /></div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-ql-mono text-[10px] text-ql-text2">
                  {row.stage && <span>{ASK_STAGE_LABEL[row.stage]}</span>}
                  {row.outstandingTotal > 0 && <span className="font-semibold text-ql-alert">{money(row.outstandingTotal)} outstanding</span>}
                  {row.receivedTotal > 0 && <span className="text-ql-moss">{money(row.receivedTotal)} in</span>}
                  <span>touch {ago(row.lastContactAt)}</span>
                </div>
                {row.nextAction && <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-ql-text2">{row.nextAction}</p>}
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-lg border border-ql-border bg-ql-surface">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ql-border font-ql-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-ql-text2">
                  <th className="px-4 py-2">Org</th>
                  <th className="px-4 py-2">Relationships</th>
                  <th className="px-4 py-2">Warmth</th>
                  {density === 'table' && <th className="px-4 py-2">Stage</th>}
                  <th className="px-4 py-2 text-right">Outstanding</th>
                  {density === 'table' && <th className="px-4 py-2 text-right">Money in</th>}
                  <th className="px-4 py-2">Touch</th>
                  {density === 'table' && <th className="px-4 py-2">Next move</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.slug} className="border-b border-ql-border/60 last:border-b-0 hover:bg-ql-surface2">
                    <td className="px-4 py-2 font-semibold">
                      <Link href={`/org/${slug}/orgs/${row.slug}`} className="hover:text-ql-accent">{row.name}</Link>
                    </td>
                    <td className="px-4 py-2"><RelChips row={row} /></td>
                    <td className="px-4 py-2"><Warmth value={row.warmth} /></td>
                    {density === 'table' && <td className="px-4 py-2 text-[12px] text-ql-text2">{row.stage ? ASK_STAGE_LABEL[row.stage] : '—'}</td>}
                    <td className={`px-4 py-2 text-right font-ql-mono text-[12px] ${row.outstandingTotal > 0 ? 'font-semibold text-ql-alert' : 'text-ql-muted'}`}>
                      {row.outstandingTotal > 0 ? money(row.outstandingTotal) : '—'}
                    </td>
                    {density === 'table' && (
                      <td className="px-4 py-2 text-right font-ql-mono text-[12px] text-ql-text2">{row.receivedTotal > 0 ? money(row.receivedTotal) : '—'}</td>
                    )}
                    <td className="px-4 py-2 font-ql-mono text-[11px] text-ql-text2">{ago(row.lastContactAt)}</td>
                    {density === 'table' && <td className="max-w-[420px] truncate px-4 py-2 text-[12px] text-ql-text2">{row.nextAction ?? '—'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 font-ql-mono text-[10px] text-ql-muted">
          Legacy Listen view: <Link href={`/org/${slug}?view=relationships#relationships`} className="underline hover:text-ql-ink">?view=relationships</Link>
        </p>
      </div>
    </main>
  );
}

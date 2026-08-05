// The One Desk — promoted from /prototype-one (Ben picked variant B, 2026-08-05,
// with A's "do this now" hero and C's urgency grouping folded in). One ranked
// pool over every workable record; project and type are filters, never places.
// Skin: Quiet Ledger (the ONE visual family — tokens mirror pencil-new.pen).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isActSlug } from '@/lib/services/fast-local-org';
import { getOneDesk, deskHorizon, type DeskRecord, type DeskHorizon } from '@/lib/services/act-one-desk';
import { DeskMarkButtons } from './desk-mark-buttons';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'One Desk — everything ranked — CivicGraph' };
}

const KIND_STYLE: Record<DeskRecord['kind'], string> = {
  funder: 'bg-ql-kind-funder', grant: 'bg-ql-kind-grant', buyer: 'bg-ql-kind-buyer',
  money: 'bg-ql-kind-money', commitment: 'bg-ql-kind-commitment',
};

const HORIZON_LABEL: Record<DeskHorizon, string> = {
  overdue: 'Overdue', fortnight: 'This fortnight', quarter: 'This quarter', undated: 'No date · ranked by fit',
};

function Due({ d }: { d: number | null }) {
  if (d == null) return <span className="font-ql-mono text-[10px] text-ql-muted">—</span>;
  if (d < 0) return <span className="font-ql-mono text-[10px] font-semibold text-ql-alert">{-d}d overdue</span>;
  if (d <= 14) return <span className="font-ql-mono text-[10px] font-semibold text-ql-alert">{d}d</span>;
  return <span className="font-ql-mono text-[10px] font-medium text-ql-ink">{d}d</span>;
}

function KindChip({ k }: { k: DeskRecord['kind'] }) {
  return (
    <span className={`rounded px-1.5 py-0.5 font-ql-mono text-[8.5px] font-semibold uppercase tracking-[0.08em] text-ql-inverse ${KIND_STYLE[k]}`}>
      {k === 'commitment' ? 'commit' : k}
    </span>
  );
}

export default async function OneDeskPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  if (!isActSlug(slug)) notFound();
  const sp = await searchParams;
  const kind = typeof sp.kind === 'string' && ['funder', 'grant', 'buyer', 'money', 'commitment'].includes(sp.kind) ? (sp.kind as DeskRecord['kind']) : null;
  const project = typeof sp.project === 'string' ? sp.project : null;

  const { active: all, handled, orgProfileId } = await getOneDesk(slug);
  const projects = [...new Set(all.map((r) => r.project))].sort();
  const pool = all.filter((r) => (!kind || r.kind === kind) && (!project || r.project === project));
  const selected = (typeof sp.rec === 'string' ? pool.find((r) => r.id === sp.rec) : null) ?? pool[0] ?? null;
  const base = `/org/${slug}/desk`;
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...(kind ? { kind } : {}), ...(project ? { project } : {}), ...extra });
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };

  const groups: Array<{ horizon: DeskHorizon; items: DeskRecord[] }> = [];
  for (const r of pool.slice(0, 80)) {
    const h = deskHorizon(r);
    const last = groups[groups.length - 1];
    if (last && last.horizon === h) last.items.push(r);
    else groups.push({ horizon: h, items: [r] });
  }

  const chip = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-[11px] font-medium transition-colors ${
      active ? 'border-ql-bar bg-ql-bar text-ql-inverse' : 'border-ql-border bg-ql-surface text-ql-text2 hover:border-ql-muted'
    }`;

  return (
    <main className="min-h-screen bg-ql-surface2 p-6 text-ql-ink">
      <div className="mx-auto max-w-[1760px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-ql-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ql-accent">
              One pool · deadline first · {all.length} records{handled.length > 0 ? ` · ${handled.length} handled today` : ''}
            </div>
            <h1 className="mt-1 font-ql-display text-4xl font-semibold">One Desk</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {projects.map((p) => (
              <Link key={p} href={project === p ? (kind ? `${base}?kind=${kind}` : base) : qs({ project: p })} className={chip(project === p)}>
                {p}{project === p ? ' ✕' : ''}
              </Link>
            ))}
            <span className="mx-1 text-ql-muted">·</span>
            {([null, 'money', 'commitment', 'funder', 'grant', 'buyer'] as const).map((k) => (
              <Link
                key={k ?? 'all'}
                href={k ? (project ? `${base}?kind=${k}&project=${encodeURIComponent(project)}` : `${base}?kind=${k}`) : (project ? `${base}?project=${encodeURIComponent(project)}` : base)}
                className={chip(kind === k)}
              >
                {k ?? 'everything'}
              </Link>
            ))}
          </div>
        </div>

        {/* A's contribution: the single directed move, always on top. */}
        {selected && selected.id === pool[0]?.id ? (
          <div className="mt-5 flex flex-wrap items-baseline gap-3 rounded-lg border border-ql-border bg-ql-warm px-5 py-3">
            <span className="font-ql-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ql-accent">Do this now</span>
            <span className="font-ql-display text-lg font-semibold">{pool[0].name}</span>
            <span className="text-sm text-ql-text2">{pool[0].next}</span>
          </div>
        ) : null}

        {/* B: the split desk. */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="max-h-[74vh] overflow-y-auto rounded-lg border border-ql-border bg-ql-surface">
            {groups.map((group) => (
              <div key={group.horizon}>
                <div className={`sticky top-0 z-10 px-4 py-1.5 font-ql-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-ql-inverse ${group.horizon === 'overdue' ? 'bg-ql-alert' : 'bg-ql-bar'}`}>
                  {HORIZON_LABEL[group.horizon]} · {group.items.length}
                </div>
                {group.items.map((r) => (
                  <Link
                    key={r.id}
                    href={qs({ rec: r.id })}
                    className={`flex items-center gap-2.5 border-t border-ql-border/60 px-4 py-2.5 text-sm first:border-t-0 ${selected?.id === r.id ? 'bg-ql-warm' : 'hover:bg-ql-surface2'}`}
                  >
                    <KindChip k={r.kind} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
                    {r.amount && <span className="font-ql-mono text-[11px] font-semibold">{r.amount}</span>}
                    <Due d={r.dueDays} />
                  </Link>
                ))}
              </div>
            ))}
            {pool.length === 0 ? <div className="px-4 py-10 text-center text-sm text-ql-text2">Nothing matches this filter.</div> : null}
          </div>

          <div className="rounded-lg border border-ql-border bg-ql-surface p-7">
            {selected ? (
              <>
                <div className="flex items-center gap-2.5">
                  <KindChip k={selected.kind} />
                  <span className="font-ql-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-ql-text2">{selected.signal}</span>
                </div>
                <h2 className="mt-2.5 font-ql-display text-3xl font-semibold leading-tight">{selected.name}</h2>
                <div className="mt-2 flex items-center gap-3">
                  {selected.amount && <span className="font-ql-mono text-sm font-semibold">{selected.amount}</span>}
                  <Due d={selected.dueDays} />
                </div>
                <div className="mt-5 rounded-md bg-ql-warm px-4 py-3">
                  <div className="font-ql-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-ql-accent">Next move</div>
                  <p className="mt-1 text-sm font-medium leading-6">{selected.next}</p>
                </div>
                {orgProfileId ? (
                  <div className="mt-5">
                    <DeskMarkButtons orgProfileId={orgProfileId} actionId={selected.id} title={selected.name} detail={selected.next} />
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {selected.ghlUrl && (
                    <a href={selected.ghlUrl} target="_blank" rel="noopener noreferrer" className="rounded-md border border-ql-border bg-ql-surface px-4 py-2 text-xs font-semibold text-ql-accent hover:bg-ql-surface2">
                      Open in GHL ↗
                    </a>
                  )}
                  {selected.workHref && (
                    <Link href={selected.workHref} className="rounded-md border border-ql-border bg-ql-surface px-4 py-2 text-xs font-semibold text-ql-ink hover:bg-ql-surface2">
                      Open full workspace →
                    </Link>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-ql-text2">Nothing selected.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

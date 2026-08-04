// The One Desk — promoted from /prototype-one (Ben picked variant B, 2026-08-05,
// with A's "do this now" hero and C's urgency grouping folded in). One ranked
// pool over every workable record; project and type are filters, never places.
// Renders inside the ACT shell, so the rail is the only other chrome.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isActSlug } from '@/lib/services/fast-local-org';
import { getOneDeskPool, deskHorizon, type DeskRecord, type DeskHorizon } from '@/lib/services/act-one-desk';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'One Desk — everything ranked — CivicGraph' };
}

const KIND_STYLE: Record<DeskRecord['kind'], string> = {
  funder: 'bg-purple-700', grant: 'bg-bauhaus-blue', buyer: 'bg-emerald-700', money: 'bg-bauhaus-red', commitment: 'bg-amber-600',
};

const HORIZON_LABEL: Record<DeskHorizon, string> = {
  overdue: 'Overdue', fortnight: 'This fortnight', quarter: 'This quarter', undated: 'No date · ranked by fit',
};

function Due({ d }: { d: number | null }) {
  if (d == null) return <span className="text-[11px] text-gray-400">—</span>;
  if (d < 0) return <span className="text-[11px] font-black text-bauhaus-red">{-d}d overdue</span>;
  if (d <= 14) return <span className="text-[11px] font-black text-bauhaus-red">{d}d</span>;
  return <span className="text-[11px] font-bold">{d}d</span>;
}

function KindChip({ k }: { k: DeskRecord['kind'] }) {
  return <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white ${KIND_STYLE[k]}`}>{k}</span>;
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

  const all = await getOneDeskPool(slug);
  const projects = [...new Set(all.map((r) => r.project))].sort();
  const pool = all.filter((r) => (!kind || r.kind === kind) && (!project || r.project === project));
  const selected = (typeof sp.rec === 'string' ? pool.find((r) => r.id === sp.rec) : null) ?? pool[0] ?? null;
  const base = `/org/${slug}/desk`;
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...(kind ? { kind } : {}), ...(project ? { project } : {}), ...extra });
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };

  // Group the ranked list by horizon (C's contribution) while keeping order.
  const groups: Array<{ horizon: DeskHorizon; items: DeskRecord[] }> = [];
  for (const r of pool.slice(0, 80)) {
    const h = deskHorizon(r);
    const last = groups[groups.length - 1];
    if (last && last.horizon === h) last.items.push(r);
    else groups.push({ horizon: h, items: [r] });
  }

  return (
    <main className="min-h-screen bg-bauhaus-canvas p-5 text-bauhaus-black">
      <div className="mx-auto max-w-[1760px]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">One pool · deadline first · {all.length} records</div>
            <h1 className="mt-1 text-3xl font-black uppercase tracking-widest">One Desk</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {projects.map((p) => (
              <Link
                key={p}
                href={project === p ? (kind ? `${base}?kind=${kind}` : base) : qs({ project: p })}
                className={`border-2 border-bauhaus-black px-2 py-1 text-[10px] font-black uppercase tracking-widest ${project === p ? 'bg-bauhaus-yellow' : 'bg-white hover:bg-bauhaus-canvas'}`}
              >
                {p}{project === p ? ' ✕' : ''}
              </Link>
            ))}
            <span className="mx-1 text-bauhaus-muted">·</span>
            {([null, 'money', 'commitment', 'funder', 'grant', 'buyer'] as const).map((k) => (
              <Link
                key={k ?? 'all'}
                href={k ? (project ? `${base}?kind=${k}&project=${encodeURIComponent(project)}` : `${base}?kind=${k}`) : (project ? `${base}?project=${encodeURIComponent(project)}` : base)}
                className={`border-2 border-bauhaus-black px-2 py-1 text-[10px] font-black uppercase tracking-widest ${kind === k ? 'bg-bauhaus-black text-white' : 'bg-white hover:bg-bauhaus-canvas'}`}
              >
                {k ?? 'everything'}
              </Link>
            ))}
          </div>
        </div>

        {/* A's contribution: the single directed move, always on top. */}
        {selected && selected.id === pool[0]?.id ? (
          <div className="mt-4 border-4 border-bauhaus-black bg-bauhaus-black px-5 py-3 text-white">
            <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow">Do this now</span>
            <span className="ml-3 font-bold">{pool[0].name}</span>
            <span className="ml-3 text-sm text-white/70">{pool[0].next}</span>
          </div>
        ) : null}

        {/* B: the split desk. */}
        <div className="mt-4 grid gap-0 border-4 border-bauhaus-black bg-white lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="max-h-[74vh] overflow-y-auto lg:border-r-4 lg:border-bauhaus-black">
            {groups.map((group) => (
              <div key={group.horizon}>
                <div className={`sticky top-0 z-10 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-white ${group.horizon === 'overdue' ? 'bg-bauhaus-red' : 'bg-bauhaus-black'}`}>
                  {HORIZON_LABEL[group.horizon]} · {group.items.length}
                </div>
                {group.items.map((r) => (
                  <Link
                    key={r.id}
                    href={qs({ rec: r.id })}
                    className={`flex items-center gap-2 border-t border-gray-200 px-3 py-2 text-sm first:border-t-0 ${selected?.id === r.id ? 'bg-bauhaus-yellow' : 'hover:bg-bauhaus-canvas'}`}
                  >
                    <KindChip k={r.kind} />
                    <span className="min-w-0 flex-1 truncate font-bold">{r.name}</span>
                    {r.amount && <span className="font-mono text-[11px] font-black">{r.amount}</span>}
                    <Due d={r.dueDays} />
                  </Link>
                ))}
              </div>
            ))}
            {pool.length === 0 ? <div className="px-4 py-8 text-center text-sm text-bauhaus-muted">Nothing matches this filter.</div> : null}
          </div>

          <div className="p-6">
            {selected ? (
              <>
                <div className="flex items-center gap-2">
                  <KindChip k={selected.kind} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{selected.signal}</span>
                </div>
                <h2 className="mt-2 text-2xl font-black">{selected.name}</h2>
                <div className="mt-1 flex items-center gap-3 font-mono text-sm">
                  {selected.amount && <span className="font-black">{selected.amount}</span>}
                  <Due d={selected.dueDays} />
                </div>
                <div className="mt-4 border-l-4 border-bauhaus-red bg-red-50 px-3 py-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-red">Next move</div>
                  <p className="mt-1 font-bold">{selected.next}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selected.ghlUrl && (
                    <a href={selected.ghlUrl} target="_blank" rel="noopener noreferrer" className="border-2 border-bauhaus-black bg-bauhaus-yellow px-3 py-1.5 text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white">
                      Open in GHL ↗
                    </a>
                  )}
                  {selected.workHref && (
                    <Link href={selected.workHref} className="border-2 border-bauhaus-black bg-white px-3 py-1.5 text-xs font-black uppercase tracking-widest hover:bg-bauhaus-canvas">
                      Open full workspace →
                    </Link>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-bauhaus-muted">Nothing selected.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

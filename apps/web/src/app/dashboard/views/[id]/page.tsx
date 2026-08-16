import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { VIEW_REGISTRY } from '@/lib/view-registry';
import { loadViewData } from '@/lib/view-data';

/** Hourly, matching every other shell surface; no per-request input beyond the static id. */
export const revalidate = 3600;

const VIEW_COLOURS: Record<string, string> = {
  red: '#D02020',
  blue: '#1040C0',
  yellow: '#F0C020',
  green: '#059669',
  ink: '#121212',
};

export function generateStaticParams() {
  return VIEW_REGISTRY.map((v) => ({ id: v.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const view = VIEW_REGISTRY.find((v) => v.id === id);
  return { title: view ? `${view.name} — CivicGraph` : 'Not found — CivicGraph' };
}

/**
 * A registered view's own page: the number, its rows, and — inseparably — its caveat.
 * The registry entry is the source of name/question/caveat; the loader (view-data.ts) is the
 * source of numbers and of WHY-states when there is nothing to show.
 */
export default async function ViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = VIEW_REGISTRY.find((v) => v.id === id);
  if (!view) notFound();
  const data = await loadViewData(id);
  if (!data) notFound();

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <span
          className="h-3 w-3 shrink-0 self-center"
          style={{ background: VIEW_COLOURS[view.colour], borderRadius: 'var(--shell-r-sm)' }}
        />
        <h1 className="font-display text-[22px] font-extrabold">{view.name}</h1>
        <div className="flex-1" />
        {view.deepHref && (
          <Link href={view.deepHref} className="text-[12.5px] font-semibold" style={{ color: '#1040C0' }}>
            Full report →
          </Link>
        )}
      </div>
      <p className="text-[13.5px]" style={{ color: 'var(--shell-muted)' }}>
        {view.question}
      </p>

      {data.empty ? (
        <div className="shell-card px-5 py-5">
          <p className="text-[14px] font-semibold">Nothing to show — and here is why.</p>
          <p className="mt-1 text-[13.5px]" style={{ color: 'var(--shell-muted)' }}>
            {data.empty}
          </p>
        </div>
      ) : (
        <div className="shell-card flex flex-col px-5 py-4">
          <div className="font-display text-[40px] font-extrabold leading-none">{data.headline}</div>
          {data.headlineSub && (
            <div className="mt-1.5 text-[13px]" style={{ color: 'var(--shell-muted)' }}>
              {data.headlineSub}
            </div>
          )}
          {data.rows.length > 0 && (
            <div className="mt-4 flex flex-col">
              {data.rowsTitle && (
                <div className="pb-2 text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--shell-muted)' }}>
                  {data.rowsTitle}
                </div>
              )}
              {data.rows.map((r, i) => (
                <div
                  key={`${r.label}-${i}`}
                  className="flex items-baseline gap-3 py-2"
                  style={{ borderTop: '1px solid var(--shell-line)' }}
                >
                  {r.href ? (
                    // A link that looks like plain text is a dead end in disguise (polish F4):
                    // linked rows carry the accent colour so the drill-in is visible.
                    <Link
                      href={r.href}
                      className="min-w-0 flex-1 truncate text-[13.5px] font-semibold hover:underline"
                      style={{ color: '#1040C0' }}
                    >
                      {r.label}
                    </Link>
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{r.label}</span>
                  )}
                  {r.meta && (
                    <span className="shrink-0 text-[11.5px]" style={{ color: 'var(--shell-muted)' }}>
                      {r.meta}
                    </span>
                  )}
                  <span className="shrink-0 font-mono text-[13px]">{r.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* The caveat and the sentinel note are part of the view, not an appendix. */}
      {(view.caveat || data.note) && (
        <div className="shell-card px-5 py-4 text-[12.5px] leading-relaxed" style={{ color: 'var(--shell-muted)' }}>
          {view.caveat && (
            <p>
              <strong style={{ color: 'var(--shell-ink)' }}>Caveat.</strong> {view.caveat}
            </p>
          )}
          {data.note && <p className={view.caveat ? 'mt-2' : ''}>{data.note}</p>}
        </div>
      )}
    </div>
  );
}

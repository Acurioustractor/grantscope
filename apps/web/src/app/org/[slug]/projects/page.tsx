import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCrossProjectView } from '@/lib/services/act-cross-projects';

export const dynamic = 'force-dynamic';

function money(value: number): string {
  if (value === 0) return '—';
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(value);
}

function deadline(iso: string | null): string {
  if (!iso) return '—';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

/**
 * The cross-project view — every ACT project side by side.
 *
 * 62 workspace pages and each was org-wide or single-project; this is the one page where the
 * portfolio is comparable at a glance. Only what the data supports: pipeline aggregates and
 * foundation engagement. No owner or next-action columns — they are empty in the database, and
 * a column of blanks dressed as a workflow is worse than its absence.
 */
export default async function CrossProjectsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const view = await getCrossProjectView(slug);
  if (!view) notFound();

  const withMoney = view.projects.filter((p) => p.pipeline.count > 0 || p.foundations.total > 0);
  const dormant = view.projects.filter((p) => p.pipeline.count === 0 && p.foundations.total === 0);

  return (
    <main className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <header className="border-b border-[#dbe4df] bg-white px-5 py-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#2f8f64]">All projects</p>
          <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight">The portfolio, side by side</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#475569]">
                {view.projects.length} active projects · {view.totals.pipelineCount} pipeline items worth{' '}
                {money(view.totals.pipelineAmount)} · {view.totals.foundationsActive} foundation conversations in
                motion. Click a project to work in it.
              </p>
            </div>
            <div className="flex gap-2 text-xs font-semibold">
              <Link href={`/org/${slug}/funding`} className="min-h-11 rounded-lg border border-[#cbd5e1] bg-white px-4 py-3 hover:border-[#2f8f64]">
                Funding desk
              </Link>
              <Link href={`/org/${slug}/pipeline`} className="min-h-11 rounded-lg bg-[#183426] px-4 py-3 text-white hover:bg-[#2f8f64]">
                Open pipeline
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-10">
        <section className="overflow-x-auto rounded-xl border border-[#dbe4df] bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#dbe4df] text-left font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748b]">
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3 text-right">Pipeline</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3 text-right">Submitted</th>
                <th className="px-4 py-3 text-right">Next deadline</th>
                <th className="px-4 py-3 text-right">Foundations in motion</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {withMoney.map((p) => (
                <tr key={p.id} className="border-b border-[#eef2f0] last:border-0 hover:bg-[#f4f8f6]">
                  <td className="px-4 py-3">
                    <Link href={`/org/${slug}/${p.slug}`} className="font-bold hover:text-[#2f8f64]">
                      {p.name}
                    </Link>
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-wide text-[#94a3b8]">{p.code}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{p.pipeline.count || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{money(p.pipeline.amount)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {p.pipeline.submitted > 0 ? p.pipeline.submitted : '—'}
                    {p.pipeline.upcoming > 0 ? <span className="text-[#64748b]"> · {p.pipeline.upcoming} upcoming</span> : null}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{deadline(p.pipeline.nextDeadline)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {p.foundations.active > 0 ? (
                      <span className="font-semibold text-[#2f8f64]">{p.foundations.active}</span>
                    ) : (
                      '—'
                    )}
                    {p.foundations.total > 0 ? <span className="text-[#94a3b8]"> / {p.foundations.total}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/org/${slug}/${p.slug}/funding`} className="text-xs font-semibold text-[#2f8f64] hover:underline">
                      Funding →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {dormant.length > 0 ? (
          <section className="mt-6 rounded-xl border border-[#dbe4df] bg-white p-5 shadow-sm">
            <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748b]">
              No pipeline recorded — {dormant.length} projects
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#94a3b8]">
              No pipeline items or foundation conversations in the database. That is a statement about the data, not
              about the project.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {dormant.map((p) => (
                <Link
                  key={p.id}
                  href={`/org/${slug}/${p.slug}`}
                  className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-semibold hover:border-[#2f8f64]"
                >
                  {p.name}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <p className="mt-6 text-xs leading-5 text-[#94a3b8]">
          Built from pipeline aggregates and foundation stages only. Owner and next-action fields exist in the schema
          but are empty for every row, so they are not shown. &ldquo;In motion&rdquo; counts stages approach&nbsp;now,
          priority and in&nbsp;conversation.
        </p>
      </div>
    </main>
  );
}

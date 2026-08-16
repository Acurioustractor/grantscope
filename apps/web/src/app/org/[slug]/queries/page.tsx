import Link from 'next/link';
import { SAVED_QUERIES } from '@/lib/services/act-saved-queries';

export const dynamic = 'force-dynamic';

/**
 * Saved queries — the index. Free-text querying was ruled out twice; these are the questions ACT
 * actually asks, audited once, with the mandatory filters baked in and the caveats attached.
 */
export default async function SavedQueriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <main className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <header className="border-b border-[#dbe4df] bg-white px-5 py-8 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#2f8f64]">Saved queries</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Questions written once, audited once</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#475569]">
            Each query carries its mandatory filters and its caveats with it. There is no free-text box on purpose:
            an ad-hoc number carries no coverage note and no exclusions, and that is how a wrong figure ends up in a
            funder email.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-4 px-5 py-8 lg:px-10">
        {SAVED_QUERIES.map((q) => (
          <Link
            key={q.key}
            href={`/org/${slug}/queries/${q.key}`}
            className="rounded-xl border border-[#dbe4df] bg-white p-5 shadow-sm transition-colors hover:border-[#2f8f64]"
          >
            <h2 className="font-black">{q.title}</h2>
            <p className="mt-1 text-sm text-[#475569]">{q.question}</p>
            <p className="mt-2 text-xs text-[#94a3b8]">
              {q.params.map((p) => p.label).join(' · ')} — {q.caveats.length} caveats travel with the result
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}

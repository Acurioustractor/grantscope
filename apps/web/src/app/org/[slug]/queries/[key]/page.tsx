import Link from 'next/link';
import { notFound } from 'next/navigation';
import { savedQueryByKey, type QueryResult } from '@/lib/services/act-saved-queries';

export const dynamic = 'force-dynamic';

/**
 * One saved query: a GET form over allowlisted parameters, re-run server-side, with the caveat
 * block rendered above the rows — the caveats are part of the answer, not a footnote.
 */
export default async function SavedQueryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; key: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug, key }, sp] = await Promise.all([params, searchParams]);
  const query = savedQueryByKey(key);
  if (!query) notFound();

  const inputs: Record<string, string> = {};
  for (const p of query.params) {
    const v = sp[p.name];
    if (typeof v === 'string') inputs[p.name] = v;
  }
  const ready = query.params.every((p) => !p.required || inputs[p.name]);

  let result: QueryResult | null = null;
  let error: string | null = null;
  if (ready && Object.keys(inputs).length > 0) {
    try {
      result = await query.run(inputs);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Query failed.';
    }
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <header className="border-b border-[#dbe4df] bg-white px-5 py-8 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <Link href={`/org/${slug}/queries`} className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#2f8f64] hover:underline">
            ← Saved queries
          </Link>
          <h1 className="mt-2 text-3xl font-black tracking-tight">{query.title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#475569]">{query.question}</p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-8 lg:px-10">
        {/* GET form: the URL is the query — shareable, re-runnable, no state. */}
        <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-[#dbe4df] bg-white p-5 shadow-sm">
          {query.params.map((p) => (
            <label key={p.name} className="grid gap-1 text-xs font-semibold text-[#475569]">
              {p.label}
              {p.kind === 'choice' ? (
                <select
                  name={p.name}
                  defaultValue={inputs[p.name] ?? ''}
                  className="min-h-11 rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-medium text-[#0f172a]"
                >
                  {p.required && !inputs[p.name] ? <option value="">Choose…</option> : null}
                  {p.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name={p.name}
                  defaultValue={inputs[p.name] ?? ''}
                  inputMode="numeric"
                  placeholder="11 digits"
                  className="min-h-11 rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-medium text-[#0f172a]"
                />
              )}
            </label>
          ))}
          <button type="submit" className="min-h-11 rounded-lg bg-[#183426] px-5 py-2 text-sm font-semibold text-white hover:bg-[#2f8f64]">
            Run
          </button>
        </form>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>
        ) : null}

        {result ? (
          <>
            {/* Caveats FIRST. A number read without its exclusions is a different, wrong number. */}
            <section className="mt-6 rounded-xl border border-[#b8d2c5] bg-[#183426] p-5 text-white shadow-sm">
              <p className="text-sm font-black">{result.summary}</p>
              <ul className="mt-3 grid gap-1.5 text-xs leading-5 text-[#dbe9e1]">
                {result.caveats.map((c) => (
                  <li key={c} className="flex gap-2">
                    <span className="text-[#e7ef65]">·</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-4 overflow-x-auto rounded-xl border border-[#dbe4df] bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#dbe4df] text-left font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748b]">
                    {result.columns.map((c) => (
                      <th key={c} className="px-4 py-3">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.length === 0 ? (
                    <tr>
                      <td colSpan={result.columns.length} className="px-4 py-6 text-center text-sm text-[#94a3b8]">
                        No rows match. That is an answer, not an error.
                      </td>
                    </tr>
                  ) : (
                    result.rows.map((row, i) => (
                      <tr key={i} className="border-b border-[#eef2f0] last:border-0">
                        {row.map((cell, j) => (
                          <td key={j} className={`px-4 py-2.5 ${j > 0 && typeof cell !== 'string' ? 'tabular-nums' : ''}`}>
                            {cell ?? '—'}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>
          </>
        ) : !error ? (
          <p className="mt-6 text-sm text-[#94a3b8]">Set the parameters and run. The result URL is shareable.</p>
        ) : null}
      </div>
    </main>
  );
}

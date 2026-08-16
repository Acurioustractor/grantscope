import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDirectServiceSupabase } from '@/lib/supabase';
import {
  cellText,
  columnsOf,
  flagLabel,
  parseEnvelope,
  type RowsEnvelope,
} from '../../../row-viewer';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>;
}): Promise<Metadata> {
  const { key } = await params;
  return { title: `Clarity · ${decodeURIComponent(key)} · rows` };
}

const ROW_LIMIT = 50;

/**
 * The row viewer. This page holds NO judgement about what may be shown — the RPC decides, and this
 * page renders whichever answer comes back: rows, or the refusal with its consent census. A
 * malformed or failed call renders as failure, never as an empty-but-allowed table.
 */
async function load(key: string): Promise<RowsEnvelope | 'error' | 'unknown-object'> {
  const supabase = getDirectServiceSupabase();

  // 404 for objects the catalogue has never heard of; the RPC's own not-in-catalogue refusal
  // covers the race where the catalogue row vanishes between these two calls.
  const { data: exists } = await supabase
    .from('clarity_object')
    .select('object_key')
    .eq('object_key', key)
    .limit(1);
  if (!exists?.length) return 'unknown-object';

  const { data, error } = await supabase.rpc('clarity_rows', {
    p_object_key: key,
    p_limit: ROW_LIMIT,
  });
  if (error) return 'error';
  return parseEnvelope(data) ?? 'error';
}

export default async function RowsPage({ params }: { params: Promise<{ key: string }> }) {
  const { key: rawKey } = await params;
  const key = decodeURIComponent(rawKey);
  const result = await load(key);
  if (result === 'unknown-object') notFound();

  const rows = result !== 'error' && result.allowed ? (result.rows ?? []) : [];
  const cols = columnsOf(rows);

  return (
    <main className="mx-auto max-w-[1180px] px-4 py-8">
      <Link
        href={`/clarity/o/${encodeURIComponent(key)}`}
        className="font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-blue"
      >
        ◂ {key}
      </Link>

      <header className="mt-3 border-4 border-bauhaus-black bg-bauhaus-white p-5">
        <h1 className="font-display text-[22px] font-extrabold break-words">{key} · rows</h1>
        {result !== 'error' && result.allowed ? (
          <p className="mt-2 font-mono text-[12px] text-neutral-600">
            first {result.rows?.length ?? 0} of{' '}
            {result.row_count != null ? result.row_count.toLocaleString('en-AU') : 'an unmeasured number of'}{' '}
            rows · unordered sample · vector columns omitted
          </p>
        ) : null}
      </header>

      {result === 'error' ? (
        <section className="mt-4 border-4 border-bauhaus-red bg-bauhaus-white p-5">
          <p className="text-[14px] leading-relaxed">
            <strong>The row query failed.</strong> That is a fault, not a refusal — refusals arrive
            with their reason. Try again, and if it persists check the RPC{' '}
            <code className="bg-bauhaus-canvas px-1 font-mono text-[0.92em]">clarity_rows</code>.
          </p>
        </section>
      ) : !result.allowed ? (
        <section className="mt-4 border-4 border-bauhaus-black bg-bauhaus-white">
          <h2 className="border-b-2 border-bauhaus-black px-4 py-2 font-display text-[14px] font-bold">
            Rows refused
          </h2>
          <div className="p-4">
            <p className="border-l-4 border-bauhaus-black bg-bauhaus-canvas p-3 text-[14px] leading-relaxed">
              <strong>{result.reason ?? 'refused'}.</strong> The refusal is enforced in the
              database function, not in this page. Admin access is not a consent basis.
            </p>

            {result.consent_census?.length ? (
              <div className="mt-4">
                <h3 className="font-display text-[14px] font-bold">
                  What was actually consented to
                </h3>
                <p className="mt-1 text-[13px] text-neutral-600">
                  Counted per row from the consent flags themselves —{' '}
                  {result.row_count != null ? result.row_count.toLocaleString('en-AU') : '?'} rows,
                  each flag independent. Unrecorded is not consent.
                </p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full border-collapse text-left font-mono text-[12px]">
                    <thead>
                      <tr className="border-b-2 border-bauhaus-black">
                        <th className="py-1.5 pr-3 font-black uppercase tracking-widest">Purpose</th>
                        <th className="py-1.5 pr-3 font-black uppercase tracking-widest">Yes</th>
                        <th className="py-1.5 pr-3 font-black uppercase tracking-widest">No</th>
                        <th className="py-1.5 font-black uppercase tracking-widest">Unrecorded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.consent_census.map((c) => (
                        <tr key={c.flag} className="border-b border-neutral-200">
                          <td className="py-1.5 pr-3 font-semibold">{flagLabel(c.flag)}</td>
                          <td className="py-1.5 pr-3">{c.yes.toLocaleString('en-AU')}</td>
                          <td className="py-1.5 pr-3 text-bauhaus-red">
                            {c.no.toLocaleString('en-AU')}
                          </td>
                          <td className="py-1.5 text-neutral-500">
                            {c.unrecorded.toLocaleString('en-AU')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : rows.length === 0 ? (
        <section className="mt-4 border-4 border-bauhaus-black bg-bauhaus-white p-5">
          <p className="font-mono text-[12px] text-neutral-500">
            The table is reachable and empty — zero rows, not a refusal and not a fault.
          </p>
        </section>
      ) : (
        <section className="mt-4 border-4 border-bauhaus-black bg-bauhaus-white">
          <div className="overflow-x-auto p-4">
            <table className="w-full border-collapse text-left font-mono text-[11.5px]">
              <thead>
                <tr className="border-b-2 border-bauhaus-black">
                  {cols.map((col) => (
                    <th
                      key={col}
                      className="whitespace-nowrap py-1.5 pr-4 font-black uppercase tracking-widest"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-neutral-200 align-top">
                    {cols.map((col) => {
                      const cell = cellText(row[col]);
                      return (
                        <td
                          key={col}
                          className={`max-w-[420px] break-words py-1.5 pr-4 ${
                            cell.isNull ? 'text-neutral-400' : ''
                          }`}
                          title={cell.truncated ? 'truncated' : undefined}
                        >
                          {cell.text}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

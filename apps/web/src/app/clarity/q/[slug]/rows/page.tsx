import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDirectServiceSupabase } from '@/lib/supabase';
import type { BoardCard } from '../../../board-types';

export const dynamic = 'force-dynamic';

const PAGE = 100;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Clarity rows · ${slug}` };
}

interface RowsResult {
  ok: boolean;
  error?: string;
  rows?: Record<string, unknown>[];
  limit?: number;
  offset?: number;
}

async function load(slug: string, offset: number) {
  const supabase = getDirectServiceSupabase();

  const { data: cards, error } = await supabase
    .from('v_clarity_board_cards')
    .select('*')
    .eq('slug', slug)
    .limit(1);
  if (error) throw new Error(`board query failed: ${error.message}`);
  if (!cards?.length) return null;

  // The SQL lives in the registry and runs inside clarity_question_rows, which refuses anything
  // that is not a single SELECT and clamps the limit. See migration 20260815000700.
  const { data: result, error: rowsError } = await supabase.rpc('clarity_question_rows', {
    p_slug: slug,
    p_limit: PAGE,
    p_offset: offset,
  });
  if (rowsError) throw new Error(`rows rpc failed: ${rowsError.message}`);

  return { card: cards[0] as unknown as BoardCard, result: result as unknown as RowsResult };
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number') return v.toLocaleString();
  return String(v);
}

export default async function RowsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ offset?: string }>;
}) {
  const { slug } = await params;
  const { offset: offsetParam } = await searchParams;
  const offset = Math.max(0, Number(offsetParam ?? 0) || 0);

  const loaded = await load(slug, offset);
  if (!loaded) notFound();

  const { card, result } = loaded;
  const rows = result?.rows ?? [];
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const total = card.row_count ?? null;

  return (
    <main className="min-h-screen bg-bauhaus-canvas px-5 py-10">
      <div className="mx-auto max-w-7xl">
        <header className="border-4 border-bauhaus-black bg-bauhaus-white p-6">
          <Link
            href={`/clarity/q/${slug}`}
            className="font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-blue hover:underline"
          >
            ◀ {card.stub}
          </Link>
          <h1 className="mt-2 text-2xl font-black uppercase tracking-widest text-bauhaus-black">
            The rows behind the number
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-bauhaus-black">{card.question}</p>

          {/* The filter travels with the rows. Without it these look like "all the rows". */}
          <p className="mt-4 border-t-2 border-bauhaus-muted pt-3 font-mono text-[11px] leading-relaxed text-bauhaus-black">
            <span className="font-black uppercase tracking-widest">Filter · </span>
            {card.exclusions}
          </p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-bauhaus-muted">
            {total != null
              ? `${offset + 1}–${Math.min(offset + PAGE, total)} of ${total.toLocaleString()}`
              : `${rows.length} shown`}
          </p>
        </header>

        {!result?.ok ? (
          <div className="mt-6 border-4 border-bauhaus-red bg-bauhaus-white p-6">
            <p className="font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-red">
              Rows unavailable
            </p>
            <p className="mt-2 font-mono text-xs text-bauhaus-black">{result?.error}</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-6 border-4 border-bauhaus-black bg-bauhaus-white p-6">
            <p className="text-sm text-bauhaus-black">No rows at this offset.</p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto border-4 border-bauhaus-black bg-bauhaus-white">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-4 border-bauhaus-black bg-bauhaus-canvas">
                  {columns.map((c) => (
                    <th
                      key={c}
                      className="whitespace-nowrap px-3 py-2 text-left font-mono text-[10px] font-black uppercase tracking-widest text-bauhaus-black"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b-2 border-bauhaus-muted last:border-0">
                    {columns.map((c) => (
                      <td key={c} className="whitespace-nowrap px-3 py-1.5 font-mono text-xs text-bauhaus-black">
                        {cell(r[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <nav className="mt-4 flex items-center gap-3">
          {offset > 0 && (
            <Link
              href={`/clarity/q/${slug}/rows?offset=${Math.max(0, offset - PAGE)}`}
              className="border-2 border-bauhaus-black bg-bauhaus-white px-3 py-1.5 font-mono text-[11px] font-black uppercase tracking-widest hover:bg-bauhaus-yellow"
            >
              ◀ Previous
            </Link>
          )}
          {rows.length === PAGE && (
            <Link
              href={`/clarity/q/${slug}/rows?offset=${offset + PAGE}`}
              className="border-2 border-bauhaus-black bg-bauhaus-white px-3 py-1.5 font-mono text-[11px] font-black uppercase tracking-widest hover:bg-bauhaus-yellow"
            >
              Next ▶
            </Link>
          )}
        </nav>
      </div>
    </main>
  );
}

import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getDirectServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const SAFE = /^[a-z0-9_]{1,40}$/;

/**
 * POST /api/clarity/questions/mint — [ MINT THIS AS A QUESTION → ]
 *
 * This is the mechanism that breaks the 26-question ceiling. A curated registry
 * can only hold cross-sections somebody already thought of; the matrix has 144
 * populated cells, and any of them can become a draft question in one click.
 *
 * What it deliberately does NOT do: write answer_sql. A minted question arrives
 * as state='draft' with its ingredients, its binding join and a caveat that says
 * out loud it has never been answered. Auto-generating the SQL would produce a
 * card that looks answered and is not, which is the exact failure this whole
 * surface exists to prevent.
 */
export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  let body: { sourceType?: unknown; targetType?: unknown; relationshipType?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 });
  }

  const src = String(body.sourceType ?? '');
  const tgt = String(body.targetType ?? '');
  const rel = String(body.relationshipType ?? 'all');
  // The values become part of a slug and of prose, and they arrive from a client.
  // They must match the shape the matrix actually produces or they are rejected.
  if (!SAFE.test(src) || !SAFE.test(tgt) || !SAFE.test(rel)) {
    return NextResponse.json({ error: 'Unrecognised cell' }, { status: 400 });
  }

  const supabase = getDirectServiceSupabase();

  // The cell must exist in the matrix. Minting a question about a flow that does
  // not exist would put a card on the board with nothing behind it.
  let cellQuery = supabase
    .from('mv_clarity_flow')
    .select('edges,edges_with_amount,amount_recorded')
    .eq('source_type', src)
    .eq('target_type', tgt);
  if (rel !== 'all') cellQuery = cellQuery.eq('relationship_type', rel);

  const { data: cells, error: cellError } = await cellQuery;
  if (cellError) return NextResponse.json({ error: cellError.message }, { status: 500 });
  if (!cells?.length) return NextResponse.json({ error: 'No such flow' }, { status: 404 });

  const edges = cells.reduce((n, c) => n + Number(c.edges ?? 0), 0);
  const withAmount = cells.reduce((n, c) => n + Number(c.edges_with_amount ?? 0), 0);
  const amountPct = edges ? Math.round((withAmount / edges) * 100) : 0;

  const relPart = rel === 'all' ? '' : `-${rel.replace(/_/g, '-')}`;
  const slug = `flow-${src.replace(/_/g, '-')}${relPart}-to-${tgt.replace(/_/g, '-')}`;
  const relWords = rel === 'all' ? 'move money to' : `${rel.replace(/_/g, ' ')} with`;

  const { error } = await supabase.from('clarity_question').insert({
    slug,
    stub: `${src} → ${tgt}`,
    question: `How do organisations of type ${src} ${relWords} organisations of type ${tgt}?`,
    subject: 'CROSS-SECTION',
    state: 'draft',
    form: 'ranked_bar',
    honest_at: 'entity',
    publishable: 'internal',
    defamation_sensitive: false,
    caveat:
      `Minted from the flow matrix, never answered. ${edges.toLocaleString('en-AU')} edges. ` +
      `Amount is present on ${amountPct}% of them, so any dollar figure derived here is a floor ` +
      `and not a total. Needs answer SQL, a real caveat and a review before it leaves draft.`,
    exclusions: 'ACT-private objects are out of scope, as everywhere in /clarity.',
    claim_phrasing:
      `Recorded ${src}-to-${tgt} flows in CivicGraph number ${edges.toLocaleString('en-AU')} edges.`,
    forbidden_phrasing: [
      'total funding',
      'all funding',
      `every ${src}`,
      'complete picture',
    ],
    blocked_by: [],
    unlocks_questions: [],
    uniqueness: 0.5,
    uniqueness_basis: 'minted from a matrix cell; novelty not yet assessed',
    live_rerun_ok: true,
  });

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: `Already minted: ${slug}`, slug }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // The ingredients are what make FEEDS/BLOCKS light up on the ledger, and what
  // makes the question inherit the sentinels guarding the graph — including the
  // category-node hub, which distorts exactly this kind of cross-section.
  const { error: ingredientError } = await supabase.from('clarity_question_ingredient').insert([
    {
      question_slug: slug,
      object_key: 'public.gs_relationships',
      join_key: 'source_entity_id / target_entity_id',
      role: 'spine',
      is_binding: true,
    },
    {
      question_slug: slug,
      object_key: 'public.gs_entities',
      join_key: 'id',
      role: 'reference',
      is_binding: false,
    },
  ]);

  if (ingredientError) {
    return NextResponse.json(
      { error: `Question drafted but ingredients failed: ${ingredientError.message}`, slug },
      { status: 500 },
    );
  }

  return NextResponse.json({ slug, edges, amountPct });
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/supabase';
import { esc, validateGsId } from '@/lib/sql';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const limiter = rateLimit();

const GSID_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,80}$/;

const schema = z.object({
  ids: z.string().transform(s => s.split(',').map(v => v.trim()).filter(Boolean))
    .pipe(z.array(z.string().regex(GSID_PATTERN)).min(2).max(10)),
});

export async function GET(request: Request) {
  const limited = limiter(request);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Provide 2-10 valid comma-separated gs_ids' }, { status: 400 });

  const ids = parsed.data.ids;

  // Double-check each id with validateGsId
  for (const id of ids) {
    if (!validateGsId(id)) {
      return NextResponse.json({ error: 'Invalid gs_id format' }, { status: 400 });
    }
  }

  try {
    const supabase = getServiceSupabase();
    const escaped = ids.map(id => `'${esc(id)}'`).join(',');

    // Fetch power index data for all entities
    const { data: power, error: powerErr } = await supabase.rpc('exec_sql', {
      query: `SELECT pi.*, ge.sector, ge.postcode, ge.seifa_irsd_decile
         FROM mv_entity_power_index pi
         JOIN gs_entities ge ON ge.id = pi.id
         WHERE pi.gs_id IN (${escaped})`,
    });
    if (powerErr) throw powerErr;

    // Fetch revolving door data
    const { data: rd, error: rdErr } = await supabase.rpc('exec_sql', {
      query: `SELECT rd.*, ge.gs_id
         FROM mv_revolving_door rd
         JOIN gs_entities ge ON ge.id = rd.id
         WHERE ge.gs_id IN (${escaped})`,
    });
    if (rdErr) throw rdErr;

    // Fetch board counts
    const { data: boards, error: boardErr } = await supabase.rpc('exec_sql', {
      query: `SELECT ge.gs_id,
                COUNT(*) FILTER (WHERE pr.cessation_date IS NULL)::int as active_board,
                COUNT(*)::int as total_board
         FROM person_roles pr
         JOIN gs_entities ge ON ge.abn = pr.company_abn
         WHERE ge.gs_id IN (${escaped})
         GROUP BY ge.gs_id`,
    });
    if (boardErr) throw boardErr;

    const response = NextResponse.json({
      entities: power || [],
      revolving_door: rd || [],
      boards: boards || [],
    });
    response.headers.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
    return response;
  } catch (error) {
    console.error('Compare error:', error);
    return NextResponse.json({ error: 'Comparison failed' }, { status: 500 });
  }
}

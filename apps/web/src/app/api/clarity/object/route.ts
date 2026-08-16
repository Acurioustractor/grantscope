import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getDirectServiceSupabase } from '@/lib/supabase';
import { isCuratedField, normaliseCuratedValue } from '@/app/clarity/curated-fields';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/clarity/object — inline edit of ONE curated field.
 *
 * { object_key, field: purpose|caveat|grain|join_keys, value: string|null }
 *
 * Field-allowlisted so documentation can never overwrite measurement, one field per call so a
 * lost request loses one paragraph, provenance stamped (curated_by/curated_at) because "who wrote
 * this and how stale is it" is the reader's first question of any doc.
 */
export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  let body: { object_key?: unknown; field?: unknown; value?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  if (typeof body.object_key !== 'string' || !body.object_key) {
    return NextResponse.json({ error: 'object_key required' }, { status: 400 });
  }
  if (!isCuratedField(body.field)) {
    return NextResponse.json(
      { error: 'field must be one of purpose, caveat, grain, join_keys' },
      { status: 400 },
    );
  }
  const norm = normaliseCuratedValue(body.value);
  if (!norm.ok) return NextResponse.json({ error: norm.error }, { status: 400 });

  const supabase = getDirectServiceSupabase();
  const { data, error } = await supabase
    .from('clarity_object')
    .update({
      [body.field]: norm.value,
      curated_by: auth.user.email ?? 'admin',
      curated_at: new Date().toISOString(),
    })
    .eq('object_key', body.object_key)
    .select('object_key')
    .limit(1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: 'no such object' }, { status: 404 });
  return NextResponse.json({ ok: true, value: norm.value });
}

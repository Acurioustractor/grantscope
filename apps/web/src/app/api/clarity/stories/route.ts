import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getDirectServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const STORY_TABLES = ['stories', 'transcripts'] as const;

/**
 * POST /api/clarity/stories — declare or withdraw a story ↔ project link.
 *
 * { action: 'link', story_table: stories|transcripts, story_id, project_code, note? }
 * { action: 'unlink', story_table, story_id, project_code }
 *
 * Project-mediated ONLY: the link names a project code, never a data row, an organisation, or a
 * place — that boundary is the whole design (see slice 10 in clarity-console.md). Both ends are
 * validated: the code against the synced registry, the story against its own table. The story
 * lookup selects only `id` — this route never reads story content, for either corpus.
 */
export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  let body: {
    action?: unknown;
    story_table?: unknown;
    story_id?: unknown;
    project_code?: unknown;
    note?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  if (body.action !== 'link' && body.action !== 'unlink') {
    return NextResponse.json({ error: 'action must be link or unlink' }, { status: 400 });
  }
  if (!STORY_TABLES.includes(body.story_table as (typeof STORY_TABLES)[number])) {
    return NextResponse.json({ error: `story_table must be one of ${STORY_TABLES.join(', ')}` }, { status: 400 });
  }
  if (typeof body.story_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.story_id)) {
    return NextResponse.json({ error: 'story_id must be a uuid' }, { status: 400 });
  }
  if (typeof body.project_code !== 'string' || !body.project_code) {
    return NextResponse.json({ error: 'project_code required' }, { status: 400 });
  }

  const supabase = getDirectServiceSupabase();

  if (body.action === 'unlink') {
    const { error } = await supabase
      .from('clarity_story_project_link')
      .delete()
      .eq('story_table', body.story_table)
      .eq('story_id', body.story_id)
      .eq('project_code', body.project_code);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { data: code } = await supabase
    .from('clarity_project_code')
    .select('code')
    .eq('code', body.project_code)
    .limit(1);
  if (!code?.length) return NextResponse.json({ error: 'unknown project code' }, { status: 400 });

  const { data: story } = await supabase
    .from(body.story_table as string)
    .select('id')
    .eq('id', body.story_id)
    .limit(1);
  if (!story?.length) return NextResponse.json({ error: 'no such story in that table' }, { status: 404 });

  const { error } = await supabase.from('clarity_story_project_link').upsert(
    {
      story_table: body.story_table,
      story_id: body.story_id,
      project_code: body.project_code,
      declared_by: auth.user.email ?? 'admin',
      note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null,
    },
    { onConflict: 'story_table,story_id,project_code' },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

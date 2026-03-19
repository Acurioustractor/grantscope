import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * POST /api/org/[orgProfileId]/contacts/link-notion
 * Links a person_identity_map record to a Notion page.
 * Body: { personId: string, notionPageId: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgProfileId: string }> }
) {
  const { orgProfileId } = await params;
  const body = await request.json();
  const { personId, notionPageId } = body;

  if (!personId || !notionPageId) {
    return NextResponse.json(
      { error: 'personId and notionPageId are required' },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();

  // Verify the person is linked to a contact in this org
  const { data: contact } = await supabase
    .from('org_contacts')
    .select('id')
    .eq('org_profile_id', orgProfileId)
    .eq('person_id', personId)
    .limit(1)
    .maybeSingle();

  if (!contact) {
    return NextResponse.json(
      { error: 'Person not found in this organisation' },
      { status: 404 }
    );
  }

  // Update person_identity_map with Notion page ID
  const { error } = await supabase
    .from('person_identity_map')
    .update({
      notion_id: notionPageId,
      updated_at: new Date().toISOString(),
    })
    .eq('person_id', personId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, personId, notionPageId });
}

/**
 * DELETE /api/org/[orgProfileId]/contacts/link-notion
 * Unlinks a person from their Notion page.
 * Body: { personId: string }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgProfileId: string }> }
) {
  const { orgProfileId } = await params;
  const body = await request.json();
  const { personId } = body;

  if (!personId) {
    return NextResponse.json({ error: 'personId is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Verify ownership
  const { data: contact } = await supabase
    .from('org_contacts')
    .select('id')
    .eq('org_profile_id', orgProfileId)
    .eq('person_id', personId)
    .limit(1)
    .maybeSingle();

  if (!contact) {
    return NextResponse.json({ error: 'Person not found in this organisation' }, { status: 404 });
  }

  const { error } = await supabase
    .from('person_identity_map')
    .update({ notion_id: null, updated_at: new Date().toISOString() })
    .eq('person_id', personId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

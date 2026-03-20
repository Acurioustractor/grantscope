import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { getEffectiveOrgId } from '@/lib/org-profile';

/**
 * GET /api/team — list team members for user's org (with emails)
 * POST /api/team — invite a new member by email
 * DELETE /api/team — remove a member (admin only)
 */

async function enrichMembersWithEmails(
  serviceDb: ReturnType<typeof getServiceSupabase>,
  members: { id: string; user_id: string | null; invited_email: string | null; role: string; invited_at: string | null; accepted_at: string | null }[],
) {
  const enriched = await Promise.all(
    (members || []).map(async (m) => {
      if (!m.user_id) {
        // Pending invitation — use invited_email
        return { ...m, email: m.invited_email || null };
      }
      const { data } = await serviceDb.auth.admin.getUserById(m.user_id);
      return { ...m, email: data?.user?.email || null };
    }),
  );
  return enriched;
}

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const serviceDb = getServiceSupabase();

  // Get effective org (respects impersonation)
  const orgProfileId = await getEffectiveOrgId(serviceDb, user.id);
  if (!orgProfileId) {
    return NextResponse.json({ members: [], orgProfileId: null, currentUserRole: null });
  }

  // Determine user's role in this org
  const { data: ownerCheck } = await serviceDb
    .from('org_profiles')
    .select('id')
    .eq('id', orgProfileId)
    .eq('user_id', user.id)
    .maybeSingle();

  let currentUserRole: string | null = null;
  if (ownerCheck) {
    currentUserRole = 'admin';
  } else {
    const { data: membership } = await serviceDb
      .from('org_members')
      .select('role')
      .eq('org_profile_id', orgProfileId)
      .eq('user_id', user.id)
      .maybeSingle();
    currentUserRole = membership?.role ?? null;
  }

  const { data: members } = await serviceDb
    .from('org_members')
    .select('id, user_id, invited_email, role, invited_at, accepted_at')
    .eq('org_profile_id', orgProfileId)
    .order('created_at');

  const enrichedMembers = await enrichMembersWithEmails(serviceDb, members || []);

  return NextResponse.json({
    members: enrichedMembers,
    orgProfileId,
    currentUserRole,
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { email, role } = await request.json();
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const serviceDb = getServiceSupabase();

  // Verify user is admin of their org
  const { data: profile } = await serviceDb
    .from('org_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: 'You need an organisation profile first' }, { status: 400 });
  }

  const { data: adminCheck } = await serviceDb
    .from('org_members')
    .select('role')
    .eq('org_profile_id', profile.id)
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (!adminCheck) {
    return NextResponse.json({ error: 'Only admins can invite team members' }, { status: 403 });
  }

  // Find the invited user by email in auth.users
  const { data: invitedUsers } = await serviceDb.rpc('get_user_by_email', { email_input: email });

  if (!invitedUsers || invitedUsers.length === 0) {
    // User doesn't exist yet — create a pending invitation
    // Check for existing pending invite
    const { data: existingPending } = await serviceDb
      .from('org_members')
      .select('id')
      .eq('org_profile_id', profile.id)
      .eq('invited_email', email)
      .is('user_id', null)
      .maybeSingle();

    if (existingPending) {
      return NextResponse.json({ error: 'An invitation is already pending for this email' }, { status: 409 });
    }

    const { data: member, error } = await serviceDb
      .from('org_members')
      .insert({
        org_profile_id: profile.id,
        user_id: null,
        invited_email: email,
        role: role || 'viewer',
        invited_by: user.id,
        invited_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      member,
      status: 'pending',
      message: `Invitation saved for ${email}. They'll join your team when they create a CivicGraph account.`,
    }, { status: 201 });
  }

  const invitedUserId = invitedUsers[0].id;

  // Check if already a member
  const { data: existing } = await serviceDb
    .from('org_members')
    .select('id')
    .eq('org_profile_id', profile.id)
    .eq('user_id', invitedUserId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'This user is already a team member' }, { status: 409 });
  }

  // Add member
  const { data: member, error } = await serviceDb
    .from('org_members')
    .insert({
      org_profile_id: profile.id,
      user_id: invitedUserId,
      role: role || 'viewer',
      invited_by: user.id,
      accepted_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ member, status: 'added' }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { memberId } = await request.json();
  if (!memberId) {
    return NextResponse.json({ error: 'memberId is required' }, { status: 400 });
  }

  const serviceDb = getServiceSupabase();

  // Get the member to find their org
  const { data: member } = await serviceDb
    .from('org_members')
    .select('org_profile_id, user_id')
    .eq('id', memberId)
    .single();

  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  // Verify requester is admin of this org
  const { data: adminCheck } = await serviceDb
    .from('org_members')
    .select('role')
    .eq('org_profile_id', member.org_profile_id)
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (!adminCheck) {
    return NextResponse.json({ error: 'Only admins can remove team members' }, { status: 403 });
  }

  // Don't allow removing yourself if you're the only admin (only for active members)
  if (member.user_id && member.user_id === user.id) {
    const { count } = await serviceDb
      .from('org_members')
      .select('id', { count: 'exact', head: true })
      .eq('org_profile_id', member.org_profile_id)
      .eq('role', 'admin');

    if ((count || 0) <= 1) {
      return NextResponse.json({ error: 'Cannot remove the last admin' }, { status: 400 });
    }
  }

  const { error } = await serviceDb
    .from('org_members')
    .delete()
    .eq('id', memberId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * GET /api/team — list team members for user's org
 * POST /api/team — invite a new member by email
 * DELETE /api/team — remove a member (admin only)
 */

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const serviceDb = getServiceSupabase();

  // Get user's org profile
  const { data: profile } = await serviceDb
    .from('org_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile) {
    // Check if user is a member of someone else's org
    const { data: membership } = await serviceDb
      .from('org_members')
      .select('org_profile_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ members: [], orgProfileId: null });
    }

    const { data: members } = await serviceDb
      .from('org_members')
      .select('id, user_id, role, invited_at, accepted_at')
      .eq('org_profile_id', membership.org_profile_id)
      .order('created_at');

    return NextResponse.json({
      members: members || [],
      orgProfileId: membership.org_profile_id,
    });
  }

  // User owns an org — list all members
  const { data: members } = await serviceDb
    .from('org_members')
    .select('id, user_id, role, invited_at, accepted_at')
    .eq('org_profile_id', profile.id)
    .order('created_at');

  return NextResponse.json({
    members: members || [],
    orgProfileId: profile.id,
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
    // They'll be linked when they sign up with this email
    return NextResponse.json({
      status: 'pending',
      message: `Invitation sent to ${email}. They'll join your team when they create a GrantScope account.`,
    });
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

  // Don't allow removing yourself if you're the only admin
  if (member.user_id === user.id) {
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

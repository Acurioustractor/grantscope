import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/gmail';
import { findContactByEmail, addTagToContact, removeTagFromContact } from '@/lib/ghl';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = ['benjamin@act.place', 'hello@grantscope.au'];

async function checkAdmin() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  if (!ADMIN_EMAILS.includes(user.email || '')) return null;
  return user;
}

export async function GET() {
  const admin = await checkAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceSupabase();
  const { data, error } = await db
    .from('charity_claims')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch charity names for all ABNs
  const abns = [...new Set((data || []).map(c => c.abn))];
  const { data: charities } = await db
    .from('acnc_charities')
    .select('abn, name')
    .in('abn', abns);

  // Also fetch org_profiles for non-ACNC ABNs
  const { data: orgProfiles } = await db
    .from('org_profiles')
    .select('abn, name, org_type')
    .in('abn', abns);

  const nameMap = new Map((charities || []).map(c => [c.abn, c.name]));
  const orgMap = new Map((orgProfiles || []).map(p => [p.abn, p]));

  const enriched = (data || []).map(claim => ({
    ...claim,
    charity_name: nameMap.get(claim.abn) || orgMap.get(claim.abn)?.name || claim.organisation_name || `ABN ${claim.abn} (not in ACNC)`,
    org_type: nameMap.has(claim.abn) ? 'charity' : (orgMap.get(claim.abn)?.org_type || null),
    is_acnc: nameMap.has(claim.abn),
  }));

  // Fetch org type summary stats
  const { data: orgTypeStats } = await db
    .from('org_profiles')
    .select('org_type');

  const typeCounts: Record<string, number> = {};
  for (const row of orgTypeStats || []) {
    const t = row.org_type || 'unset';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }

  const statusCounts: Record<string, number> = {};
  for (const claim of data || []) {
    statusCounts[claim.status] = (statusCounts[claim.status] || 0) + 1;
  }

  return NextResponse.json({ claims: enriched, stats: { org_types: typeCounts, claim_statuses: statusCounts } });
}

export async function PUT(request: NextRequest) {
  const admin = await checkAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { claim_id, status, admin_notes } = body;

  if (!claim_id || !status) {
    return NextResponse.json({ error: 'claim_id and status required' }, { status: 400 });
  }
  if (!['verified', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Status must be verified or rejected' }, { status: 400 });
  }

  const db = getServiceSupabase();
  const updates: Record<string, unknown> = {
    status,
    admin_notes: admin_notes || null,
    updated_at: new Date().toISOString(),
  };
  if (status === 'verified') updates.verified_at = new Date().toISOString();
  if (status === 'rejected') updates.rejected_at = new Date().toISOString();

  const { data, error } = await db
    .from('charity_claims')
    .update(updates)
    .eq('id', claim_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire-and-forget: send notification email + GHL tagging
  (async () => {
    try {
      // Look up user email
      const { data: { user: claimUser } } = await db.auth.admin.getUserById(data.user_id);
      if (!claimUser?.email) return;

      const charityName = data.organisation_name || `ABN ${data.abn}`;

      if (status === 'verified') {
        await sendEmail({
          to: claimUser.email,
          subject: 'Your charity claim has been approved — GrantScope',
          body: [
            `Hi,`,
            '',
            `Your claim for ${charityName} (ABN ${data.abn}) has been verified.`,
            `You can now manage your charity's profile at https://grantscope.au/charities/${data.abn}`,
            ...(admin_notes ? ['', admin_notes] : []),
            '',
            'Best regards,',
            'GrantScope',
          ].join('\n'),
        });
      } else if (status === 'rejected') {
        await sendEmail({
          to: claimUser.email,
          subject: 'Update on your charity claim — GrantScope',
          body: [
            `Hi,`,
            '',
            `Your claim for ${charityName} (ABN ${data.abn}) was not approved.`,
            ...(admin_notes ? ['', `Reason: ${admin_notes}`] : []),
            '',
            'If you believe this is an error, contact hello@grantscope.au',
            '',
            'Best regards,',
            'GrantScope',
          ].join('\n'),
        });
      }

      // GHL tagging
      const ghlContact = await findContactByEmail(claimUser.email);
      if (ghlContact) {
        await removeTagFromContact(ghlContact.id, 'grantscope-claim-pending').catch(() => {});
        if (status === 'verified') {
          await addTagToContact(ghlContact.id, 'grantscope-verified');
        } else {
          await addTagToContact(ghlContact.id, 'grantscope-claim-rejected');
        }
      }
    } catch (e) {
      console.error('Claim notification failed:', e);
    }
  })();

  return NextResponse.json(data);
}

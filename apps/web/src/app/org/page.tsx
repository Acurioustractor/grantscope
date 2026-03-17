import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';

export const metadata = {
  title: 'All Organisations — CivicGraph Admin',
};

export default async function OrgIndexPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/org');

  if (!isAdminEmail(user.email)) {
    // Non-admins: redirect to their own org if they have one
    const serviceDb = getServiceSupabase();
    const { data: ownedOrg } = await serviceDb
      .from('org_profiles')
      .select('slug')
      .eq('user_id', user.id)
      .not('slug', 'is', null)
      .maybeSingle();

    if (ownedOrg?.slug) {
      redirect(`/org/${ownedOrg.slug}`);
    }

    // Check membership
    const { data: membership } = await serviceDb
      .from('org_members')
      .select('org_profile:org_profile_id(slug)')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    const memberOrg = Array.isArray(membership?.org_profile)
      ? membership?.org_profile[0]
      : membership?.org_profile;

    if (memberOrg?.slug) {
      redirect(`/org/${memberOrg.slug}`);
    }

    return (
      <main className="min-h-screen bg-white text-bauhaus-black">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-2xl font-black uppercase tracking-widest mb-4">No Organisation</h1>
          <p className="text-gray-600">You don&apos;t have an organisation profile yet.</p>
          <Link href="/profile" className="mt-4 inline-block underline text-bauhaus-red">
            Set up your organisation &rarr;
          </Link>
        </div>
      </main>
    );
  }

  // Admin view: list all orgs
  const serviceDb = getServiceSupabase();
  const { data: orgs } = await serviceDb
    .from('org_profiles')
    .select('id, name, slug, abn, org_type, subscription_plan, team_size, annual_revenue, user_id')
    .not('slug', 'is', null)
    .order('name');

  // Get user emails for each org
  const orgOwnerIds = (orgs ?? []).map(o => o.user_id).filter(Boolean);
  const ownerEmails: Record<string, string> = {};
  for (const uid of orgOwnerIds) {
    const { data } = await serviceDb.auth.admin.getUserById(uid);
    if (data?.user?.email) ownerEmails[uid] = data.user.email;
  }

  return (
    <main className="min-h-screen bg-white text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <p className="text-sm font-bold uppercase tracking-widest text-bauhaus-red mb-1">
            CivicGraph Admin
          </p>
          <h1 className="text-3xl font-black uppercase tracking-wider">
            All Organisations
          </h1>
          <p className="mt-2 text-gray-400">
            {orgs?.length ?? 0} organisations with dashboards. You are viewing as super admin.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-4">
          {(orgs ?? []).map((org) => (
            <div key={org.id} className="border-4 border-bauhaus-black p-5 flex items-center justify-between hover:bg-gray-50">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="font-black text-lg truncate">{org.name}</h2>
                  {org.org_type && (
                    <span className="text-[10px] px-2 py-0.5 bg-gray-100 font-bold uppercase tracking-wider shrink-0">{org.org_type}</span>
                  )}
                  <span className="text-[10px] px-2 py-0.5 bg-bauhaus-black text-white font-bold uppercase tracking-wider shrink-0">
                    {org.subscription_plan ?? 'community'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  {org.abn && <span className="font-mono">ABN {org.abn.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4')}</span>}
                  {org.team_size && <span>{org.team_size} staff</span>}
                  {org.annual_revenue && <span>~${(org.annual_revenue / 1_000_000).toFixed(0)}M turnover</span>}
                  <span>Owner: {ownerEmails[org.user_id] ?? 'unlinked'}</span>
                </div>
              </div>
              <Link
                href={`/org/${org.slug}`}
                className="ml-6 shrink-0 px-5 py-2.5 bg-bauhaus-red text-white font-black uppercase tracking-widest text-sm hover:bg-red-700 transition-colors"
              >
                View Dashboard
              </Link>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

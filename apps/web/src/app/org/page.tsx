import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';
import { OrgAdminListClient } from './_components/org-admin-list-client';

export const metadata = {
  title: 'All Organisations — CivicGraph Admin',
};

export default async function OrgIndexPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/org');

  // If impersonating, redirect to that org's dashboard
  const cookieStore = await cookies();
  const impersonateSlug = cookieStore.get('cg_impersonate_org')?.value;
  if (impersonateSlug && isAdminEmail(user.email)) {
    redirect(`/org/${impersonateSlug}`);
  }

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
  await Promise.all(
    orgOwnerIds.map(async (uid) => {
      const { data } = await serviceDb.auth.admin.getUserById(uid);
      if (data?.user?.email) ownerEmails[uid] = data.user.email;
    }),
  );

  const totalOrgs = orgs?.length ?? 0;
  const ownerLinkedCount = (orgs ?? []).filter((org) => org.user_id && ownerEmails[org.user_id]).length;
  const withAbnCount = (orgs ?? []).filter((org) => Boolean(org.abn)).length;
  const revenueTrackedCount = (orgs ?? []).filter((org) => org.annual_revenue != null).length;
  const orgSlugs = (orgs ?? []).map((org) => org.slug).filter(Boolean) as string[];
  const { data: projectBackedRows } = orgSlugs.length > 0
    ? await serviceDb
        .from('org_projects')
        .select('slug, name, org_profile:org_profile_id(name, slug)')
        .in('slug', orgSlugs)
    : { data: [] as Array<{ slug: string | null; name: string; org_profile: { name: string; slug: string | null } | Array<{ name: string; slug: string | null }> | null }> };

  const projectBackedBySlug = new Map<string, { project_name: string; parent_org_name: string | null; parent_org_slug: string | null }>();
  for (const row of projectBackedRows ?? []) {
    if (!row.slug) continue;
    const parent = Array.isArray(row.org_profile) ? row.org_profile[0] : row.org_profile;
    projectBackedBySlug.set(row.slug, {
      project_name: row.name,
      parent_org_name: parent?.name ?? null,
      parent_org_slug: parent?.slug ?? null,
    });
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
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="border-2 border-white/20 bg-white/5 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Dashboards</div>
              <div className="mt-1 text-2xl font-black text-white">{totalOrgs}</div>
            </div>
            <div className="border-2 border-white/20 bg-white/5 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Owner linked</div>
              <div className="mt-1 text-2xl font-black text-white">{ownerLinkedCount}</div>
            </div>
            <div className="border-2 border-white/20 bg-white/5 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">ABN present</div>
              <div className="mt-1 text-2xl font-black text-white">{withAbnCount}</div>
            </div>
            <div className="border-2 border-white/20 bg-white/5 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Revenue tracked</div>
              <div className="mt-1 text-2xl font-black text-white">{revenueTrackedCount}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 border-2 border-bauhaus-black bg-bauhaus-canvas px-5 py-4">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">Admin launchpad</div>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-gray-700">
            Use this page to jump into an organisation&apos;s operating dashboard, contacts, or funding workflow without
            scanning the full admin surface first.
          </p>
        </div>

        <OrgAdminListClient
          items={(orgs ?? []).map((org) => ({
            ...org,
            owner_email: org.user_id ? ownerEmails[org.user_id] ?? null : null,
            project_backed: org.slug ? projectBackedBySlug.get(org.slug) ?? null : null,
          }))}
        />
      </div>
    </main>
  );
}

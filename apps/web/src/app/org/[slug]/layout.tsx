import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { isAdminEmail } from '@/lib/admin';
import { createSupabaseServer } from '@/lib/supabase-server';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (shouldUseFastLocalOrg() && isActSlug(slug)) {
    return {
      title: `${ACT_FAST_PROFILE.name} — CivicGraph`,
      description: ACT_FAST_PROFILE.description ?? `Organisation dashboard for ${ACT_FAST_PROFILE.name}`,
    };
  }
  const profile = await getOrgProfileBySlug(slug);
  if (!profile) return { title: 'Not Found — CivicGraph' };
  return {
    title: `${profile.name} — CivicGraph`,
    description: profile.description ?? `Organisation dashboard for ${profile.name}`,
  };
}

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (shouldUseFastLocalOrg() && isActSlug(slug)) {
    return <>{children}</>;
  }

  const profile = await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  // Keep org navigation fast. The admin banner is useful, but it should not add
  // a blocking Supabase auth network call to every org page click.
  let admin = false;
  if (process.env.SHOW_SUPER_ADMIN_BANNER === '1') {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    admin = Boolean(user && isAdminEmail(user.email));
  }

  // Don't show admin banner if impersonating — the global impersonation banner handles it
  const cookieStore = await cookies();
  const isImpersonating = !!cookieStore.get('cg_impersonate_org')?.value;

  return (
    <>
      {admin && !isImpersonating && (
        <div className="bg-yellow-100 border-b-2 border-yellow-400 px-4 py-2 text-sm text-yellow-800 flex items-center justify-between">
          <span>
            <strong>Admin view</strong> — You are viewing <strong>{profile.name}</strong>&apos;s dashboard as super admin.
          </span>
          <div className="flex items-center gap-4">
            <a href={`/org/${slug}/contacts`} className="font-bold underline hover:text-yellow-900">
              Contacts
            </a>
            <a href="/org" className="font-bold underline hover:text-yellow-900">
              All Organisations &larr;
            </a>
          </div>
        </div>
      )}
      {children}
    </>
  );
}

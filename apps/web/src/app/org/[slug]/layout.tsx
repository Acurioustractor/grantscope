import { notFound } from 'next/navigation';
import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { isAdminEmail } from '@/lib/admin';
import { createSupabaseServer } from '@/lib/supabase-server';
import { ACT_FAST_PROFILE, isActSlug } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (isActSlug(slug)) {
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
  if (isActSlug(slug)) {
    const pathname = (await headers()).get('x-pathname') ?? `/org/${slug}`;
    const rootPaths = new Set([
      '/org/act',
      '/org/a-curious-tractor',
      '/org/curious-tractor',
    ]);

    return (
      <div className="ws act-workspace min-h-screen" data-act-workspace>
        {!rootPaths.has(pathname) ? (
          <header className="sticky top-0 z-40 border-b border-[var(--ws-border)] bg-[var(--ws-surface-0)]/95 backdrop-blur">
            <div className="mx-auto flex min-h-14 max-w-[1440px] items-center gap-3 px-4 sm:px-6">
              <Link href={`/org/${slug}`} className="flex shrink-0 items-center gap-2 font-semibold text-[var(--ws-text)]">
                <span className="grid h-7 w-7 place-items-center rounded bg-[#183426] text-[11px] font-black text-[#e7ef65]">A</span>
                <span className="hidden text-sm sm:inline">ACT Field Desk</span>
              </Link>
              <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" aria-label="ACT workspace">
                <ActToolLink href={`/org/${slug}`} label="Today" />
                <ActToolLink href={`/org/${slug}?view=relationships#relationships`} label="Listen" />
                <ActToolLink href={`/org/${slug}?view=opportunities#opportunities`} label="Curiosity" />
                <ActToolLink href={`/org/${slug}?view=pipeline#pipeline`} label="Action" />
              </nav>
              <span className="hidden shrink-0 font-mono text-[9px] uppercase tracking-widest text-[var(--ws-text-tertiary)] lg:inline">
                Powered by CivicGraph
              </span>
            </div>
          </header>
        ) : null}
        {children}
      </div>
    );
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

function ActToolLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-9 shrink-0 items-center rounded-md px-3 text-xs font-semibold text-[var(--ws-text-secondary)] hover:bg-[var(--ws-surface-2)] hover:text-[var(--ws-text)]"
    >
      {label}
    </Link>
  );
}

import type { Metadata } from 'next';
import './globals.css';
import { NavBar } from './components/nav';
import { ImpersonationBanner } from './components/impersonation-banner';
import { DeferredChatDrawer } from './components/deferred-chat-drawer';
import { createSupabaseServer, hasSupabaseServerEnv } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { resolveSubscriptionTier } from '@/lib/subscription';
import { isAdminEmail } from '@/lib/admin';
import type { User } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';

export const metadata: Metadata = {
  title: "CivicGraph — Australia's Accountability Atlas",
  description: "Civic infrastructure for communities, journalists, and researchers. Track action rather than wait for others. Built by A Curious Tractor alongside JusticeHub, Empathy Ledger, and Goods.",
};

const LAYOUT_AUTH_PREFIXES = [
  '/home',
  '/tracker',
  '/foundations/tracker',
  '/ops',
  '/profile',
  '/org',
  '/settings',
  '/briefing',
  '/continue',
] as const;

// Public-facing landing/marketing pages should always render with the public
// container (max-w-7xl mx-auto + horizontal padding), even when an authenticated
// user visits them. Otherwise the workspace layout's edge-to-edge `<main>`
// makes content butt against the viewport edges with no breathing room.
const FORCE_PUBLIC_LAYOUT_PREFIXES = [
  '/pricing',
  '/get-a-report',
  '/about',
] as const;

function needsLayoutAuth(pathname: string) {
  return LAYOUT_AUTH_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function forcesPublicLayout(pathname: string) {
  return FORCE_PUBLIC_LAYOUT_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Iframe-embed routes (/embed/*), share landing pages (/share/*), and API
  // routes render without root chrome so they can be sent to non-customers as
  // a clean public-facing artefact (or dropped into partner iframes).
  const hdrs = await headers();
  const pathname = hdrs.get('x-pathname') ?? '';
  const isChromeless = pathname.startsWith('/embed') || pathname.startsWith('/share');
  const requiresLayoutAuth = needsLayoutAuth(pathname);
  const isFastPublicPath = !requiresLayoutAuth;

  if (isChromeless) {
    return (
      <html lang="en">
        <body className="font-sans antialiased bg-transparent">
          {children}
        </body>
      </html>
    );
  }

  let user: User | null = null;
  let subscriptionPlan: string | null = null;
  let userOrgSlug: string | null = null;
  let impersonatingOrg: { name: string; slug: string } | null = null;

  // Check for impersonation cookie (admin-only)
  const cookieStore = await cookies();
  const impersonateSlug = cookieStore.get('cg_impersonate_org')?.value ?? null;

  // Resolve subscription tier from org_profiles
  if (hasSupabaseServerEnv() && requiresLayoutAuth) {
    const supabase = await createSupabaseServer();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    user = currentUser;

    if (user) {
      if (impersonateSlug && isAdminEmail(user.email)) {
        // Admin impersonating: use the target org's tier
        const db = getServiceSupabase();
        const { data: targetOrg } = await db
          .from('org_profiles')
          .select('name, slug, subscription_plan')
          .eq('slug', impersonateSlug)
          .maybeSingle();
        if (targetOrg) {
          subscriptionPlan = targetOrg.subscription_plan;
          impersonatingOrg = { name: targetOrg.name, slug: targetOrg.slug };
          userOrgSlug = targetOrg.slug;
        }
      }
      if (!subscriptionPlan) {
        const { data: profile } = await supabase
          .from('org_profiles')
          .select('subscription_plan, slug')
          .eq('user_id', user.id)
          .single();
        subscriptionPlan = profile?.subscription_plan ?? null;
        if (!impersonatingOrg && profile?.slug) {
          userOrgSlug = profile.slug;
        }
      }
    }
  }
  const tier = resolveSubscriptionTier(subscriptionPlan);
  const isLoggedIn = !!user;

  return (
    <html lang="en">
      <body
        className={`font-sans antialiased ${isLoggedIn ? 'ws' : ''}`}
        data-authenticated={user ? 'true' : 'false'}
        data-user-email={user?.email ?? ''}
      >
        <NavBar
          initialUserEmail={user?.email ?? null}
          subscriptionTier={tier}
          isImpersonating={!!impersonatingOrg}
          orgSlug={userOrgSlug}
        />
        {impersonatingOrg && (
          <ImpersonationBanner orgName={impersonatingOrg.name} orgSlug={impersonatingOrg.slug} />
        )}
        {isLoggedIn && !forcesPublicLayout(pathname) ? (
          /* Workspace: generous padding, pages control their own max-width */
          <main className="px-6 py-6">
            {children}
          </main>
        ) : (
          /* Public: centered content with Bauhaus footer */
          <>
            <main className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 xl:px-20 py-10">
              {children}
            </main>
            <footer className="border-t-4 border-bauhaus-black mt-16 bg-bauhaus-black">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                  <div>
                    <div className="font-black text-lg text-white uppercase tracking-tight mb-2">CivicGraph</div>
                    <p className="text-sm text-bauhaus-muted leading-relaxed">
                      Australia&apos;s accountability atlas. Civic infrastructure by A Curious Tractor. Track action rather than wait for others.
                    </p>
                  </div>
                  <div>
                    <div className="font-black text-xs text-bauhaus-yellow mb-3 uppercase tracking-widest">Pipeline</div>
                    <ul className="space-y-2 text-sm">
                      <li><a href="/grants" className="text-bauhaus-muted hover:text-white transition-colors">Grant Search</a></li>
                      <li><a href="/profile/matches" className="text-bauhaus-muted hover:text-white transition-colors">Matched Grants</a></li>
                      <li><a href="/tracker" className="text-bauhaus-muted hover:text-white transition-colors">Grant Tracker</a></li>
                      <li><a href="/alerts" className="text-bauhaus-muted hover:text-white transition-colors">Alerts</a></li>
                      <li><a href="/support" className="text-bauhaus-muted hover:text-white transition-colors">Support</a></li>
                    </ul>
                  </div>
                  <div>
                    <div className="font-black text-xs text-bauhaus-yellow mb-3 uppercase tracking-widest">Prospecting</div>
                    <ul className="space-y-2 text-sm">
                      <li><a href="/foundations" className="text-bauhaus-muted hover:text-white transition-colors">Foundations</a></li>
                      <li><a href="/foundations/tracker" className="text-bauhaus-muted hover:text-white transition-colors">Foundation Tracker</a></li>
                      <li><a href="/social-enterprises" className="text-bauhaus-muted hover:text-white transition-colors">Social Enterprises</a></li>
                      <li><a href="/reports/grant-frontier" className="text-bauhaus-muted hover:text-white transition-colors">Grant Frontier</a></li>
                    </ul>
                  </div>
                  <div>
                    <div className="font-black text-xs text-bauhaus-yellow mb-3 uppercase tracking-widest">Research</div>
                    <ul className="space-y-2 text-sm">
                      <li><a href="/reports" className="text-bauhaus-muted hover:text-white transition-colors">All Reports</a></li>
                      <li><a href="/reports/big-philanthropy" className="text-bauhaus-muted hover:text-white transition-colors">Big Philanthropy</a></li>
                      <li><a href="/reports/power-dynamics" className="text-bauhaus-muted hover:text-white transition-colors">Power Dynamics</a></li>
                      <li><a href="/ask" className="text-bauhaus-muted hover:text-white transition-colors">Ask CivicGraph</a></li>
                    </ul>
                  </div>
                  <div>
                    <div className="font-black text-xs text-bauhaus-yellow mb-3 uppercase tracking-widest">Platform</div>
                    <ul className="space-y-2 text-sm">
                      <li><a href="/procurement" className="text-bauhaus-muted hover:text-white transition-colors">Procurement</a></li>
                      <li><a href="/places" className="text-bauhaus-muted hover:text-white transition-colors">Place Packs</a></li>
                      <li><a href="/graph" className="text-bauhaus-muted hover:text-white transition-colors">Network Graph</a></li>
                      <li><a href="/snow-foundation" className="text-bauhaus-muted hover:text-white transition-colors">Partners</a></li>
                    </ul>
                  </div>
                </div>
                <div className="mt-8 pt-6 border-t-2 border-white/10 text-center text-xs text-bauhaus-muted uppercase tracking-widest">
                  Built by{' '}
                  <a href="/about/curious-tractor" className="text-bauhaus-muted hover:text-white transition-colors underline decoration-white/20 underline-offset-4 hover:decoration-white">
                    A Curious Tractor
                  </a>{' '}
                  &middot; Track action rather than wait for others
                  <a href="/ops/health" className="ml-4 text-white/20 hover:text-white/60 transition-colors">&middot;</a>
                </div>
              </div>
            </footer>
          </>
        )}
        <DeferredChatDrawer delayMs={isFastPublicPath ? 2500 : 1000} />
      </body>
    </html>
  );
}

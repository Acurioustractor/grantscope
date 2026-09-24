import type { Metadata } from 'next';
import { Newsreader, IBM_Plex_Mono, DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

// Quiet Ledger fonts — exposed as CSS vars the ql-* theme tokens reference.
const newsreader = Newsreader({ subsets: ['latin'], weight: ['400', '500', '600'], style: ['normal', 'italic'], variable: '--font-newsreader' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-mono' });
// Bauhaus fonts (DESIGN.md): DM Sans body + JetBrains Mono, self-hosted by
// next/font so no page ever waits on a remote font host for them. Satoshi is
// Fontshare-only, linked below with display=swap — first paint renders the
// fallback and upgrades; it never blocks. Until 2026-08-10 none of these were
// applied at all: globals.css pinned system fonts and the font config lived
// in a Tailwind-3 file Tailwind 4 ignores, so every Bauhaus surface rendered
// system-ui while Satoshi downloaded unused.
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' });
const jetBrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });
const qlFontVars = `${newsreader.variable} ${plexMono.variable} ${dmSans.variable} ${jetBrains.variable}`;

const SATOSHI_CSS = 'https://api.fontshare.com/v2/css?f[]=satoshi@700,800,900&display=swap';

function BrandFontLinks() {
  return (
    <>
      <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={SATOSHI_CSS} precedence="default" />
    </>
  );
}
import { NavBar } from './components/nav';
import { ImpersonationBanner } from './components/impersonation-banner';
import { DeferredChatDrawer } from './components/deferred-chat-drawer';
import { ShortlistProvider } from './components/shortlist-context';
import { ShortlistBar } from './components/shortlist-bar';
import { createSupabaseServer, hasSupabaseServerEnv } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { resolveSubscriptionTier } from '@/lib/subscription';
import { isAdminEmail } from '@/lib/admin';
import { isChromelessPath, isUnder } from '@/lib/public-frame';
import type { User } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';
// Vercel Web Analytics (cookieless page views). Inert until Web Analytics is switched on for the
// project in the Vercel dashboard. Added 2026-09-24: there was no way to tell whether visitors use
// CivicGraph as a tool (search, profiles) or read it as a publication (one report from a link),
// and the design decisions turn on that.
import { Analytics } from '@vercel/analytics/next';

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
  '/feedback',
  '/changes',
  '/about',
] as const;

function needsLayoutAuth(pathname: string) {
  return LAYOUT_AUTH_PREFIXES.some(prefix => isUnder(pathname, prefix));
}

function forcesPublicLayout(pathname: string) {
  return FORCE_PUBLIC_LAYOUT_PREFIXES.some(prefix => isUnder(pathname, prefix));
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const pathname = hdrs.get('x-pathname') ?? '';
  // ONE public frame (decided 2026-09-24). Every public page renders inside this layout's nav and
  // footer; only signed-in work, embeds, partner share pages and ACT's workspace go without. The list
  // lives in lib/public-frame.ts so public-frame.test.ts reads the same one.
  const isChromeless = isChromelessPath(pathname);
  const requiresLayoutAuth = needsLayoutAuth(pathname);
  const isFastPublicPath = !requiresLayoutAuth;

  if (isChromeless) {
    return (
      <html lang="en">
        <body className={`font-sans antialiased bg-transparent ${qlFontVars}`}>
          <BrandFontLinks />
          {children}
          <Analytics />
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
        // NO `ws` class here. It used to be added for signed-in users, which meant the app
        // rendered as two visually different products depending on auth state: `.ws` overrides
        // every bauhaus-* colour with !important, thins border-4 to 1px, is exempt from the
        // global `border-radius: 0`, and replaces DM Sans with the OS system font. So the
        // "locked" design was only ever shown to logged-out visitors, and nobody working on the
        // product was looking at it.
        //
        // It was never a design decision: `git log -S` dates it to d6e53129 (2026-03-14),
        // "Phase 0 revenue infrastructure — tier enforcement, exposure API, ALMA linkage,
        // contract alerts, NZ scaffolding". It arrived with billing.
        //
        // Nothing depended on it. `/org` applies its own `ws act-workspace` wrapper, and
        // `/dashboard`, `/search` and `/clarity` use `.shell`, which is self-contained by
        // design ("Scoped to .shell only; the public Bauhaus site is untouched").
        className={`font-sans antialiased ${qlFontVars}`}
        data-authenticated={user ? 'true' : 'false'}
        data-user-email={user?.email ?? ''}
      >
        <BrandFontLinks />
        <ShortlistProvider>
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
                      <li><a href="/giving" className="text-bauhaus-muted hover:text-white transition-colors">Giving Commons</a></li>
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
        <ShortlistBar />
        {/* The Atlas is a full-viewport map; the chat bubble sat on its
            bottom corner controls (Ben, 2026-08-09: no AI button there). */}
        {!pathname.startsWith('/atlas') && (
          <DeferredChatDrawer delayMs={isFastPublicPath ? 2500 : 1000} />
        )}
        </ShortlistProvider>
        <Analytics />
      </body>
    </html>
  );
}

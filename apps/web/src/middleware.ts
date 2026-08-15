import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabasePublicKey, getSupabaseUrl } from './lib/supabase-env';

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some(({ name, value }) => {
    if (!value) return false;
    return (
      /^sb-.+-auth-token(?:\.\d+)?$/.test(name) ||
      name.includes('supabase-auth-token')
    );
  });
}

function safeRedirectPath(value: string | null, fallback = '/home') {
  if (!value) return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}

// The bare production Vercel alias (not preview-deployment URLs, which still
// need to work for QA) was taking ~30k req/day in Firewall data — traffic
// hitting the project directly rather than discovering it via civicgraph.app.
// Redirecting it to the canonical domain costs nothing and isn't linked from
// anywhere we control, so this only affects whoever already found it.
const BARE_VERCEL_PRODUCTION_HOST = 'grantscope.vercel.app';
const CANONICAL_HOST = 'civicgraph.app';

export async function middleware(request: NextRequest) {
  if (request.headers.get('host') === BARE_VERCEL_PRODUCTION_HOST) {
    const url = request.nextUrl.clone();
    url.hostname = CANONICAL_HOST;
    url.protocol = 'https';
    url.port = '';
    return NextResponse.redirect(url, 308);
  }

  // Expose the pathname to server components so the root layout can
  // conditionally skip chrome (nav/footer) for iframe-embed routes.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);
  requestHeaders.set('x-search', request.nextUrl.search);

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });

  const { pathname } = request.nextUrl;

  // Solo-dev escape hatch: SKIP_AUTH_LOCAL=1 lets all routes through without
  // any auth check. Hard-guarded against production via NODE_ENV.
  if (process.env.NODE_ENV !== 'production' && process.env.SKIP_AUTH_LOCAL === '1') {
    return supabaseResponse;
  }

  // /foundations/backlog renders a service-role review queue and fans out 8
  // concurrent exec_sql calls per hit with no cache. Left ungated it let
  // anonymous traffic drive service-role queries and starve the shared pool.
  const protectedPrefixes = [
    '/home',
    '/tracker',
    '/foundations/tracker',
    '/foundations/backlog',
    '/ops',
    '/profile',
    '/org',
  ];
  const isProtectedRoute = protectedPrefixes.some(p => pathname.startsWith(p));
  const isLoginRoute = pathname === '/login';

  // Local/dev navigation must be instant. A Supabase getUser() call in middleware
  // adds a network hop to every click, so trusted local sessions use the auth
  // cookie as the fast gate. Production can opt into strict validation.
  const fastCookieAuth =
    process.env.NODE_ENV !== 'production' ||
    process.env.NEXT_PUBLIC_FAST_LOCAL_AUTH === '1' ||
    process.env.FAST_LOCAL_AUTH === '1';
  const hasAuthCookie = hasSupabaseAuthCookie(request);

  let isAuthed = fastCookieAuth ? hasAuthCookie : false;

  if (!fastCookieAuth && (isProtectedRoute || isLoginRoute)) {
    const supabaseUrl = getSupabaseUrl();
    const supabasePublicKey = getSupabasePublicKey();

    if (supabaseUrl && supabasePublicKey) {
      const supabase = createServerClient(
        supabaseUrl,
        supabasePublicKey,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) =>
                request.cookies.set(name, value)
              );
              supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
              cookiesToSet.forEach(({ name, value, options }) =>
                supabaseResponse.cookies.set(name, value, options)
              );
            },
          },
        }
      );

      const { data } = await supabase.auth.getUser();
      isAuthed = Boolean(data.user);
    }
  }

  // Protect authenticated routes
  if (isProtectedRoute && !isAuthed) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Redirect /login to /home if already authed
  if (isLoginRoute && isAuthed) {
    const target = safeRedirectPath(request.nextUrl.searchParams.get('next') || request.nextUrl.searchParams.get('redirect'));
    const targetUrl = new URL(target, request.url);
    const url = request.nextUrl.clone();
    url.pathname = targetUrl.pathname;
    url.search = targetUrl.search;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  // Run middleware everywhere so x-pathname is set for server components.
  // Auth gating still only applies to the protected prefixes above.
  matcher: [
    // Skip static files, Next internals, and images
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|css|js)$).*)',
  ],
};

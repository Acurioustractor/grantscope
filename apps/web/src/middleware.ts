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

function isExpensivePublicPath(pathname: string) {
  return (
    /^\/entity\/[^/]+\/?$/.test(pathname) ||
    /^\/entities\/[^/]+(?:\/due-diligence)?\/?$/.test(pathname) ||
    /^\/grants(?:\/|$)/.test(pathname) ||
    pathname === '/foundations/backlog' ||
    pathname === '/foundations/compare' ||
    /^\/person\/[^/]+\/?$/.test(pathname) ||
    /^\/places\/[^/]+\/?$/.test(pathname)
  );
}

function isAutomaticPrefetch(request: NextRequest) {
  return (
    request.headers.get('next-router-prefetch') === '1' ||
    request.headers.get('x-middleware-prefetch') === '1' ||
    request.headers.get('purpose')?.toLowerCase() === 'prefetch' ||
    request.headers.get('sec-purpose')?.toLowerCase().includes('prefetch') === true
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Large public dossiers can fan out into many database queries. Next.js link
  // prefetches should never spend that budget before a person opens the page.
  if (isExpensivePublicPath(pathname) && isAutomaticPrefetch(request)) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'cache-control': 'private, no-store',
        'x-civicgraph-prefetch-skipped': '1',
      },
    });
  }

  // Expose the pathname to server components so the root layout can
  // conditionally skip chrome (nav/footer) for iframe-embed routes.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);
  requestHeaders.set('x-search', request.nextUrl.search);

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });

  // Solo-dev escape hatch: SKIP_AUTH_LOCAL=1 lets all routes through without
  // any auth check. Hard-guarded against production via NODE_ENV.
  if (process.env.NODE_ENV !== 'production' && process.env.SKIP_AUTH_LOCAL === '1') {
    return supabaseResponse;
  }

  const protectedPrefixes = ['/home', '/tracker', '/foundations/tracker', '/ops', '/profile', '/org'];
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
  // Keep middleware off public APIs and reports. These prefixes are the only
  // routes that need auth gating or layout pathname/search headers.
  matcher: [
    '/home/:path*',
    '/tracker/:path*',
    '/foundations/tracker/:path*',
    '/ops/:path*',
    '/profile/:path*',
    '/org/:path*',
    '/settings/:path*',
    '/briefing/:path*',
    '/continue/:path*',
    '/login',
    '/embed/:path*',
    '/share/:path*',
    '/discover/:path*',
    '/feedback/:path*',
    '/get-a-report/:path*',
    '/pricing/:path*',
    '/changes/:path*',
    '/account/:path*',
    '/entity/:path*',
    '/entities/:path*',
    '/grants/:path*',
    '/foundations/backlog',
    '/foundations/compare',
    '/person/:path*',
    '/places/:path*',
  ],
};

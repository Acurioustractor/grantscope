import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

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

export async function middleware(request: NextRequest) {
  // Expose the pathname to server components so the root layout can
  // conditionally skip chrome (nav/footer) for iframe-embed routes.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });

  const { pathname } = request.nextUrl;
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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
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

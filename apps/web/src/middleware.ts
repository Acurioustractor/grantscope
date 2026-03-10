import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protect /home, /tracker, /ops, and /profile routes
  if ((pathname.startsWith('/home') || pathname.startsWith('/tracker') || pathname.startsWith('/foundations/tracker') || pathname.startsWith('/ops') || pathname.startsWith('/profile')) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirect /login to /home if already authed
  if (pathname === '/login' && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/home';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/home', '/tracker/:path*', '/foundations/tracker/:path*', '/foundations/tracker', '/ops/:path*', '/ops', '/profile/:path*', '/profile', '/login'],
};

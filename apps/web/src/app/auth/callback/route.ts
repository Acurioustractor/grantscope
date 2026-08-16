import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { resolveAuthRedirect } from '@/lib/auth-redirect';

/**
 * OAuth callback — the other half of the login page's Google button.
 *
 * The @supabase/ssr browser client runs PKCE: the provider redirects here with a one-time code
 * that must be exchanged server-side so the session lands in cookies. Without this route the
 * OAuth flow completes at Google and dies on return.
 *
 * The redirect target is re-sanitised here (relative paths only) — the query string round-trips
 * through Google, so it is attacker-influenced input, not our own state. Only the `redirect`
 * param is considered: resolveAuthRedirect would otherwise append the OAuth `code` to the target.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get('code');
  const redirectOnly = new URLSearchParams();
  const redirect = url.searchParams.get('redirect');
  if (redirect) redirectOnly.set('redirect', redirect);
  const target = resolveAuthRedirect(redirectOnly);

  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(target, url.origin));
    }
  }

  return NextResponse.redirect(new URL('/login?error=oauth', url.origin));
}

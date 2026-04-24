type RedirectSearchParams = Pick<URLSearchParams, 'get' | 'entries'>;

function sanitizeRedirectTarget(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  return value;
}

export function resolveAuthRedirect(searchParams: RedirectSearchParams, fallback = '/continue'): string {
  const redirectTarget = sanitizeRedirectTarget(searchParams.get('redirect') || searchParams.get('next'));
  if (!redirectTarget) return fallback;
  if (redirectTarget.includes('?')) return redirectTarget;

  const extraParams = new URLSearchParams();
  for (const [key, value] of searchParams.entries()) {
    if (key === 'next' || key === 'redirect') continue;
    extraParams.append(key, value);
  }

  const query = extraParams.toString();
  return query ? `${redirectTarget}?${query}` : redirectTarget;
}

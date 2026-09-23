/**
 * Public link for an organisation named in a report.
 *
 * Reports used to link to /org/<slug>. /org is login-only (middleware) and, once signed in,
 * renders only the handful of organisations with an org profile, so every entity link in the
 * power reports led a visitor to a sign-in page. /entity/<gs_id> is public.
 *
 * Order: the row's gs_id; else its ABN as AU-ABN-<abn> (the entity page resolves that by ABN
 * when no gs_id matches exactly); else a search for the name, so the link never dead-ends.
 */
export function entityHref(ref: {
  gsId?: string | null;
  abn?: string | null;
  name?: string | null;
}): string {
  if (ref.gsId) return `/entity/${encodeURIComponent(ref.gsId)}`;
  const abn = ref.abn?.replace(/\s/g, '');
  if (abn && /^\d{11}$/.test(abn) && !/^0+$/.test(abn)) return `/entity/AU-ABN-${abn}`;
  return `/search?q=${encodeURIComponent(ref.name ?? '')}`;
}

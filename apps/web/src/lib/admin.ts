/**
 * Super admin check — centralised list of admin emails.
 * Used by nav, ops, and org dashboard admin views.
 */
export const ADMIN_EMAILS = ['benjamin@act.place', 'hello@civicgraph.au', 'accounts@act.place'];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email);
}

export type ActIdentityCandidate = {
  name?: string | null;
  email?: string | null;
  organisation?: string | null;
};

const INTERNAL_EMAILS = new Set([
  'benjamin@act.place',
  'nicholas@act.place',
]);

const INTERNAL_NAMES = new Set([
  'benjamin knight',
  'ben knight',
  'nicholas marchesi',
  'nicholas marchesi oam',
  'nic marchesi',
]);

function normalized(value: string | null | undefined) {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * ACT founders and team identities are operators, not external relationships.
 * They must not enter nurture, buyer, funder, supporter, or outreach queues.
 */
export function isInternalActIdentity(candidate: ActIdentityCandidate) {
  const email = normalized(candidate.email);
  const name = normalized(candidate.name);
  if (INTERNAL_EMAILS.has(email)) return true;
  if (INTERNAL_NAMES.has(name)) return true;
  return false;
}

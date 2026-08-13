import { createHash } from 'node:crypto';

export function normaliseIdentityText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b(the|pty|ltd|limited|inc|incorporated)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function canonicalUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|source$|ref$|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
    }
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString().replace(/\?$/, '').toLowerCase();
  } catch {
    return null;
  }
}

export function promotionKey({ projectCode, funderId, provider, programId, program, round, receivingEntity }) {
  const parts = [
    projectCode || 'unknown-project',
    funderId || normaliseIdentityText(provider) || 'unknown-funder',
    programId || normaliseIdentityText(program) || 'unknown-program',
    round || 'rolling-or-unknown',
    receivingEntity || 'unassigned-entity',
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

export function evaluateNotionGate(candidate, now = new Date()) {
  const gaps = [];
  if (!candidate.id) gaps.push('GrantScope ID');
  if (!canonicalUrl(candidate.url || candidate.sourceUrl)) gaps.push('official source URL');
  if (!candidate.fundingBlock) gaps.push('Goods funding block');
  if (!candidate.receivingEntity) gaps.push('receiving entity');
  if (!['confirmed', 'likely'].includes(String(candidate.eligibility || '').toLowerCase())) gaps.push('confirmed or likely eligibility');
  if (candidate.hardBlocked) gaps.push('unresolved hard eligibility block');
  if (!candidate.lastVerifiedAt) gaps.push('source verification date');
  if (candidate.lastVerifiedAt) {
    const ageDays = (now.getTime() - new Date(candidate.lastVerifiedAt).getTime()) / 86400000;
    if (!Number.isFinite(ageDays) || ageDays > 30) gaps.push('source verification older than 30 days');
  }
  return { pass: gaps.length === 0, gaps };
}

export function evaluateGhlGate(candidate) {
  const gaps = [];
  if (!candidate.grantScopeId) gaps.push('GrantScope ID');
  if (candidate.decisionState !== 'Work') gaps.push('Decision state Work');
  if (candidate.canonicalStatus !== 'Active') gaps.push('Canonical status Active');
  if (candidate.evidenceStatus !== 'Ready') gaps.push('Evidence status Ready');
  if (!['Confirmed', 'Likely'].includes(candidate.eligibility)) gaps.push('confirmed or likely eligibility');
  if (!candidate.owner) gaps.push('owner');
  if (!candidate.nextAction) gaps.push('next action');
  if (!candidate.nextActionDue) gaps.push('next action due date');
  if (!candidate.contactId) gaps.push('GHL contact');
  return { pass: gaps.length === 0, gaps };
}

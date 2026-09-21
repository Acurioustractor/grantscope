/**
 * Building the grant_opportunities update from a scraped-page LLM verdict.
 *
 * Why this is gated (2026-09-21 abstention audit): scrape-grant-deadlines.mjs
 * is the same mechanism that put 22 invented deadlines onto foundation
 * programmes, except it writes to grant_opportunities directly and was never
 * part of that fix. Its prompt actively invited the guess — "open means
 * currently accepting applications with a known OR IMPLIED deadline" — and the
 * writer accepted any well-formed date, setting both deadline and closes_at.
 *
 * Worse, the damage was unmeasurable: the script stamped only last_verified_at,
 * which eight other writers also set, so no deadline could be attributed to it.
 * Hence PROVENANCE below — the next audit gets to answer the question.
 */
import { quote } from './foundation-program-record.mjs';

export { quote };

export const PROVENANCE_SOURCE = 'scrape-grant-deadlines';
export const VALID_STATUSES = ['open', 'closed', 'ongoing', 'unknown'];

/**
 * @param {object} extraction  the normalised LLM verdict
 * @param {object} grant       the existing grant_opportunities row
 * @param {string} now         ISO timestamp for this run
 * @returns {{ update: object, deadlineAccepted: boolean, deadlineRejected: string|null }}
 */
export function buildDeadlineUpdate(extraction, grant, now) {
  const update = { last_verified_at: now };

  const rawDeadline = typeof extraction.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(extraction.deadline)
    ? extraction.deadline
    : null;
  const deadlineEvidence = quote(extraction.deadline_evidence);
  // A date the page cannot be quoted for is a guess, however plausible it looks.
  const acceptedDeadline = rawDeadline && deadlineEvidence ? rawDeadline : null;
  const rejectedDeadline = rawDeadline && !deadlineEvidence ? rawDeadline : null;

  const statusEvidence = quote(extraction.status_evidence);
  const rawStatus = VALID_STATUSES.includes(extraction.status) ? extraction.status : 'unknown';
  // 'closed' is the one status worth trusting unquoted: it only ever removes a
  // grant from the desk, and the failure mode we are fixing is over-claiming.
  const status = rawStatus === 'closed' || statusEvidence ? rawStatus : 'unknown';

  if (status !== 'unknown') {
    update.status = status;
  }

  if (acceptedDeadline && !grant.deadline) {
    update.deadline = acceptedDeadline;
    update.closes_at = acceptedDeadline;
  }

  if (typeof extraction.amount_min === 'number' && !grant.amount_min) {
    update.amount_min = Math.round(extraction.amount_min);
  }
  if (typeof extraction.amount_max === 'number' && !grant.amount_max) {
    update.amount_max = Math.round(extraction.amount_max);
  }
  if (typeof extraction.eligibility_summary === 'string' && extraction.eligibility_summary.trim()) {
    update.requirements_summary = extraction.eligibility_summary.slice(0, 500);
  }
  // Rolling used to overwrite a quoted status unconditionally. It is now only
  // allowed to speak where nothing better was established.
  if (extraction.is_rolling === true && !update.status) {
    update.status = 'ongoing';
  }

  update.metadata = {
    ...(grant.metadata && typeof grant.metadata === 'object' ? grant.metadata : {}),
    deadline_provenance: {
      source: PROVENANCE_SOURCE,
      at: now,
      provider: extraction.provider || null,
      deadline_evidence: deadlineEvidence,
      deadline_rejected: rejectedDeadline,
      status_claimed: rawStatus,
      status_evidence: statusEvidence,
    },
  };

  return {
    update,
    deadlineAccepted: Boolean(update.deadline),
    deadlineRejected: rejectedDeadline,
  };
}

/**
 * Turning one LLM-extracted foundation programme into a foundation_programs row.
 *
 * Why this is its own module (2026-09-21): the mapping used to live inline in
 * discover-foundation-programs.mjs, which meant the only way to test it was to
 * run a live 4,609-programme sync. It also only ever asked for dates. The
 * application-level fields a human actually needs to act — who may apply, how
 * to apply, who to contact — sat at 11% filled, so a re-scan that fixed dates
 * alone was not worth its cost.
 *
 * The rule from the deadline bug generalises: a field the model could plausibly
 * invent is only written when it can quote the page for it. Everything else is
 * null, and null is a correct answer.
 */

// The quote rule is shared with every other extractor — see llm-evidence.mjs.
export { MIN_QUOTE, quote } from './llm-evidence.mjs';
import { quote } from './llm-evidence.mjs';

export const APPLICANT_TYPES = ['organisation', 'individual', 'not_an_application'];
export const ROUND_STATUSES = ['open', 'closed', 'unknown'];
export const APPLICATION_MODES = [
  'online_application',
  'eoi',
  'email_application',
  'invitation_only',
  'relationship_based',
  'rolling',
  'not_accepting',
];
export const CADENCES = ['rolling', 'annual', 'biannual', 'quarterly', 'one_off', 'unknown'];

function oneOf(value, allowed, fallback = null) {
  return typeof value === 'string' && allowed.includes(value) ? value : fallback;
}

function text(value, max) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

function httpUrl(value) {
  return typeof value === 'string' && value.startsWith('http') ? value.slice(0, 1000) : null;
}

/**
 * Prose fields are written only when the model also quoted the page. The quote
 * is what separates "the site says who may apply" from "the model knows what
 * foundations usually say".
 */
function evidenced(value, evidence, max) {
  const body = text(value, max);
  const proof = quote(evidence);
  return body && proof ? { value: body, evidence: proof } : { value: null, evidence: proof };
}

function contactOf(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const email = typeof raw.email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw.email.trim())
    ? raw.email.trim().toLowerCase()
    : null;
  const phone = typeof raw.phone === 'string' && raw.phone.replace(/\D/g, '').length >= 8
    ? raw.phone.trim().slice(0, 40)
    : null;
  const page = httpUrl(raw.url);
  const name = text(raw.name, 200);
  if (!email && !phone && !page) return null;
  return { email, phone, url: page, name };
}

/**
 * @param {object} prog  one entry from the model's JSON array
 * @param {{ foundationId: string, scannedAt: string }} ctx
 * @returns {object|null} a foundation_programs row, or null if unusable
 */
export function buildProgramRecord(prog, { foundationId, scannedAt }) {
  if (!prog || typeof prog.name !== 'string' || prog.name.trim().length <= 3) return null;

  const rawDeadline = typeof prog.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(prog.deadline)
    ? prog.deadline
    : null;
  const deadlineEvidence = quote(prog.deadline_evidence);
  const acceptedDeadline = rawDeadline && deadlineEvidence ? rawDeadline : null;
  // Keep what was thrown away, so the damage of this gate stays measurable.
  const rejectedDeadline = rawDeadline && !deadlineEvidence ? rawDeadline : null;

  const roundStatus = oneOf(prog.round_status, ROUND_STATUSES, 'unknown');
  const applicantType = oneOf(prog.applicant_type, APPLICANT_TYPES, 'unknown');

  const status = (acceptedDeadline && new Date(acceptedDeadline) < new Date(scannedAt)) || roundStatus === 'closed'
    ? 'closed'
    : roundStatus === 'open' ? 'open' : 'unknown';

  const eligibility = evidenced(prog.eligibility, prog.eligibility_evidence, 2000);
  const application = evidenced(prog.how_to_apply, prog.how_to_apply_evidence, 2000);
  const contact = contactOf(prog.contact);

  const sourceUrls = Array.isArray(prog.source_urls)
    ? [...new Set(prog.source_urls.map(httpUrl).filter(Boolean))].slice(0, 10)
    : [];
  const programUrl = httpUrl(prog.url);
  if (programUrl && !sourceUrls.includes(programUrl)) sourceUrls.unshift(programUrl);

  return {
    foundation_id: foundationId,
    name: prog.name.trim().slice(0, 500),
    url: programUrl,
    description: text(prog.description, 2000),
    amount_min: typeof prog.amount_min === 'number' ? prog.amount_min : null,
    amount_max: typeof prog.amount_max === 'number' ? prog.amount_max : null,
    // A deadline is only accepted with a quote from the page behind it. Without
    // this gate the model returned plausible month-end dates instead of null:
    // on 2026-09-21, 50 different funders shared 2026-06-30 and Annamila's three
    // streams all carried 2026-09-30 while their site said "grant rounds are
    // currently closed until further notice".
    deadline: acceptedDeadline,
    // 'open' used to be the default for anything without a past deadline, so a
    // paused funder read as open forever. Unknown is now its own answer.
    status,
    categories: Array.isArray(prog.categories) ? prog.categories.filter(c => typeof c === 'string') : [],
    program_type: text(prog.type, 100),
    eligibility: eligibility.value,
    application_process: application.value,
    application_mode: oneOf(prog.application_mode, APPLICATION_MODES),
    thematic_focus: Array.isArray(prog.thematic_focus) ? prog.thematic_focus.filter(t => typeof t === 'string') : [],
    place_focus: Array.isArray(prog.place_focus) ? prog.place_focus.filter(p => typeof p === 'string') : [],
    source_urls: sourceUrls,
    scraped_at: scannedAt,
    metadata: {
      // Kept so a later pass can audit WHY each field was or was not accepted,
      // and so sync can refuse to treat an unevidenced value as a grant signal.
      deadline_evidence: deadlineEvidence,
      deadline_rejected: rejectedDeadline,
      round_status: roundStatus,
      round_status_evidence: quote(prog.round_status_evidence),
      applicant_type: applicantType,
      eligibility_evidence: eligibility.evidence,
      eligibility_rejected: eligibility.value ? null : text(prog.eligibility, 500),
      how_to_apply_evidence: application.evidence,
      how_to_apply_rejected: application.value ? null : text(prog.how_to_apply, 500),
      assessment_cadence: oneOf(prog.assessment_cadence, CADENCES, 'unknown'),
      contact,
      extraction_version: 3,
    },
  };
}

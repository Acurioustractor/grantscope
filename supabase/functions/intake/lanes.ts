// Lane resolution for the ACT intake spine.
//
// Design source: thoughts/shared/ghl/2026-08-29-ghl-front-door-brief.md §4
// (act-regenerative-studio), "Lane is computed server-side, default-deny".
//
// THE ONE RULE: the caller cannot set, suggest, or influence the lane. There is no
// `lane` field in the intake payload. It is derived here from (projectCode, formType)
// and nothing else, and a pair that is not explicitly allowlisted resolves to
// `duty_of_care` — which means the submission never reaches GHL at all.
//
// Why default-deny rather than a tag or a flag on the form:
//   The tag-based exclusion has already failed four times. `lane:community` resolves
//   to 86 contacts and `comms:act-newsletter` to 140; their intersection is 4. One of
//   those four holds role:storyteller, role:buyer, tier:member and
//   comms:harvest-newsletter simultaneously, with DND written by "Updated by contact
//   merge" rather than by a human. A tag can be added by a merge, a workflow, a bulk
//   action, or any of four divergent GHL clients. Default-deny is the difference
//   between a convention and a guard.
//
// Why this lives here and not in each site's GHL client:
//   The 2026-08-29 lane-gate attempt tried to gate `GHLClient` inside each repo and
//   produced 23 blocker/major findings, because the premise was wrong — GHLClient is
//   exported with a public constructor and admin routes build their own Bearer fetch
//   to services.leadconnectorhq.com, so there is no chokepoint to gate. The chokepoint
//   is this endpoint: the one place every site posts to.

export type Lane = 'commerce' | 'transactional' | 'community' | 'duty_of_care';

export const LANES: readonly Lane[] = [
  'commerce',
  'transactional',
  'community',
  'duty_of_care',
] as const;

/**
 * Project codes where EVERY submission is duty of care, whatever the form says.
 *
 * These are the communities and programs where a person reaching us is, by default,
 * someone we owe a duty of care to rather than a prospect: PICC and the Palm Island
 * work, Oonchiumpa, Mounty Yarns, BG Fit, June's Patch (clinical referrals), the
 * On Country Photo Studio, and Uncle Allan's art practice.
 *
 * Codes verified against act-global-infrastructure/config/project-codes.json.
 */
export const DUTY_OF_CARE_PROJECT_CODES: ReadonlySet<string> = new Set([
  'ACT-PI', // PICC
  'ACT-OO', // Oonchiumpa
  'ACT-MY', // Mounty Yarns
  'ACT-BG', // BG Fit
  'ACT-JP', // June's Patch — clinical referrals
  'ACT-PS', // PICC On Country Photo Studio
  'ACT-UA', // Uncle Allan Palm Island Art
]);

/**
 * Form types that are duty of care wherever they appear, on any project.
 *
 * A person telling us their story, asking for help, claiming a bed, or being referred
 * is not a lead. None of these ever produce a GHL record.
 */
export const DUTY_OF_CARE_FORM_TYPES: ReadonlySet<string> = new Set([
  'story', // share-your-story, act.place contact form and elsewhere
  'share-your-story',
  'lived-experience', // JusticeHub
  'lived_experience',
  'support', // Goods QR asset-support
  'asset-support',
  'claim', // Goods /claim
  'communities', // Goods /communities
  'referral', // June's Patch clinical referrals
  'meeting-finder', // SMART Connect
  'storyteller', // Empathy Ledger storyteller / Elder / knowledge-keeper
  'elder',
  'knowledge-keeper',

  // JusticeHub, added 2026-08-31 when its sixteen intake routes were surveyed.
  // `tour-story` collects { name, email, tour_stop, story }: a person's own account of
  // walking through CONTAINED, a replica youth detention cell. Default-deny already
  // covered it, because an unlisted form type falls to this lane anyway. It is named
  // here so that protection is a decision rather than an accident, and so that anyone
  // later tempted to allowlist it has to delete this line and read why.
  'tour-story',
  'tour-stories',
]);

/**
 * The explicit allowlist. A form type reaches GHL only if it is named here.
 *
 * commerce      — buyer, bulk order, sponsor, media pack, partnership, funder.
 *                 Full machinery: consent field when ticked, comms: tag, opportunity.
 * transactional — the person just took an action and expects a receipt.
 * community     — a person rather than a prospect. Contact upsert with identity tags
 *                 only, inbound conversation, marked unread. No consent write, no
 *                 comms: tag, no opportunity, no workflow, no acknowledgement.
 *
 * Anything absent from this map resolves to duty_of_care. That is the point: adding a
 * new form to a site cannot open a marketing path by accident. Someone has to come
 * here and name it.
 */
export const FORM_TYPE_LANE: ReadonlyMap<string, Lane> = new Map<string, Lane>([
  // A newsletter box is an express opt-in typed by a supporter.
  ['newsletter', 'commerce'],

  // Prospect-shaped enquiries.
  ['flagship-inquiry', 'commerce'],
  ['partnership', 'commerce'],
  ['sponsor', 'commerce'],
  ['media-pack', 'commerce'],
  ['bulk-order', 'commerce'],
  ['funder', 'commerce'],
  ['donation', 'commerce'],

  // Actions that expect a receipt.
  ['rsvp', 'transactional'],
  ['event', 'transactional'],
  ['csa', 'transactional'],
  ['farm-stay', 'transactional'],
  ['residency', 'transactional'],

  // People, not prospects.
  ['contact', 'community'],
  ['volunteer', 'community'],
  ['payout-wall-contest', 'community'],

  // ---- JusticeHub, classified 2026-08-31 -------------------------------------
  // Its sixteen public intake routes each rolled their own GHL call and none of their
  // form types were named here, so every one of them default-denied to duty_of_care.
  // That failed safe and it also meant JusticeHub could never route at all. Each line
  // below is a judgement about whether the person on the other end is a prospect.
  //
  // The line worth arguing with is `host`. Someone offering a venue for the CONTAINED
  // tour is doing us a favour, which does not feel like commerce. It sits there because
  // commerce is the lane with the machinery a partner conversation needs: an
  // opportunity, a pipeline, a named owner. The lane names what we do about a person,
  // not what we think of them.
  //
  // Anything JusticeHub adds later and does not name here still default-denies, which
  // is the behaviour to keep rather than to work around.

  // Civic action. A person acting on the world, not asking us for anything, and not
  // handing us their own story either. Contact upsert and a conversation, nothing more.
  ['nomination', 'community'],       // naming a decision-maker who should see CONTAINED
  ['reaction', 'community'],         // a response left at the exhibit
  ['mp-letter', 'community'],        // writing to their member
  ['connect', 'community'],          // CONTAINED connect
  ['action', 'community'],           // hub actions
  ['follow', 'community'],           // following a Justice Matrix entry
  ['watch', 'community'],
  ['contribute', 'community'],       // contributing a correction to the Matrix

  // Prospect-shaped: there is a conversation to have and someone should own it.
  ['host', 'commerce'],              // offering a site for the tour
  ['backer', 'commerce'],            // backing a project financially

  // Took an action, expects a receipt.
  ['brisbane-interest', 'transactional'],
]);

export interface LaneInput {
  projectCode: string;
  formType: string;
  /**
   * Goods QR support sets this when the submitter has flagged a safety risk. Present
   * on any form, it forces duty_of_care regardless of everything else.
   */
  safetyRisk?: boolean;
}

export interface LaneDecision {
  lane: Lane;
  /** Why this lane was chosen. Written to the outbox row so a decision is auditable. */
  reason: string;
}

/**
 * Resolve the lane for a submission. Total function: every input returns a lane, and
 * the fallback is always the most protective one.
 */
export function resolveLane(input: LaneInput): LaneDecision {
  const projectCode = (input.projectCode ?? '').trim().toUpperCase();
  const formType = (input.formType ?? '').trim().toLowerCase();

  if (input.safetyRisk === true) {
    return { lane: 'duty_of_care', reason: 'safetyRisk flag set on the submission' };
  }

  if (DUTY_OF_CARE_PROJECT_CODES.has(projectCode)) {
    return { lane: 'duty_of_care', reason: `project ${projectCode} is duty of care` };
  }

  if (DUTY_OF_CARE_FORM_TYPES.has(formType)) {
    return { lane: 'duty_of_care', reason: `form type ${formType} is duty of care` };
  }

  const allowed = FORM_TYPE_LANE.get(formType);
  if (allowed === undefined) {
    return {
      lane: 'duty_of_care',
      reason: `form type ${formType || '(empty)'} is not on the allowlist — default deny`,
    };
  }

  return { lane: allowed, reason: `form type ${formType} is allowlisted as ${allowed}` };
}

/** A duty_of_care submission never touches GHL. One place to ask. */
export function reachesGhl(lane: Lane): boolean {
  return lane !== 'duty_of_care';
}

/** Consent may be written only in these lanes, and only on an explicit ticked box. */
export function mayWriteConsent(lane: Lane): boolean {
  return lane === 'commerce' || lane === 'transactional';
}

/** An opportunity is created only for a genuine prospect. */
export function mayCreateOpportunity(lane: Lane): boolean {
  return lane === 'commerce';
}

/**
 * How protective each lane is, ascending. `commerce` does the most to a person
 * (consent write, comms: tag, opportunity, workflow); `duty_of_care` does nothing to
 * them at all and routes to a human instead.
 *
 * This exists so the invariant below can be stated as one comparison rather than as a
 * growing list of special cases.
 */
export const LANE_PROTECTION: Readonly<Record<Lane, number>> = {
  commerce: 0,
  transactional: 1,
  community: 2,
  duty_of_care: 3,
};

/**
 * THE INVARIANT, decided across #92 and #95: any input beyond `(projectCode, formType)`,
 * caller-supplied or not, may only demote a submission toward `duty_of_care`. It may
 * never promote one toward `commerce`.
 *
 * `safetyRisk` already obeys it. `sourcePath` (#95) and the org test (#92) must obey it
 * when they land, and `lanes.test.ts` fails if they do not: the extras table there is a
 * mapped type over the optional fields of `LaneInput`, so adding a field without adding
 * its cases is a type error rather than a field that quietly goes untested.
 *
 * Why it has to be a guard and not a habit: every one of those inputs arrives from
 * somewhere less trustworthy than this file. `sourcePath` is sent by the posting site.
 * The org test reads a CRM that four divergent clients write to. If any of them could
 * promote, the default-deny allowlist above would stop being the floor and become a
 * suggestion, which is the exact failure the tag-based approach kept producing.
 */
export function isAtLeastAsProtective(candidate: Lane, baseline: Lane): boolean {
  return LANE_PROTECTION[candidate] >= LANE_PROTECTION[baseline];
}

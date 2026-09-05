import type { Lane } from './lanes.ts';

/**
 * The submission's dedupe handle.
 *
 * Its own module so it can be tested. It used to be four lines inline in the serve
 * handler, which is why the defect below survived a green suite: nothing could reach
 * it except a live HTTP call.
 */
export interface IdempotencyInput {
  site: string;
  projectCode: string;
  formType: string;
  /** The RESOLVED lane, not a requested one. The caller cannot influence it. */
  lane: Lane;
  /** Email if there is one, else phone. Lowercased here so callers cannot forget. */
  contact: string;
  /** UTC date, YYYY-MM-DD. Dedupe is deliberately scoped to a day. */
  day: string;
}

/**
 * THE RULE: a submission may only dedupe against one that was routed the same way.
 *
 * The original key was `site|formType|email|day`. It omitted projectCode while the
 * lane is derived FROM projectCode, so two submissions differing only by project
 * collided and the second was silently discarded: no row written, nobody notified, and
 * a 200 returned carrying the lane it would have had. On 2026-08-31 an ACT-IN contact
 * stored `community`, and an ACT-PI contact from the same address minutes later
 * resolved to `duty_of_care` and vanished into it. `safetyRisk` had the same hole from
 * the other side: same project, same form, only the flagged submission lost.
 *
 * Including the resolved lane makes the rule structural instead of remembered. Every
 * input that can change the lane necessarily changes the key, so a lane input added
 * later cannot quietly reopen this.
 */
export function idempotencySeed(input: IdempotencyInput): string {
  return [
    input.site,
    input.projectCode,
    input.formType,
    input.lane,
    input.contact.toLowerCase(),
    input.day,
  ].join('|');
}

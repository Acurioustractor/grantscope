// Who gets told, through which channel, for each lane.
//
// Design source: Ben, 2026-08-30. "I want the best system so they pop up in GHL as
// conversations, then automated replies for all, and also they are sent to hi@act.place,
// and we ensure replies are in GHL as well."
//
// Three jobs, and the whole point is that they are separable:
//
//   1. NOTIFY  — every submission, every lane, emails hi@act.place. That address is a
//      real Google Workspace mailbox and is the only one in the estate verified to
//      receive. It needs no GHL, so duty of care can use it too. It is the backstop
//      that makes "a human saw it" true even when the CRM path is deliberately closed.
//
//   2. ACKNOWLEDGE — the submitter is told their message arrived.
//
//   3. THREAD THE REPLY — when they answer, the answer lands somewhere a human looks.
//
// Job 3 is why the ack channel matters more than it looks. An ack sent BY GHL carries a
// GHL Reply-To, so the person's reply threads back into the same conversation on its
// own. An ack sent by anything else does not, and their reply goes to a mailbox instead.
// So the channel is not a delivery detail, it decides where the conversation lives.

import type { Lane } from './lanes.ts';

/** The one address in the estate proven to receive. See scripts/check-estate.mjs. */
export const NOTIFY_INBOX = 'hi@act.place';

/**
 * 'ghl'    — GHL sends it, GHL owns the Reply-To, the reply threads back into the
 *            conversation. The default, because it is the only channel that closes
 *            the loop without a forwarding rule.
 * 'direct' — sent outside GHL entirely. The submitter never becomes a CRM record, so
 *            their reply goes to NOTIFY_INBOX and a human works it there.
 */
export type AckChannel = 'ghl' | 'direct';

/**
 * Duty of care may never acknowledge through GHL, because acknowledging through GHL
 * requires a contactId, and creating that contact is the exact thing the lane exists to
 * prevent. #90 settled this: GHL cannot notify about a person without creating them.
 *
 * Every other lane already has a GHL contact by the time an ack is sent, so using GHL
 * costs nothing and buys the threaded reply.
 */
export function ackChannelFor(lane: Lane): AckChannel {
  return lane === 'duty_of_care' ? 'direct' : 'ghl';
}

export interface SubmissionSummary {
  id?: string;
  site: string;
  projectCode: string;
  formType: string;
  submitterName?: string | null;
  submitterEmail?: string | null;
  /** The message the person typed. Withheld from duty-of-care notifications. */
  body?: string | null;
  /** Why the lane was chosen, from resolveLane. */
  laneReason?: string;
}

export interface Message {
  subject: string;
  text: string;
}

/**
 * The notification to NOTIFY_INBOX.
 *
 * For duty of care this deliberately carries identity and route and NOT the message
 * body, which is #90's rule: the people who need to act must know who reached us and
 * through which door, without the contents being copied into a shared inbox and a
 * notification trail. The register row holds the body, under RLS.
 */
export function buildNotification(lane: Lane, s: SubmissionSummary): Message {
  const who = s.submitterName?.trim() || s.submitterEmail?.trim() || 'someone unnamed';
  const withholdBody = lane === 'duty_of_care';

  const lines = [
    `Lane: ${lane}${s.laneReason ? ` (${s.laneReason})` : ''}`,
    `From: ${who}${s.submitterEmail ? ` <${s.submitterEmail}>` : ''}`,
    `Site: ${s.site}`,
    `Project: ${s.projectCode}`,
    `Form: ${s.formType}`,
    s.id ? `Intake row: ${s.id}` : null,
    '',
  ].filter((l): l is string => l !== null);

  if (withholdBody) {
    lines.push(
      'The message itself is not in this email, on purpose.',
      'It is on the duty-of-care register row above, which is behind RLS.',
      '',
      'This person is not in the CRM and must not be added to it.',
    );
  } else {
    lines.push(s.body?.trim() || '(no message body was submitted)');
  }

  const prefix = withholdBody ? 'Duty of care' : 'New enquiry';
  return {
    subject: `${prefix}: ${s.projectCode} ${s.formType} from ${who}`,
    text: lines.join('\n'),
  };
}

/**
 * The automated acknowledgement to the submitter.
 *
 * Deliberately short and deliberately does not promise a timeframe we have not agreed.
 * It says a person will read it, because a person will, and the notification above is
 * what makes that true rather than a hope.
 */
export function buildAcknowledgement(lane: Lane, s: SubmissionSummary): Message {
  const first = (s.submitterName ?? '').trim().split(/\s+/)[0] || '';
  const greeting = first ? `${first},` : 'Hello,';

  const body = lane === 'duty_of_care'
    ? [
      greeting,
      '',
      'We have your message and a person is reading it, not a system.',
      '',
      'If you need to add anything, reply to this email and it comes straight back to us.',
    ]
    : [
      greeting,
      '',
      'Thanks for getting in touch. Your message has arrived and someone will read it and come back to you.',
      '',
      'If you need to add anything in the meantime, just reply to this email.',
    ];

  return {
    subject: lane === 'duty_of_care'
      ? 'We have your message'
      : `We have your message about ${s.projectCode}`,
    text: body.join('\n'),
  };
}

// ---------------------------------------------------------------------------
// The desk.
// ---------------------------------------------------------------------------
//
// #90 settled the shape: GHL cannot notify about a person without creating them as a
// contact, so the notification is addressed to US, about them, with the register row
// as the pointer. The person is never a GHL contact.
//
// Applying that to the inbox removes the whole Resend dependency for notification. The
// desk is itself a GHL contact, GHL emails it, and the message arrives in the Google
// mailbox AND is visible in GHL. No new secret, no sending domain to verify.

/**
 * The desk's own address, deliberately NOT hi@act.place.
 *
 * hi@act.place already exists in GHL as x9ppRP5MZJnF6v01DgWj carrying role:storyteller,
 * lane:community, tier:curious, goods-partner-lead, goods-segment-plastic-supply and
 * several event tags, from a Gmail import and the LGANT delivery checks. Notifying
 * through that contact would put the desk inside sending audiences, which is the open
 * question on #99. A dedicated address starts clean and can be kept clean.
 *
 * Expected to be a Google Workspace alias delivering to hi@act.place.
 */
export const DESK_ADDRESS = 'desk@act.place';

/** The only tags the desk contact may carry. Identity, never audience. */
export const DESK_TAGS: readonly string[] = ['act-internal-desk'] as const;

/**
 * Tag prefixes that can put a contact into a sending audience, a lane, or a campaign.
 * The desk must never carry one. Checked at run time rather than assumed, because the
 * pollution on hi@act.place arrived through a Gmail import and a contact merge, not
 * through anything that reviewed it.
 */
export const AUDIENCE_TAG_PREFIXES: readonly string[] = [
  'lane:',
  'comms:',
  'tier:',
  'role:',
  'goods-segment-',
  'goods-partner-',
] as const;

/** Any tag on this contact that could sweep it into a send. Empty is the good answer. */
export function audienceTagsOn(tags: readonly string[]): string[] {
  return tags.filter((t) =>
    AUDIENCE_TAG_PREFIXES.some((p) => t.toLowerCase().startsWith(p))
  );
}

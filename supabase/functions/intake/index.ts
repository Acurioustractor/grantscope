// ACT intake spine — the one endpoint every ACT site posts to.
//
//   POST https://tednluwflfhxyucgwigh.supabase.co/functions/v1/intake
//   Deploy: supabase functions deploy intake
//
// Design source: thoughts/shared/ghl/2026-08-29-ghl-front-door-brief.md §4
// (act-regenerative-studio). Read that before changing the order of operations.
//
// Why an edge function rather than a Next.js route: act.place is served by Webflow
// (A 198.202.211.1, www CNAME cdn.webflow.com), so the Next app cannot serve the live
// site. A hosted cross-origin endpoint is the only shape that serves all properties.
//
// The two invariants this file exists to hold:
//   1. The outbox row is written BEFORE any network call. A GHL outage loses nothing
//      and the visitor never waits on it — we return 202 and deliver out of band.
//   2. `lane` is computed server-side, default-deny (see lanes.ts). A duty_of_care
//      submission makes ZERO GHL API calls. Not "calls that get filtered" — none.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  type Lane,
  mayCreateOpportunity,
  mayWriteConsent,
  reachesGhl,
  resolveLane,
} from './lanes.ts';
import { isKnownProjectCode, PROJECT_CODES, projectTag } from './project-codes.ts';
import { pipelineFor } from './pipelines.ts';
import { idempotencySeed } from './idempotency.ts';
import {
  ackChannelFor,
  audienceTagsOn,
  buildAcknowledgement,
  buildNotification,
  DESK_ADDRESS,
  DESK_TAGS,
  NOTIFY_INBOX,
  type SubmissionSummary,
} from './notify.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-act-intake-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// GHL custom field ids, verified against the live location 2026-08-29.
const FIELD_NEWSLETTER_CONSENT = 'aVnqmajnysMtGYhLD0oA';
const FIELD_CONSENT_SOURCE = 'HdnMUyXkZRPZG7l7cygG';
const FIELD_CONSENT_TIMESTAMP = 'Z1E4OJl7lf8kWbJGASDM';
const FIELD_MESSAGE = 'ceJz9FUf8dE4fmvnPDKd';

const GHL_API = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';
// The opportunities endpoint is the one call that will not answer on 2021-07-28. It
// wants the trailing slash and this version, or it 404s. Proven in
// act-regenerative-studio src/lib/ghl/client.ts:232.
const GHL_OPPORTUNITY_VERSION = '2023-02-21';

// Per-form identity tags, lifted verbatim from act-regenerative-studio
// src/app/api/forms/submit/route.ts:256. Colon-namespaced only — see the guard below.
const FORM_RULES: Record<string, string[]> = {
  newsletter: ['source:website', 'role:supporter'],
  contact: ['source:website'],
  donation: ['source:website', 'role:supporter', 'action:contributed'],
  volunteer: ['source:website', 'role:supporter', 'interest:volunteer'],
  event: ['source:event-signup', 'interest:events', 'action:attended'],
  csa: ['source:website', 'role:supporter', 'interest:membership'],
  'farm-stay': ['source:website', 'role:supporter', 'interest:farm-stay'],
  residency: ['source:website', 'role:supporter', 'interest:residency'],
  'payout-wall-contest': ['source:website', 'role:supporter', 'interest:justice-reform'],
  'flagship-inquiry': ['source:website', 'role:supporter'],
  rsvp: ['source:website', 'interest:events', 'action:rsvped'],
};

// Spam signatures. Roughly 75-80% of the ~2.7 Webflow submissions a week are SEO spam
// and must never become GHL contacts. Rows are kept, never deleted.
const SPAM_PHRASES = [
  'guest post',
  'guest posting',
  'backlink',
  'back link',
  'link building',
  'seo service',
  'seo audit',
  'improve your ranking',
  'first page of google',
  'web design services',
  'increase traffic',
  'digital marketing agency',
];
const URL_IN_MESSAGE = /https?:\/\/|www\./i;

interface IntakeBody {
  site?: string;
  projectCode?: string;
  formType?: string;
  fields?: Record<string, unknown>;
  additionalTags?: unknown;
  consent?: { newsletter?: boolean; sourceUrl?: string; timestamp?: string };
  idempotencyKey?: string;
  capturedAt?: string;
  dryRun?: boolean;
  /** Honeypot. Any value at all means a bot filled a hidden field. */
  website?: string;
  safetyRisk?: boolean;
}

/**
 * GHL's outbound email endpoint wants `html`. It does NOT accept `message`, and it
 * does not say so usefully: a payload with `message` returns
 *   422 CONVERSATIONS_MSG_NO_CONTENT "There is no message or attachments"
 * which reads like an empty body rather than a wrong field name.
 *
 * That is exactly how this went unnoticed. Both outbound legs, the desk
 * notification and the sender's acknowledgement, used `message` and had NEVER
 * once succeeded. The inbound leg uses a different endpoint and worked, so the
 * row said `delivered` while no email had left the building. Found 2026-08-31 by
 * reading the edge function logs after a real submission, because the CRM record
 * looked perfect from every other angle.
 */
function asEmailHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}

/**
 * Site keys. One secret per site so a site can be revoked without touching the others.
 * Env shape: ACT_INTAKE_KEY_<SLUG> where SLUG is the site with . and - replaced by _.
 *
 * verify_jwt is false on this function (same posture as ghl-webhook), so THIS is the
 * only thing standing between the endpoint and the open internet. It fails closed: an
 * unconfigured site is rejected, never waved through.
 */
function siteFromKey(site: string, presented: string | null): boolean {
  if (!presented) return false;
  const envName = `ACT_INTAKE_KEY_${site.replace(/[.-]/g, '_').toUpperCase()}`;
  const expected = Deno.env.get(envName);
  if (!expected || expected.length < 16) return false; // unconfigured site => denied
  return timingSafeEqual(presented, expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function isSpam(formType: string, fields: Record<string, unknown>, honeypot?: string): boolean {
  if (str(honeypot)) return true;
  const message = (str(fields.message) ?? '').toLowerCase();
  if (!message) return false;
  if (SPAM_PHRASES.some((p) => message.includes(p))) return true;
  // A URL in the body of a plain contact form is the dominant spam signature here.
  if (formType === 'contact' && URL_IN_MESSAGE.test(message)) return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: IntakeBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Body must be JSON' }, 400);
  }

  // ---- 1. Validate -------------------------------------------------------------
  const site = str(body.site);
  if (!site) return json({ error: 'site is required' }, 400);

  if (!siteFromKey(site, req.headers.get('x-act-intake-key'))) {
    return json({ error: 'Unauthorised' }, 401);
  }

  const projectCode = (str(body.projectCode) ?? '').toUpperCase();
  if (!projectCode) return json({ error: 'projectCode is required' }, 400);

  // Hard 400, never a silent fallback to a default project. The old route fell through
  // to ACT-IN here, which is how correct ACT-FM submissions became project:act-in on
  // the wrong comms list.
  if (!isKnownProjectCode(projectCode)) {
    return json({ error: `Unknown projectCode: ${projectCode}` }, 400);
  }

  const formType = (str(body.formType) ?? '').toLowerCase();
  if (!formType) return json({ error: 'formType is required' }, 400);

  const fields = (body.fields ?? {}) as Record<string, unknown>;
  const email = str(fields.email);
  const phone = str(fields.phone);
  if (!email && !phone) {
    return json({ error: 'fields.email or fields.phone is required' }, 400);
  }

  if (body.dryRun === true && Deno.env.get('ENVIRONMENT') === 'production') {
    return json({ error: 'dryRun is not permitted in production' }, 403);
  }

  // ---- 6 (computed early, because it decides everything downstream) ------------
  const decision = resolveLane({
    projectCode,
    formType,
    safetyRisk: body.safetyRisk === true,
  });

  // ---- 2. Idempotency key ------------------------------------------------------
  // The seed lives in idempotency.ts, with the reasoning and its regression tests. It
  // is computed AFTER the lane, because the resolved lane is part of it: a submission
  // may only ever dedupe against one that was routed the same way. See that file for
  // the 2026-08-31 defect this shape exists to close.
  const idempotencyKey =
    str(body.idempotencyKey) ??
    (await sha256Hex(
      idempotencySeed({
        site,
        projectCode,
        formType,
        lane: decision.lane,
        contact: email ?? phone ?? '',
        day: new Date().toISOString().slice(0, 10),
      }),
    ));

  // ---- 5. Spam gate ------------------------------------------------------------
  // Applied after lane resolution but before any delivery: a duty-of-care submission
  // is never classified as spam and discarded, because the cost of being wrong there
  // is a person asking for help who is never seen.
  const spam = decision.lane !== 'duty_of_care' && isSpam(formType, fields, body.website);

  const ghlStatus = spam
    ? 'spam'
    : decision.lane === 'duty_of_care'
    ? 'excluded_by_lane'
    : 'pending';

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ---- 3. Write the outbox row BEFORE any network call -------------------------
  const row = {
    idempotency_key: idempotencyKey,
    site,
    project_code: projectCode,
    form_type: formType,
    lane: decision.lane,
    submitter_email: email ?? null,
    submitter_name:
      str(fields.name) ??
      (str([str(fields.firstName), str(fields.lastName)].filter(Boolean).join(' ')) ?? null),
    subject: str(fields.subject) ?? null,
    payload: {
      ...body,
      _laneReason: decision.reason,
      _capturedAt: str(body.capturedAt) ?? new Date().toISOString(),
    },
    ghl_status: ghlStatus,
    inbox_status: reachesGhl(decision.lane) && !spam ? 'pending' : null,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('act_intake')
    .insert(row)
    .select('id')
    .maybeSingle();

  if (insertError) {
    // 23505 is the unique violation on idempotency_key: the same submission arriving
    // twice. Return success without a second acknowledgement or a second GHL call.
    if (insertError.code === '23505') {
      return json({ ok: true, deduped: true, lane: decision.lane }, 200);
    }
    console.error('act_intake insert failed', insertError);
    return json({ error: 'Could not record submission' }, 500);
  }

  const id = inserted?.id as string | undefined;

  if (body.dryRun === true) {
    return json({
      ok: true,
      dryRun: true,
      id,
      lane: decision.lane,
      laneReason: decision.reason,
      wouldReachGhl: reachesGhl(decision.lane) && !spam,
    });
  }

  const summary: SubmissionSummary = {
    id,
    site,
    projectCode,
    formType,
    submitterName: str(fields.name) ?? null,
    submitterEmail: str(fields.email) ?? null,
    body: str(fields.message) ?? null,
    laneReason: decision.reason,
  };

  // ---- 5b. Tell the humans, whatever the lane. -------------------------------
  // This is the only path that does not run through the CRM, which is exactly why it
  // is the one that still works when the CRM is deliberately bypassed. A duty-of-care
  // submission is notified even when the spam heuristic fired: a false alert costs a
  // glance, a missed person costs much more.
  if (!spam || decision.lane === 'duty_of_care') {
    queueMicrotaskSafe(() => notifyDesk(decision.lane, summary));
  }

  // ---- 6. Duty of care: stop here. No GHL call is made. ------------------------
  if (decision.lane === 'duty_of_care') {
    // Delivery to the register and the named human happens out of band, but the
    // exclusion itself is already durable on the row above.
    queueMicrotaskSafe(() => notifyDutyOfCare(supabase, id, row, decision.reason));
    if (ackChannelFor(decision.lane) === 'direct') {
      queueMicrotaskSafe(() => acknowledgeDirect(decision.lane, summary));
    }
    return json({ ok: true, id, lane: decision.lane, received: true }, 202);
  }

  if (spam) {
    return json({ ok: true, id, received: true }, 202);
  }

  // ---- 4. Return 202 immediately; deliver out of band --------------------------
  // The visitor never waits on GHL and never sees a 503 because GHL was slow. The
  // 5-minute retry job re-drives anything left pending.
  queueMicrotaskSafe(() => deliverToGhl(supabase, id, { site, projectCode, formType, fields, body, lane: decision.lane, summary }));

  return json({ ok: true, id, lane: decision.lane, received: true }, 202);
});

/** EdgeRuntime.waitUntil where available, so the response is not held open. */
function queueMicrotaskSafe(fn: () => Promise<void> | void): void {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } })
    .EdgeRuntime;
  const promise = Promise.resolve()
    .then(fn)
    .catch((err) => console.error('background task failed', err));
  runtime?.waitUntil?.(promise);
}

async function notifyDutyOfCare(
  supabase: SupabaseClient,
  id: string | undefined,
  row: Record<string, unknown>,
  reason: string,
): Promise<void> {
  // The register is a separate RLS-protected table with per-role policies. Writing it
  // is deliberately the only side effect: no CRM record, no tag, no automation.
  const { error } = await supabase.from('act_duty_of_care_register').insert({
    intake_id: id,
    site: row.site,
    project_code: row.project_code,
    form_type: row.form_type,
    submitter_email: row.submitter_email,
    submitter_name: row.submitter_name,
    reason,
    payload: row.payload,
  });
  if (error) console.error('duty-of-care register write failed', error);
}

/** One Resend call. Returns false and says so loudly rather than throwing. */
async function sendDirect(to: string, subject: string, text: string, tag: string): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('NOTIFY_FROM') ?? 'ACT intake <intake@act.place>';

  if (!apiKey) {
    // Loud rather than silent. The defect this project already hit once was a write
    // path that could not work and said nothing; mail nobody receives is the same
    // shape, and the whole point of these two functions is that someone finds out.
    console.error(`${tag} DROPPED: no RESEND_API_KEY. to=${to} subject="${subject}"`);
    return false;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!res.ok) {
      console.error(`${tag} FAILED ${res.status}: ${await safeText(res)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`${tag} FAILED`, err);
    return false;
  }
}

/**
 * Acknowledge a duty-of-care submitter without touching GHL.
 *
 * The other three lanes acknowledge through GHL, which threads their reply back into
 * the conversation. This lane cannot: acknowledging through GHL needs a contactId, and
 * creating that contact is the exact thing the lane exists to prevent (#90). So the ack
 * goes direct, and their reply goes to NOTIFY_INBOX where a human works it. That is a
 * worse loop than the CRM one, and it is the correct trade: a person in trouble should
 * be told a human has their message, and should not become a marketing record to get it.
 */
async function acknowledgeDirect(lane: Lane, summary: SubmissionSummary): Promise<void> {
  const to = summary.submitterEmail?.trim();
  if (!to) return; // Nothing to reply to. The notification above still went out.
  const { subject, text } = buildAcknowledgement(lane, summary);
  await sendDirect(to, subject, text, 'DUTY-OF-CARE ACK');
}

/**
 * Tell the desk, in every lane, through GHL.
 *
 * The desk is a GHL contact, so GHL sends this and it arrives in the Google mailbox
 * behind DESK_ADDRESS *and* stands as a conversation in the CRM. Two places, one call,
 * no new secret and no sending domain to verify.
 *
 * This does not violate the duty-of-care rule, and the distinction is the whole of #90:
 * the message is addressed to US, about them. They never become a contact. What the
 * desk receives about a duty-of-care submission is identity and route, never the body,
 * which `buildNotification` enforces and `notify.test.ts` guards with a control.
 */
async function notifyDesk(lane: Lane, summary: SubmissionSummary): Promise<void> {
  const tag = `NOTIFY[${lane} ${summary.id ?? '?'}]`;
  const token = Deno.env.get('GHL_API_KEY');
  const locationId = Deno.env.get('GHL_LOCATION_ID') ?? 'agzsSZWgovjwgpcoASWG';
  const deskEmail = Deno.env.get('NOTIFY_DESK_EMAIL') ?? DESK_ADDRESS;
  const { subject, text } = buildNotification(lane, summary);

  if (!token) {
    console.error(`${tag} DROPPED: no GHL_API_KEY. subject="${subject}"`);
    return;
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Version: GHL_VERSION,
    'Content-Type': 'application/json',
  };

  try {
    const upsertRes = await fetch(`${GHL_API}/contacts/upsert`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        locationId,
        email: deskEmail,
        firstName: 'ACT',
        lastName: 'Desk',
        tags: [...DESK_TAGS],
      }),
    });
    if (!upsertRes.ok) {
      console.error(`${tag} desk upsert ${upsertRes.status}: ${await safeText(upsertRes)}`);
      return;
    }
    const upserted = await upsertRes.json().catch(() => null);
    const contact = upserted?.contact ?? upserted;
    const contactId = contact?.id;
    if (!contactId) {
      console.error(`${tag} desk upsert returned no contact id`);
      return;
    }

    // The desk must not sit inside a sending audience. Checked rather than assumed:
    // the pollution on hi@act.place arrived through a Gmail import and a contact
    // merge, neither of which reviewed anything. Loud, and does not block the send,
    // because a notification that arrives beats a notification withheld on principle.
    const stray = audienceTagsOn(contact?.tags ?? []);
    if (stray.length > 0) {
      console.error(
        `${tag} DESK CONTACT IS IN AUDIENCES: ${deskEmail} carries ${stray.join(', ')}. ` +
          'It can be swept into a campaign send. See #99.',
      );
    }

    const sendRes = await fetch(`${GHL_API}/conversations/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ type: 'Email', contactId, subject, html: asEmailHtml(text) }),
    });
    if (!sendRes.ok) {
      console.error(`${tag} FAILED ${sendRes.status}: ${await safeText(sendRes)}`);
    }
  } catch (err) {
    console.error(`${tag} FAILED`, err);
  }
}

interface DeliveryContext {
  site: string;
  projectCode: string;
  formType: string;
  fields: Record<string, unknown>;
  body: IntakeBody;
  lane: Lane;
  summary: SubmissionSummary;
}

async function deliverToGhl(
  supabase: SupabaseClient,
  id: string | undefined,
  ctx: DeliveryContext,
): Promise<void> {
  // GHL_API_KEY, not GHL_API_TOKEN. The name here was wrong at deploy, so every
  // submission would have stuck at pending with 'GHL_API_TOKEN is not set'. The
  // secret on this project is GHL_API_KEY, which is also what every other GHL
  // caller in the ecosystem reads.
  const token = Deno.env.get('GHL_API_KEY');
  const locationId = Deno.env.get('GHL_LOCATION_ID') ?? 'agzsSZWgovjwgpcoASWG';
  if (!token) {
    await markFailed(supabase, id, 'GHL_API_KEY is not set');
    return;
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Version: GHL_VERSION,
    'Content-Type': 'application/json',
  };

  const { fields, formType, projectCode, lane, body } = ctx;
  const email = str(fields.email);
  const phone = str(fields.phone);
  const entry = PROJECT_CODES.get(projectCode)!;

  try {
    // ---- 7. Contact upsert. NEVER send tags here: it overwrites every existing tag.
    //
    // customFieldS, plural, as an ARRAY of { id, field_value }. This was an object
    // named `customField`, which GHL rejects outright:
    //   422 {"message":["property customField should not exist"]}
    // and it was sent even when empty, so EVERY submission 422'd and the spine's GHL
    // delivery had never once succeeded. Found on 2026-08-31 by the first real form
    // put through it, not by the suite, which cannot reach this call. The correct
    // shape was already proven next door in act-regenerative-studio
    // src/app/api/forms/submit/route.ts.
    //
    // Omitted entirely when empty rather than sent as [], because there is nothing to
    // say and a property GHL can have opinions about is a property worth not sending.
    const customFields: Array<{ id: string; field_value: string }> = [];
    const message = str(fields.message);
    if (message) customFields.push({ id: FIELD_MESSAGE, field_value: message });

    // ---- 9. Consent only on an explicit ticked box, and only in a lane that may.
    const consented = body.consent?.newsletter === true && mayWriteConsent(lane);
    if (consented) {
      customFields.push({ id: FIELD_NEWSLETTER_CONSENT, field_value: 'Yes' });
      customFields.push({
        id: FIELD_CONSENT_SOURCE,
        field_value: str(body.consent?.sourceUrl) ?? ctx.site,
      });
      customFields.push({
        id: FIELD_CONSENT_TIMESTAMP,
        field_value: str(body.consent?.timestamp) ?? new Date().toISOString(),
      });
    }

    const upsertRes = await fetch(`${GHL_API}/contacts/upsert`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        locationId,
        email,
        phone,
        firstName: str(fields.firstName),
        lastName: str(fields.lastName),
        name: str(fields.name),
        companyName: str(fields.organisation),
        source: `intake:${ctx.site}`,
        ...(customFields.length > 0 ? { customFields } : {}),
      }),
    });

    if (!upsertRes.ok) {
      await markFailed(supabase, id, `contact upsert ${upsertRes.status}: ${await safeText(upsertRes)}`);
      return;
    }

    const upserted = await upsertRes.json();
    const contactId: string | undefined = upserted?.contact?.id ?? upserted?.id;
    if (!contactId) {
      await markFailed(supabase, id, 'contact upsert returned no contact id');
      return;
    }

    // ---- 8. Tags as a separate additive call, colon-namespaced only.
    const raw = Array.isArray(body.additionalTags)
      ? (body.additionalTags as unknown[]).filter((t): t is string => typeof t === 'string')
      : [];
    const namespaced = raw.map((t) => t.trim()).filter((t) => t.includes(':'));
    const dropped = raw.map((t) => t.trim()).filter((t) => t.length > 0 && !t.includes(':'));
    if (dropped.length > 0) {
      console.warn(`Dropped ${dropped.length} non-namespaced tag(s) before GHL: ${dropped.join(', ')}`);
    }

    const tags = Array.from(
      new Set([
        ...namespaced,
        projectTag(projectCode),
        ...(FORM_RULES[formType] ?? ['source:website']),
        // A comms: tag is a send permission. It is written only alongside a real
        // consent write, never inferred from the form type alone.
        ...(consented ? ['tier:curious', `comms:${entry.commsSlug}-newsletter`] : []),
      ]),
    );

    const tagRes = await fetch(`${GHL_API}/contacts/${contactId}/tags`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tags }),
    });
    if (!tagRes.ok) console.warn(`tag call ${tagRes.status}: ${await safeText(tagRes)}`);

    // ---- 10. Inbound conversation message, then mark unread. This is the step that
    // turns a row into a thread a human sees in the same place as an email.
    let inboxStatus = 'failed';
    const inboundRes = await fetch(`${GHL_API}/conversations/messages/inbound`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type: 'Email',
        contactId,
        locationId,
        subject: str(fields.subject) ?? `${formType} via ${ctx.site}`,
        html: buildInboundBody(ctx),
        direction: 'inbound',
        emailFrom: email ?? NOTIFY_INBOX,
        emailTo: NOTIFY_INBOX,
      }),
    });
    if (inboundRes.ok) {
      inboxStatus = 'delivered';
      const conv = await inboundRes.json().catch(() => null);
      const conversationId = conv?.conversationId ?? conv?.conversation?.id;
      if (conversationId) {
        await fetch(`${GHL_API}/conversations/${conversationId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ unreadCount: 1 }),
        }).catch(() => {});
      }
    } else {
      console.warn(`inbound message ${inboundRes.status}: ${await safeText(inboundRes)}`);
    }

    // ---- 11. Opportunity only for a genuine prospect.
    const route = mayCreateOpportunity(lane) ? pipelineFor(projectCode, formType) : null;
    if (route) {
      await fetch(`${GHL_API}/opportunities/`, {
        method: 'POST',
        headers: { ...headers, Version: GHL_OPPORTUNITY_VERSION },
        body: JSON.stringify({
          locationId,
          contactId,
          pipelineId: route.pipelineId,
          pipelineStageId: route.stageId,
          name: `${entry.name} — ${formType}`,
          status: 'open',
        }),
      }).catch((e) => console.warn('opportunity create failed', e));
    }

    // ---- 12. Acknowledge THROUGH GHL, never around it.
    // This is the step that closes the loop. Because GHL sends it, GHL owns the
    // Reply-To, so when they answer, the answer threads back into the conversation
    // above instead of landing in a mailbox that the CRM never hears about. Sending
    // the same words through Resend would look identical to the recipient and lose
    // the reply.
    let ackError: string | null = null;
    if (email && ackChannelFor(lane) === 'ghl') {
      const ack = buildAcknowledgement(lane, ctx.summary);
      const ackRes = await fetch(`${GHL_API}/conversations/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: 'Email',
          contactId,
          subject: ack.subject,
          html: asEmailHtml(ack.text),
          // The desk is CC'd so this email doubles as the reply handle.
          //
          // GHL's send API has NO replyTo field (checked against the full parameter
          // list on 2026-08-31). The only way to answer someone from Gmail and have
          // the answer tracked is to be ON an email that is genuinely addressed to
          // them. So: they are the To, the desk is the CC.
          //
          // Reply-all from the desk copy then goes to hi@ghl.act.place AND the person.
          // That first address is GHL's own inbound subdomain, verified by opening a
          // real reply-all in Gmail, so the reply reaches them AND lands back in their
          // conversation. Reply in Gmail, tracked in the CRM, never open GHL.
          //
          // This does NOT replace the desk notification, and the two cannot be merged.
          // The notification carries what the person actually wrote; an acknowledgement
          // must never quote the message back, because a duty-of-care ack can be read
          // over someone's shoulder and a commerce ack gets forwarded (see
          // notify.test.ts). Two emails, because they do two jobs and one of them is a
          // safety rule.
          emailCc: [Deno.env.get('NOTIFY_DESK_EMAIL') ?? DESK_ADDRESS],
        }),
      });
      if (!ackRes.ok) {
        // Recorded on the row, not just logged. The previous version logged and
        // then wrote `last_error: null` three lines later, so a permanently
        // broken acknowledgement left no trace anywhere a human looks.
        ackError = `acknowledgement ${ackRes.status}: ${await safeText(ackRes)}`;
        console.warn(ackError);
      }
    }

    // ---- 13. Delivered.
    await supabase
      .from('act_intake')
      .update({
        ghl_status: 'delivered',
        ghl_contact_id: contactId,
        inbox_status: inboxStatus,
        delivered_at: new Date().toISOString(),
        last_error: ackError,
      })
      .eq('id', id);
  } catch (err) {
    await markFailed(supabase, id, String(err));
  }
}

function buildInboundBody(ctx: DeliveryContext): string {
  const rows = Object.entries(ctx.fields)
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
    .map(([k, v]) => `<tr><td><strong>${escapeHtml(k)}</strong></td><td>${escapeHtml(String(v))}</td></tr>`)
    .join('');
  return `<p>${escapeHtml(ctx.formType)} submission from ${escapeHtml(ctx.site)}</p><table>${rows}</table>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return '(unreadable body)';
  }
}

async function markFailed(
  supabase: SupabaseClient,
  id: string | undefined,
  error: string,
): Promise<void> {
  console.error('intake delivery failed', error);
  if (!id) return;
  // attempts is incremented by the retry job, which owns the backoff schedule.
  await supabase
    .from('act_intake')
    .update({ ghl_status: 'pending', last_error: error, last_attempt_at: new Date().toISOString() })
    .eq('id', id);
}

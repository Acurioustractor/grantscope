// The desk digest (#160) + the shared "what's due" composition the GHL tasks
// bridge (#161) consumes. One composition, two channels out — desk, digest
// and tasks derive from the same window, so they agree by construction.
//
// Strictly desk-derived: decisions come from the same getOneDesk pool the
// desk renders (its thresholds, verbatim); due work from getDeskObligations
// + the desk pool + the act_people mirror. No digest-only thresholds.
import { getOneDesk, type DeskRecord } from '@/lib/services/act-one-desk';
import { getDeskObligations } from '@/lib/services/act-obligations';
import { getServiceSupabase } from '@/lib/supabase';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://civicgraph.au';

export type DigestDecision = {
  key: string;
  name: string;
  next: string;
  detail: string;
  href: string;
};

export type DueItem = {
  key: string;
  source: 'ask' | 'person' | 'obligation';
  name: string;
  /** The next action in plain words — becomes the GHL task title. */
  action: string;
  /** ISO date when known (obligations/people always; asks when dated). */
  dueDate: string | null;
  dueDays: number;
  href: string;
  /** GHL contact to attach the bridge task to; null → triage fallback. */
  ghlContactId: string | null;
};

export type DeskDigest = {
  orgProfileId: string | null;
  decisions: DigestDecision[];
  due: DueItem[];
};

function isoFromDueDays(dueDays: number | null): string | null {
  if (dueDays == null) return null;
  return new Date(Date.now() + dueDays * 86_400_000).toISOString().slice(0, 10);
}

/** Compose both digest sections from the same services the desk reads. */
export async function composeDeskDigest(slug = 'act'): Promise<DeskDigest> {
  const { active, orgProfileId } = await getOneDesk(slug);
  const deskHref = (r: DeskRecord) => `${SITE}/org/${slug}/desk?rec=${encodeURIComponent(r.id)}`;

  // Section 1 — decisions due (Signals / Grant Rounds / not-yet-Ask funders).
  // The desk pool already applied the thresholds (grants: deadline ≤ 30d or
  // fit ≥ 85; funders: fit ≥ 85; open buyers always) — reuse, never re-derive.
  const decisions: DigestDecision[] = active
    .filter((r) => r.isDecision)
    .map((r) => ({
      key: `decision:${r.id}`,
      name: r.name,
      next: r.next,
      detail: [r.signal, r.amount, r.dueDays != null ? `${r.dueDays}d` : null].filter(Boolean).join(' · '),
      href: deskHref(r),
    }));

  // Section 2 — going due / overdue. Same windows as the tasks bridge:
  //   Asks (worked desk rows): dated next action due or overdue (≤ 0d)
  //   Obligations: overdue or due ≤ 7d
  //   People/watches: review-by ≤ 7d or past
  const due: DueItem[] = [];

  for (const r of active) {
    // Spec lists Asks only — money-owed rows (invoice chasing) stay desk-only.
    if (r.isDecision || r.kind === 'money' || r.dueDays == null || r.dueDays > 0) continue;
    due.push({
      key: `ask:${r.id}`,
      source: 'ask',
      name: r.name,
      action: r.next,
      dueDate: isoFromDueDays(r.dueDays),
      dueDays: r.dueDays,
      href: deskHref(r),
      ghlContactId: null,
    });
  }

  if (orgProfileId) {
    const obligations = await getDeskObligations(orgProfileId).catch(() => []);
    for (const o of obligations) {
      if (o.dueDays == null || o.dueDays > 7) continue;
      due.push({
        key: `obligation:${o.id}`,
        source: 'obligation',
        name: o.title,
        action: o.nextAction ?? `Deliver: ${o.title}`,
        dueDate: o.dueDate,
        dueDays: o.dueDays,
        href: `${SITE}/org/${slug}/goods/we-owe`,
        ghlContactId: null,
      });
    }

    // People mirror (act_people, ADR 0002) — same ≤7d rule as the desk's
    // person rows (#152) and the bridge.
    const db = getServiceSupabase();
    const { data } = await db
      .from('act_people')
      .select('id, name, next_action, review_by, ghl_contact_id')
      .eq('org_profile_id', orgProfileId)
      .not('review_by', 'is', null);
    for (const p of data ?? []) {
      const t = new Date(`${p.review_by}T00:00:00`).getTime();
      if (Number.isNaN(t)) continue;
      const dueDays = Math.ceil((t - Date.now()) / 86_400_000);
      if (dueDays > 7 || !p.next_action) continue;
      due.push({
        key: `person:${p.id}`,
        source: 'person',
        name: p.name as string,
        action: p.next_action as string,
        dueDate: p.review_by as string,
        dueDays,
        href: `${SITE}/org/${slug}/people?rec=${p.id}`,
        ghlContactId: (p.ghl_contact_id as string) ?? null,
      });
    }
  }

  due.sort((a, b) => a.dueDays - b.dueDays);
  return { orgProfileId, decisions, due };
}

// ---------------------------------------------------------------------------
// Delta + send. Daily delta-only; Monday sends regardless (week-start
// heartbeat). Only actual sends are logged — "new since last digest" compares
// against the latest digest_log row.

export type DigestSendResult = {
  sent: boolean;
  reason: string;
  subject?: string;
  newKeys?: string[];
};

function isBrisbaneMonday(now = new Date()): boolean {
  return new Intl.DateTimeFormat('en-AU', { weekday: 'short', timeZone: 'Australia/Brisbane' }).format(now) === 'Mon';
}

function renderEmail(digest: DeskDigest, newKeys: Set<string>, heartbeat: boolean): { subject: string; html: string } {
  const newDecisions = digest.decisions.filter((d) => newKeys.has(d.key));
  const newDue = digest.due.filter((d) => newKeys.has(d.key));
  const subject = heartbeat && newKeys.size === 0
    ? `Desk: nothing new, ${digest.decisions.length} open decision${digest.decisions.length === 1 ? '' : 's'}, ${digest.due.length} due`
    : `Desk: ${newDecisions.length} new decision${newDecisions.length === 1 ? '' : 's'}, ${newDue.length} going due`;

  const line = (name: string, body: string, href: string, meta: string) =>
    `<tr><td style="padding:6px 0;border-bottom:1px solid #eee;font:14px/1.5 -apple-system,sans-serif">` +
    `<a href="${href}" style="color:#1a4731;font-weight:600;text-decoration:none">${name}</a>` +
    ` — ${body}${meta ? ` <span style="color:#888">· ${meta}</span>` : ''}</td></tr>`;

  const section = (title: string, rows: string[]) =>
    rows.length
      ? `<h3 style="font:600 12px/1 -apple-system,sans-serif;text-transform:uppercase;letter-spacing:.08em;color:#666;margin:20px 0 4px">${title}</h3><table width="100%" cellpadding="0" cellspacing="0">${rows.join('')}</table>`
      : '';

  const dueMeta = (d: DueItem) => (d.dueDays < 0 ? `${-d.dueDays}d overdue` : d.dueDays === 0 ? 'today' : `${d.dueDays}d`);
  const html =
    `<div style="max-width:560px;margin:0 auto;padding:8px 16px">` +
    section('New decisions due', newDecisions.map((d) => line(d.name, d.next, d.href, d.detail))) +
    section('Going due / overdue', newDue.map((d) => line(d.name, d.action, d.href, dueMeta(d)))) +
    (heartbeat && newKeys.size === 0
      ? `<p style="font:14px/1.5 -apple-system,sans-serif">Nothing new this week. ${digest.decisions.length} open decisions and ${digest.due.length} due items are sitting on the desk.</p>`
      : '') +
    `<p style="margin-top:24px"><a href="${SITE}/org/act/desk" style="font:600 14px -apple-system,sans-serif;color:#1a4731">Open the desk →</a></p></div>`;
  return { subject, html };
}

async function sendViaResend(subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not set');
  const to = (process.env.DESK_DIGEST_TO || 'ben@benjamink.com.au').split(',').map((s) => s.trim());
  const from = process.env.DESK_DIGEST_FROM || 'CivicGraph Desk <onboarding@resend.dev>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

export async function runDeskDigest(digest: DeskDigest, opts: { dryRun: boolean }): Promise<DigestSendResult> {
  if (!digest.orgProfileId) return { sent: false, reason: 'no org profile' };
  const db = getServiceSupabase();

  const { data: last } = await db
    .from('digest_log')
    .select('row_keys, sent_at')
    .eq('org_profile_id', digest.orgProfileId)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastKeys = new Set<string>((last?.row_keys as string[]) ?? []);

  const allKeys = [...digest.decisions.map((d) => d.key), ...digest.due.map((d) => d.key)];
  const newKeys = new Set(allKeys.filter((k) => !lastKeys.has(k)));
  const heartbeat = isBrisbaneMonday();

  if (newKeys.size === 0 && !heartbeat) {
    return { sent: false, reason: 'no delta (and not Monday)' };
  }

  const { subject, html } = renderEmail(digest, newKeys, heartbeat);
  if (opts.dryRun) return { sent: false, reason: 'dry run', subject, newKeys: [...newKeys] };

  await sendViaResend(subject, html);
  await db.from('digest_log').insert({
    org_profile_id: digest.orgProfileId,
    subject,
    row_keys: allKeys,
    counts: { decisions: digest.decisions.length, due: digest.due.length, new: newKeys.size },
    heartbeat: heartbeat && newKeys.size === 0,
  });
  return { sent: true, reason: heartbeat && newKeys.size === 0 ? 'monday heartbeat' : 'delta', subject, newKeys: [...newKeys] };
}

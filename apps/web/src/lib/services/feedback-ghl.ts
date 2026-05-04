// Feedback GHL push: shared between the form server-action and any future
// admin backfill endpoint. Mirrors the partnership-ghl service.

const GHL_API_URL = 'https://services.leadconnectorhq.com';

// Map machine value-signals to GHL tags so smart-lists can filter
const VALUE_SIGNAL_TAGS: Record<string, string> = {
  would_pay: 'GS-Value-WouldPay',
  would_recommend: 'GS-Value-WouldRecommend',
  would_change_decision: 'GS-Value-WouldChangeDecision',
  want_for_my_org: 'GS-Value-WantForMyOrg',
  want_for_my_sector: 'GS-Value-WantForMySector',
  interesting_not_actionable: 'GS-Value-InterestingNotActionable',
  not_sure_what_for: 'GS-Value-Unclear',
};

const USE_CASE_TAGS: Record<string, string> = {
  board_strategy: 'GS-UseCase-Board',
  foundation_diligence: 'GS-UseCase-Foundation',
  journalist: 'GS-UseCase-Journalist',
  researcher: 'GS-UseCase-Researcher',
  peak_body: 'GS-UseCase-Peak',
  govt_oversight: 'GS-UseCase-GovOversight',
  advocacy: 'GS-UseCase-Advocacy',
  investigation: 'GS-UseCase-Investigation',
  curiosity: 'GS-UseCase-Curiosity',
};

export type FeedbackPushInput = {
  feedbackId: string;
  reportSubject: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactOrg: string | null;
  contactRole: string | null;
  followUpOk: boolean;
  valueSignals: string[];
  valueScore: number | null;
  topicsWanted: string[];
  topicsWantedOther: string | null;
  useCases: string[];
  useCasesOther: string | null;
  dataInteractions: string[];
  willingnessToPay: string | null;
  questionsToAnswer: string | null;
  generalFeedback: string | null;
};

export type FeedbackPushResult =
  | { ok: true; contactId: string }
  | { ok: false; reason: 'no_credentials' | 'no_contact' | 'upsert_failed' | 'no_contact_id' | 'exception'; status?: number; detail?: string };

/**
 * Push feedback to GoHighLevel:
 * - Only if respondent provided email (contact-less anon feedback skipped)
 * - Upserts contact with rich tag stack (value signals, use cases, topics,
 *   pay band, source artefact, follow-up flag)
 * - Posts inbound conversation message with the structured feedback
 */
export async function pushFeedbackToGHL(opts: FeedbackPushInput): Promise<FeedbackPushResult> {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId) {
    console.warn('[feedback-ghl] GHL_API_KEY or GHL_LOCATION_ID not set; skipping');
    return { ok: false, reason: 'no_credentials' };
  }

  // No email = anonymous feedback. Persist in DB only — nothing to push.
  if (!opts.contactEmail) {
    return { ok: false, reason: 'no_contact' };
  }

  try {
    const [firstName, ...rest] = (opts.contactName || '').split(' ');
    const lastName = rest.join(' ') || undefined;

    const tags = [
      'CivicGraph',
      'GS-Feedback',
      ...opts.valueSignals.map(v => VALUE_SIGNAL_TAGS[v]).filter(Boolean),
      opts.valueScore ? `GS-Value-Score-${opts.valueScore}` : null,
      ...opts.useCases.map(u => USE_CASE_TAGS[u]).filter(Boolean),
      ...opts.topicsWanted.slice(0, 8).map(t => `GS-Topic-${t}`),
      ...opts.dataInteractions.map(d => `GS-DataInteraction-${d}`),
      opts.willingnessToPay ? `GS-Pay-${opts.willingnessToPay}` : null,
      opts.reportSubject ? `GS-Source-${opts.reportSubject}` : null,
      opts.followUpOk ? 'GS-OptInNextReport' : null,
    ].filter((t): t is string => !!t);

    const upsertRes = await fetch(`${GHL_API_URL}/contacts/upsert`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Version: '2021-07-28',
      },
      body: JSON.stringify({
        locationId,
        email: opts.contactEmail,
        firstName: firstName || undefined,
        lastName,
        companyName: opts.contactOrg || undefined,
        tags,
        source: opts.reportSubject ? `CivicGraph Feedback (${opts.reportSubject})` : 'CivicGraph Feedback',
      }),
    });

    if (!upsertRes.ok) {
      const detail = await upsertRes.text().catch(() => '');
      console.error('[feedback-ghl] Contact upsert failed:', upsertRes.status, detail);
      return { ok: false, reason: 'upsert_failed', status: upsertRes.status, detail };
    }

    const upsertData = await upsertRes.json();
    const contactId: string | undefined = upsertData?.contact?.id;
    if (!contactId) return { ok: false, reason: 'no_contact_id' };

    // Inbound message → GHL Messages tab
    const lines: string[] = [
      `[CivicGraph Feedback · ${opts.reportSubject || 'general'}]`,
      '',
      `From: ${opts.contactName || 'Unknown'} <${opts.contactEmail}>`,
    ];
    if (opts.contactOrg) lines.push(`Org: ${opts.contactOrg}${opts.contactRole ? ` (${opts.contactRole})` : ''}`);
    if (opts.valueScore) lines.push(`Value rating: ${opts.valueScore}/5`);
    if (opts.valueSignals.length) lines.push(`Value signals: ${opts.valueSignals.join(', ')}`);
    if (opts.useCases.length) lines.push(`Use cases: ${opts.useCases.join(', ')}`);
    if (opts.useCasesOther) lines.push(`Use case (other): ${opts.useCasesOther}`);
    if (opts.dataInteractions.length) lines.push(`Data interactions: ${opts.dataInteractions.join(', ')}`);
    if (opts.topicsWanted.length) lines.push(`Topics wanted: ${opts.topicsWanted.join(', ')}`);
    if (opts.topicsWantedOther) lines.push(`Topics (other): ${opts.topicsWantedOther}`);
    if (opts.willingnessToPay) lines.push(`Willingness to pay: ${opts.willingnessToPay}`);
    if (opts.followUpOk) lines.push('Opt-in: send next report');
    if (opts.questionsToAnswer) lines.push('', '— Questions they want answered:', opts.questionsToAnswer);
    if (opts.generalFeedback) lines.push('', '— General feedback:', opts.generalFeedback);
    lines.push('', '---', `Ref: ${opts.feedbackId.slice(0, 8)}`);

    // Attach as a contact NOTE (Custom-type inbound messages require a
    // conversationProviderId we don't have configured). Notes also fit the
    // semantic better — structured form submissions, not chat messages.
    const noteRes = await fetch(`${GHL_API_URL}/contacts/${contactId}/notes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Version: '2021-07-28',
      },
      body: JSON.stringify({ body: lines.join('\n') }),
    });
    if (!noteRes.ok) {
      console.error('[feedback-ghl] Note attach failed:', noteRes.status, await noteRes.text().catch(() => ''));
    }
    return { ok: true, contactId };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[feedback-ghl] Error:', detail);
    return { ok: false, reason: 'exception', detail };
  }
}

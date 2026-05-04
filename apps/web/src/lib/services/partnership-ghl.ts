// Partnership-inquiry GHL push: shared between the form server-action and
// the admin backfill endpoint. Importable from any server context.

const GHL_API_URL = 'https://services.leadconnectorhq.com';

// Map machine-readable partnership types to human GHL tags
export const PARTNERSHIP_TYPE_TAGS: Record<string, string> = {
  foundation_cofund: 'GS-Partner-FoundationCoFund',
  acco_bespoke: 'GS-Partner-ACCO',
  sector_peak: 'GS-Partner-SectorPeak',
  journalist: 'GS-Partner-Journalist',
  researcher: 'GS-Partner-Researcher',
  gov_oversight: 'GS-Partner-GovOversight',
  philanthropic_advisor: 'GS-Partner-PhilanthropicAdvisor',
  board_director: 'GS-Partner-BoardDirector',
  other: 'GS-Partner-Other',
};

export type PartnershipPushInput = {
  contactName: string;
  contactEmail: string;
  contactOrg: string | null;
  contactPhone: string | null;
  contactRole: string | null;
  partnershipTypes: string[];
  partnershipOther: string | null;
  message: string;
  budgetBand: string | null;
  timeline: string | null;
  sourceArtefact: string | null;
  inquiryId: string;
};

export type PartnershipPushResult =
  | { ok: true; contactId: string }
  | { ok: false; reason: 'no_credentials' | 'upsert_failed' | 'no_contact_id' | 'exception'; status?: number; detail?: string };

/**
 * Push partnership inquiry to GoHighLevel.
 * - Upserts contact with tags
 * - Posts inbound conversation message so it shows in GHL Messages tab
 * - Returns structured result so callers can decide whether to mark synced /
 *   surface errors / retry. Never throws.
 */
export async function pushPartnershipToGHL(opts: PartnershipPushInput): Promise<PartnershipPushResult> {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId) {
    console.warn('[partnership-ghl] GHL_API_KEY or GHL_LOCATION_ID not set; skipping GHL push');
    return { ok: false, reason: 'no_credentials' };
  }

  try {
    const [firstName, ...rest] = opts.contactName.split(' ');
    const lastName = rest.join(' ') || undefined;

    const tags = [
      'CivicGraph',
      'GS-Partnership',
      ...opts.partnershipTypes.map(t => PARTNERSHIP_TYPE_TAGS[t]).filter(Boolean),
      opts.sourceArtefact ? `GS-Source-${opts.sourceArtefact}` : null,
      opts.budgetBand ? `GS-Budget-${opts.budgetBand}` : null,
      opts.timeline ? `GS-Timeline-${opts.timeline}` : null,
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
        firstName,
        lastName,
        companyName: opts.contactOrg || undefined,
        phone: opts.contactPhone || undefined,
        tags,
        source: opts.sourceArtefact ? `CivicGraph Share Partner Form (${opts.sourceArtefact})` : 'CivicGraph Share Partner Form',
      }),
    });

    if (!upsertRes.ok) {
      const detail = await upsertRes.text().catch(() => '');
      console.error('[partnership-ghl] Contact upsert failed:', upsertRes.status, detail);
      return { ok: false, reason: 'upsert_failed', status: upsertRes.status, detail };
    }

    const upsertData = await upsertRes.json();
    const contactId: string | undefined = upsertData?.contact?.id;
    if (!contactId) {
      console.error('[partnership-ghl] No contactId returned from upsert');
      return { ok: false, reason: 'no_contact_id' };
    }

    // Attach the structured inquiry as a CONTACT NOTE (visible on the
    // contact profile under "Notes"). We previously tried Custom-type
    // inbound messages but those silently 400'd ("conversationProviderId
    // is required"). Notes are the right semantic fit for "structured form
    // submission" anyway — they don't pollute the conversation thread.
    const lines: string[] = [
      `[CivicGraph Partnership Inquiry · ${opts.sourceArtefact || 'general'}]`,
      '',
      `From: ${opts.contactName} <${opts.contactEmail}>`,
    ];
    if (opts.contactOrg) lines.push(`Org: ${opts.contactOrg}${opts.contactRole ? ` (${opts.contactRole})` : ''}`);
    if (opts.contactPhone) lines.push(`Phone: ${opts.contactPhone}`);
    if (opts.partnershipTypes.length) lines.push(`Types: ${opts.partnershipTypes.join(', ')}`);
    if (opts.partnershipOther) lines.push(`Other: ${opts.partnershipOther}`);
    if (opts.budgetBand) lines.push(`Budget: ${opts.budgetBand}`);
    if (opts.timeline) lines.push(`Timeline: ${opts.timeline}`);
    lines.push('', '---', '', opts.message, '', '---', `Ref: ${opts.inquiryId.slice(0, 8)}`);

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
      // Contact upsert succeeded; only the note attachment failed.
      // Surface to logs but still return ok=true so we don't reprocess.
      console.error('[partnership-ghl] Note attach failed:', noteRes.status, await noteRes.text().catch(() => ''));
    }
    return { ok: true, contactId };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[partnership-ghl] Error:', detail);
    return { ok: false, reason: 'exception', detail };
  }
}

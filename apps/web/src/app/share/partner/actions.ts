'use server';

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GHL_API_URL = 'https://services.leadconnectorhq.com';

export type PartnershipResult = { ok: boolean; id?: string; error?: string };

// Map machine-readable partnership types to human GHL tags
const PARTNERSHIP_TYPE_TAGS: Record<string, string> = {
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

/**
 * Push partnership inquiry to GoHighLevel.
 * - Upserts contact with tags
 * - Creates inbound conversation message so it shows in GHL Messages tab
 * - Fire-and-forget: never throws back to the form submission
 */
async function pushToGHL(opts: {
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
}): Promise<{ contactId: string } | null> {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId) {
    console.warn('[partnership-ghl] GHL_API_KEY or GHL_LOCATION_ID not set; skipping GHL push');
    return null;
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
      console.error('[partnership-ghl] Contact upsert failed:', upsertRes.status, await upsertRes.text().catch(() => ''));
      return null;
    }

    const upsertData = await upsertRes.json();
    const contactId: string | undefined = upsertData?.contact?.id;
    if (!contactId) {
      console.error('[partnership-ghl] No contactId returned from upsert');
      return null;
    }

    // Compose a structured inbound message that lands in GHL Messages tab
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

    await fetch(`${GHL_API_URL}/conversations/messages/inbound`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Version: '2021-07-28',
      },
      body: JSON.stringify({
        type: 'Custom',
        contactId,
        message: lines.join('\n'),
      }),
    });
    return { contactId };
  } catch (err) {
    console.error('[partnership-ghl] Error:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function submitPartnership(formData: FormData): Promise<PartnershipResult> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return { ok: false, error: 'Server config error' };

  const arr = (key: string) => formData.getAll(key).map(v => String(v).trim()).filter(Boolean);
  const str = (key: string) => {
    const v = formData.get(key);
    if (v == null) return null;
    const s = String(v).trim();
    return s.length === 0 ? null : s;
  };

  const message = str('message');
  const contactName = str('contact_name');
  const contactEmail = str('contact_email');

  if (!message) return { ok: false, error: 'Tell us about the partnership in a sentence or two.' };
  if (!contactName) return { ok: false, error: 'Your name is required so we can reply.' };
  if (!contactEmail) return { ok: false, error: 'Email is required so we can reply.' };
  // Basic email shape check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) return { ok: false, error: 'That email address looks off — double-check?' };

  const partnershipTypes = arr('partnership_types');

  const db = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data, error } = await db.from('partnership_inquiries').insert({
    source_path: str('source_path'),
    source_referrer: str('source_referrer'),
    source_artefact: str('source_artefact'),
    partnership_types: partnershipTypes.length ? partnershipTypes : null,
    partnership_other: str('partnership_other'),
    message,
    budget_band: str('budget_band'),
    timeline: str('timeline'),
    contact_name: contactName,
    contact_email: contactEmail,
    contact_org: str('contact_org'),
    contact_role: str('contact_role'),
    contact_phone: str('contact_phone'),
    user_agent: str('user_agent'),
  }).select('id').single();

  if (error) return { ok: false, error: error.message };

  const inquiryId = data?.id;

  // Fire-and-forget GHL push: do not block the form on this. If GHL credentials
  // are missing or the call fails, the inquiry is still safely persisted in
  // partnership_inquiries and can be backfilled later.
  if (inquiryId) {
    pushToGHL({
      contactName,
      contactEmail,
      contactOrg: str('contact_org'),
      contactPhone: str('contact_phone'),
      contactRole: str('contact_role'),
      partnershipTypes,
      partnershipOther: str('partnership_other'),
      message,
      budgetBand: str('budget_band'),
      timeline: str('timeline'),
      sourceArtefact: str('source_artefact'),
      inquiryId,
    })
      .then(result => {
        if (!result) return;
        // Mark synced + record GHL contact id for cross-system traceability
        return db.from('partnership_inquiries').update({
          ghl_synced_at: new Date().toISOString(),
          ghl_contact_id: result.contactId,
        }).eq('id', inquiryId);
      })
      .catch(err => console.error('[partnership-ghl] post-insert push failed:', err));
  }

  return { ok: true, id: inquiryId };
}

'use server';

import { createClient } from '@supabase/supabase-js';
import { pushPartnershipToGHL } from '@/lib/services/partnership-ghl';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type PartnershipResult = { ok: boolean; id?: string; error?: string };

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

  // Awaited (not fire-and-forget): in serverless runtimes, dropped promises
  // get terminated when the response is sent. Awaiting adds ~300ms but
  // guarantees ghl_synced_at gets stamped reliably. If GHL is down the row
  // still persists with ghl_synced_at = NULL — backfillable via the admin
  // route /api/partnership-inquiries/backfill-ghl.
  if (inquiryId) {
    const result = await pushPartnershipToGHL({
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
    });
    if (result.ok) {
      await db.from('partnership_inquiries').update({
        ghl_synced_at: new Date().toISOString(),
        ghl_contact_id: result.contactId,
      }).eq('id', inquiryId);
    }
  }

  return { ok: true, id: inquiryId };
}

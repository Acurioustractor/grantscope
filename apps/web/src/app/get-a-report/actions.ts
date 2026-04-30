'use server';

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type SubmissionResult = {
  ok: boolean;
  id?: string;
  error?: string;
};

export async function submitReportRequest(formData: FormData): Promise<SubmissionResult> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return { ok: false, error: 'Server config error' };

  const email = String(formData.get('contact_email') || '').trim();
  if (!email || !email.includes('@')) return { ok: false, error: 'Email is required' };

  const target_subject = String(formData.get('target_subject') || '').trim();
  if (!target_subject) return { ok: false, error: 'Tell us what you want investigated' };

  const db = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data, error } = await db.from('report_submissions').insert({
    contact_name: String(formData.get('contact_name') || '').trim() || null,
    contact_email: email,
    contact_org: String(formData.get('contact_org') || '').trim() || null,
    contact_role: String(formData.get('contact_role') || '').trim() || null,
    target_subject,
    target_type: String(formData.get('target_type') || '').trim() || null,
    research_questions: String(formData.get('research_questions') || '').trim() || null,
    decision_driving: String(formData.get('decision_driving') || '').trim() || null,
    timeline_pref: String(formData.get('timeline_pref') || '').trim() || null,
    budget_signal: String(formData.get('budget_signal') || '').trim() || null,
    free_5_apply: formData.get('free_5_apply') === 'on',
    permission_to_publish: formData.get('permission_to_publish') === 'on',
    source: String(formData.get('source') || 'direct').trim(),
    raw_referrer: String(formData.get('raw_referrer') || '').trim() || null,
  }).select('id').single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

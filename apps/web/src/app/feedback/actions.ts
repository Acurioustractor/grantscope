'use server';

import { createClient } from '@supabase/supabase-js';
import { pushFeedbackToGHL } from '@/lib/services/feedback-ghl';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type FeedbackResult = { ok: boolean; id?: string; error?: string };

export async function submitFeedback(formData: FormData): Promise<FeedbackResult> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return { ok: false, error: 'Server config error' };

  const arr = (key: string) => formData.getAll(key).map(v => String(v).trim()).filter(Boolean);
  const str = (key: string) => {
    const v = formData.get(key);
    if (v == null) return null;
    const s = String(v).trim();
    return s.length === 0 ? null : s;
  };
  const intOrNull = (key: string) => {
    const v = formData.get(key);
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const valueSignals = arr('value_signals');
  const topicsWanted = arr('topics_wanted');
  const useCases = arr('use_cases');
  const dataInteractions = arr('data_interactions');
  const generalFeedback = str('general_feedback');
  const questionsToAnswer = str('questions_to_answer');
  const valueScore = intOrNull('value_score');

  if (
    valueSignals.length === 0 &&
    topicsWanted.length === 0 &&
    useCases.length === 0 &&
    dataInteractions.length === 0 &&
    !generalFeedback &&
    !questionsToAnswer &&
    valueScore === null
  ) {
    return { ok: false, error: 'Tick at least one box or leave a comment.' };
  }

  const reportSubject = str('report_subject');
  const contactName = str('contact_name');
  const contactEmail = str('contact_email');
  const contactOrg = str('contact_org');
  const contactRole = str('contact_role');
  const willingnessToPay = str('willingness_to_pay');
  const followUpOk = formData.get('follow_up_ok') === 'on';
  const topicsWantedOther = str('topics_wanted_other');
  const useCasesOther = str('use_cases_other');

  const db = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data, error } = await db.from('report_feedback').insert({
    source_path: str('source_path'),
    source_referrer: str('source_referrer'),
    report_subject: reportSubject,
    value_signals: valueSignals.length ? valueSignals : null,
    value_score: valueScore,
    topics_wanted: topicsWanted.length ? topicsWanted : null,
    topics_wanted_other: topicsWantedOther,
    use_cases: useCases.length ? useCases : null,
    use_cases_other: useCasesOther,
    data_interactions: dataInteractions.length ? dataInteractions : null,
    questions_to_answer: questionsToAnswer,
    general_feedback: generalFeedback,
    willingness_to_pay: willingnessToPay,
    contact_name: contactName,
    contact_email: contactEmail,
    contact_org: contactOrg,
    contact_role: contactRole,
    follow_up_ok: followUpOk,
    user_agent: str('user_agent'),
  }).select('id').single();

  if (error) return { ok: false, error: error.message };

  const feedbackId = data?.id;

  // Push to GHL only if email provided. Fully anonymous feedback stays in
  // Supabase only. Awaited so the sync stamp lands reliably; ~300ms cost.
  if (feedbackId && contactEmail) {
    const result = await pushFeedbackToGHL({
      feedbackId,
      reportSubject,
      contactName,
      contactEmail,
      contactOrg,
      contactRole,
      followUpOk,
      valueSignals,
      valueScore,
      topicsWanted,
      topicsWantedOther,
      useCases,
      useCasesOther,
      dataInteractions,
      willingnessToPay,
      questionsToAnswer,
      generalFeedback,
    });
    if (result.ok) {
      await db.from('report_feedback').update({
        ghl_synced_at: new Date().toISOString(),
        ghl_contact_id: result.contactId,
      }).eq('id', feedbackId);
    }
  }

  return { ok: true, id: feedbackId };
}

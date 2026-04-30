'use server';

import { createClient } from '@supabase/supabase-js';

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
  const generalFeedback = str('general_feedback');
  const questionsToAnswer = str('questions_to_answer');
  const valueScore = intOrNull('value_score');

  // Require at least one signal — pure-empty submissions add no value
  if (valueSignals.length === 0 && topicsWanted.length === 0 && useCases.length === 0 && !generalFeedback && !questionsToAnswer && valueScore === null) {
    return { ok: false, error: 'Tick at least one box or leave a comment.' };
  }

  const db = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data, error } = await db.from('report_feedback').insert({
    source_path: str('source_path'),
    source_referrer: str('source_referrer'),
    report_subject: str('report_subject'),
    value_signals: valueSignals.length ? valueSignals : null,
    value_score: valueScore,
    topics_wanted: topicsWanted.length ? topicsWanted : null,
    topics_wanted_other: str('topics_wanted_other'),
    use_cases: useCases.length ? useCases : null,
    use_cases_other: str('use_cases_other'),
    questions_to_answer: questionsToAnswer,
    general_feedback: generalFeedback,
    willingness_to_pay: str('willingness_to_pay'),
    contact_name: str('contact_name'),
    contact_email: str('contact_email'),
    contact_org: str('contact_org'),
    contact_role: str('contact_role'),
    follow_up_ok: formData.get('follow_up_ok') === 'on',
    user_agent: str('user_agent'),
  }).select('id').single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

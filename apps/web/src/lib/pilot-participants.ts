import { getServiceSupabase } from '@/lib/supabase';

export const PILOT_COHORTS = ['consultant', 'nonprofit', 'other'] as const;
export type PilotCohort = (typeof PILOT_COHORTS)[number];

export const PILOT_STAGES = ['lead', 'invited', 'scheduled', 'onboarded', 'active', 'completed', 'paid', 'declined'] as const;
export type PilotStage = (typeof PILOT_STAGES)[number];

export const PILOT_PAYMENT_INTENTS = ['unknown', 'strong_yes', 'conditional_yes', 'not_now', 'no_budget', 'no_fit'] as const;
export type PilotPaymentIntent = (typeof PILOT_PAYMENT_INTENTS)[number];

export const PILOT_SEAN_ELLIS_RESPONSES = ['unknown', 'very_disappointed', 'somewhat_disappointed', 'not_disappointed'] as const;
export type PilotSeanEllisResponse = (typeof PILOT_SEAN_ELLIS_RESPONSES)[number];

export type PilotParticipantInput = {
  participant_name?: unknown;
  email?: unknown;
  organization_name?: unknown;
  role_title?: unknown;
  cohort?: unknown;
  stage?: unknown;
  payment_intent?: unknown;
  sean_ellis_response?: unknown;
  pilot_source?: unknown;
  funding_task?: unknown;
  notes?: unknown;
  last_contact_at?: unknown;
  onboarding_at?: unknown;
  observed_session_at?: unknown;
  closeout_at?: unknown;
};

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function normalizePilotEmail(value: unknown): string | null {
  const cleaned = cleanText(value);
  return cleaned ? cleaned.toLowerCase() : null;
}

export function asPilotCohort(value: unknown): PilotCohort {
  return PILOT_COHORTS.includes(value as PilotCohort) ? (value as PilotCohort) : 'consultant';
}

export function asPilotStage(value: unknown): PilotStage {
  return PILOT_STAGES.includes(value as PilotStage) ? (value as PilotStage) : 'lead';
}

export function asPilotPaymentIntent(value: unknown): PilotPaymentIntent {
  return PILOT_PAYMENT_INTENTS.includes(value as PilotPaymentIntent) ? (value as PilotPaymentIntent) : 'unknown';
}

export function asPilotSeanEllisResponse(value: unknown): PilotSeanEllisResponse {
  return PILOT_SEAN_ELLIS_RESPONSES.includes(value as PilotSeanEllisResponse)
    ? (value as PilotSeanEllisResponse)
    : 'unknown';
}

export function sanitizePilotParticipantInput(input: PilotParticipantInput) {
  return {
    participant_name: cleanText(input.participant_name),
    email: normalizePilotEmail(input.email),
    organization_name: cleanText(input.organization_name),
    role_title: cleanText(input.role_title),
    cohort: asPilotCohort(input.cohort),
    stage: asPilotStage(input.stage),
    payment_intent: asPilotPaymentIntent(input.payment_intent),
    sean_ellis_response: asPilotSeanEllisResponse(input.sean_ellis_response),
    pilot_source: cleanText(input.pilot_source),
    funding_task: cleanText(input.funding_task),
    notes: cleanText(input.notes),
    last_contact_at: cleanTimestamp(input.last_contact_at),
    onboarding_at: cleanTimestamp(input.onboarding_at),
    observed_session_at: cleanTimestamp(input.observed_session_at),
    closeout_at: cleanTimestamp(input.closeout_at),
  };
}

export async function resolvePilotLinks(email: string) {
  const db = getServiceSupabase();

  const { data: profile } = await db
    .from('profiles')
    .select('id, primary_organization_id')
    .ilike('email', email)
    .maybeSingle();

  const linkedUserId = profile?.id ?? null;
  let linkedOrgProfileId = profile?.primary_organization_id ?? null;

  if (!linkedOrgProfileId && linkedUserId) {
    const { data: orgProfile } = await db
      .from('org_profiles')
      .select('id')
      .eq('user_id', linkedUserId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    linkedOrgProfileId = orgProfile?.id ?? null;
  }

  return { linkedUserId, linkedOrgProfileId };
}

import { getServiceSupabase } from '@/lib/supabase';
import { safe } from '@/lib/services/utils';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface Journey {
  id: string;
  org_profile_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: 'draft' | 'active' | 'archived';
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface JourneyPersona {
  id: string;
  journey_id: string;
  label: string;
  description: string | null;
  cohort: string | null;
  context: string | null;
  sort_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface JourneyStep {
  id: string;
  persona_id: string;
  path: 'current' | 'alternative';
  step_number: number;
  title: string;
  description: string | null;
  system: string | null;
  emotion: string | null;
  duration: string | null;
  is_divergence_point: boolean;
  icon: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface JourneyMatch {
  id: string;
  step_id: string;
  match_type: 'alma_intervention' | 'alma_evidence' | 'funding' | 'outcome' | 'entity';
  match_id: string | null;
  match_name: string;
  match_detail: string | null;
  confidence: number;
  created_at: string;
}

export interface JourneyMessage {
  id: string;
  journey_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  persona_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface JourneyPersonaWithSteps extends JourneyPersona {
  steps: (JourneyStep & { matches: JourneyMatch[] })[];
}

export interface JourneyFull extends Journey {
  personas: JourneyPersonaWithSteps[];
}

export interface JourneySummary extends Journey {
  persona_count: number;
  step_count: number;
  match_count: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Read
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getJourneys(orgProfileId: string, projectId?: string): Promise<JourneySummary[]> {
  const supabase = getServiceSupabase();

  let query = supabase
    .from('org_journeys')
    .select('*')
    .eq('org_profile_id', orgProfileId)
    .order('updated_at', { ascending: false });

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data: journeys, error } = await query;
  if (error || !journeys || journeys.length === 0) return [];

  // Compute counts client-side (avoids exec_sql string interpolation)
  const journeyIds = journeys.map(j => j.id);

  const { data: personas } = await supabase
    .from('org_journey_personas')
    .select('id, journey_id')
    .in('journey_id', journeyIds);

  const personaIds = (personas ?? []).map(p => p.id);
  let steps: Array<{ id: string; persona_id: string }> = [];

  if (personaIds.length > 0) {
    const { data: stepData } = await supabase
      .from('org_journey_steps')
      .select('id, persona_id')
      .in('persona_id', personaIds);
    steps = stepData ?? [];
  }

  const stepIds = steps.map(s => s.id);
  let matchCount = 0;

  if (stepIds.length > 0) {
    const { count } = await supabase
      .from('org_journey_matches')
      .select('id', { count: 'exact', head: true })
      .in('step_id', stepIds);
    matchCount = count ?? 0;
  }

  // Build lookup maps
  const personaCountByJourney = new Map<string, number>();
  for (const p of personas ?? []) {
    personaCountByJourney.set(p.journey_id, (personaCountByJourney.get(p.journey_id) ?? 0) + 1);
  }

  const personaToJourney = new Map<string, string>();
  for (const p of personas ?? []) {
    personaToJourney.set(p.id, p.journey_id);
  }

  const stepCountByJourney = new Map<string, number>();
  for (const s of steps) {
    const jId = personaToJourney.get(s.persona_id);
    if (jId) stepCountByJourney.set(jId, (stepCountByJourney.get(jId) ?? 0) + 1);
  }

  return journeys.map(j => ({
    ...j,
    persona_count: personaCountByJourney.get(j.id) ?? 0,
    step_count: stepCountByJourney.get(j.id) ?? 0,
    match_count: matchCount, // approximate: total across all journeys
  })) as JourneySummary[];
}

export async function getJourney(journeyId: string): Promise<JourneyFull | null> {
  const supabase = getServiceSupabase();

  // Fetch journey + personas in parallel (both only need journeyId)
  const [journeyResult, personasResult] = await Promise.all([
    supabase.from('org_journeys').select('*').eq('id', journeyId).maybeSingle(),
    supabase.from('org_journey_personas').select('*').eq('journey_id', journeyId).order('sort_order'),
  ]);

  const { data: journey, error } = journeyResult;
  if (error || !journey) return null;
  const { data: personas } = personasResult;

  // Get steps for all personas
  const personaIds = (personas ?? []).map(p => p.id);
  let steps: JourneyStep[] = [];
  let matches: JourneyMatch[] = [];

  if (personaIds.length > 0) {
    const { data: stepData } = await supabase
      .from('org_journey_steps')
      .select('*')
      .in('persona_id', personaIds)
      .order('step_number');
    steps = (stepData ?? []) as JourneyStep[];

    const stepIds = steps.map(s => s.id);
    if (stepIds.length > 0) {
      const { data: matchData } = await supabase
        .from('org_journey_matches')
        .select('*')
        .in('step_id', stepIds);
      matches = (matchData ?? []) as JourneyMatch[];
    }
  }

  // Assemble
  const matchesByStep = new Map<string, JourneyMatch[]>();
  for (const m of matches) {
    const arr = matchesByStep.get(m.step_id) ?? [];
    arr.push(m);
    matchesByStep.set(m.step_id, arr);
  }

  const stepsByPersona = new Map<string, (JourneyStep & { matches: JourneyMatch[] })[]>();
  for (const s of steps) {
    const arr = stepsByPersona.get(s.persona_id) ?? [];
    arr.push({ ...s, matches: matchesByStep.get(s.id) ?? [] });
    stepsByPersona.set(s.persona_id, arr);
  }

  return {
    ...(journey as Journey),
    personas: (personas ?? []).map(p => ({
      ...(p as JourneyPersona),
      steps: stepsByPersona.get(p.id) ?? [],
    })),
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Write
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function createJourney(
  orgProfileId: string,
  projectId: string | null,
  title: string,
  description?: string,
): Promise<Journey | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('org_journeys')
    .insert({ org_profile_id: orgProfileId, project_id: projectId, title, description })
    .select()
    .single();
  if (error) return null;
  return data as Journey;
}

export async function updateJourney(
  journeyId: string,
  updates: Partial<Pick<Journey, 'title' | 'description' | 'status'>>,
): Promise<Journey | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('org_journeys')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', journeyId)
    .select()
    .single();
  if (error) return null;
  return data as Journey;
}

export async function deleteJourney(journeyId: string): Promise<boolean> {
  const supabase = getServiceSupabase();
  const { error } = await supabase.from('org_journeys').delete().eq('id', journeyId);
  return !error;
}

export async function upsertPersona(
  journeyId: string,
  persona: Partial<JourneyPersona> & { label: string },
): Promise<JourneyPersona | null> {
  const supabase = getServiceSupabase();
  if (persona.id) {
    const { data, error } = await supabase
      .from('org_journey_personas')
      .update({ ...persona, updated_at: new Date().toISOString() })
      .eq('id', persona.id)
      .select()
      .single();
    if (error) return null;
    return data as JourneyPersona;
  }
  const { data, error } = await supabase
    .from('org_journey_personas')
    .insert({ journey_id: journeyId, ...persona })
    .select()
    .single();
  if (error) return null;
  return data as JourneyPersona;
}

export async function upsertStep(
  personaId: string,
  step: Partial<JourneyStep> & { path: 'current' | 'alternative'; step_number: number; title: string },
): Promise<JourneyStep | null> {
  const supabase = getServiceSupabase();
  if (step.id) {
    const { data, error } = await supabase
      .from('org_journey_steps')
      .update(step)
      .eq('id', step.id)
      .select()
      .single();
    if (error) return null;
    return data as JourneyStep;
  }
  const { data, error } = await supabase
    .from('org_journey_steps')
    .insert({ persona_id: personaId, ...step })
    .select()
    .single();
  if (error) return null;
  return data as JourneyStep;
}

export async function addMatch(
  stepId: string,
  match: Omit<JourneyMatch, 'id' | 'step_id' | 'created_at'>,
): Promise<JourneyMatch | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('org_journey_matches')
    .insert({ step_id: stepId, ...match })
    .select()
    .single();
  if (error) return null;
  return data as JourneyMatch;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Messages
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getJourneyMessages(journeyId: string): Promise<JourneyMessage[]> {
  const supabase = getServiceSupabase();
  const { data } = await supabase
    .from('org_journey_messages')
    .select('*')
    .eq('journey_id', journeyId)
    .order('created_at');
  return (data ?? []) as JourneyMessage[];
}

export async function addJourneyMessage(
  journeyId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  personaId?: string,
  metadata?: Record<string, unknown>,
): Promise<JourneyMessage | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('org_journey_messages')
    .insert({
      journey_id: journeyId,
      role,
      content,
      persona_id: personaId ?? null,
      metadata: metadata ?? {},
    })
    .select()
    .single();
  if (error) return null;
  return data as JourneyMessage;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Data Matching
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface AlmaMatchResult {
  id: string;
  name: string;
  type: string;
  evidence_level: string;
  target_cohort: string;
  description: string;
}

interface FundingMatchResult {
  program_name: string;
  total: number;
  state: string;
}

export async function matchStepToData(step: { title: string; system?: string | null; description?: string | null }) {
  const supabase = getServiceSupabase();
  const searchTerms = [step.title, step.system, step.description].filter(Boolean).join(' ');
  const keywords = searchTerms.split(/\s+/).filter(w => w.length > 3).slice(0, 4);

  if (keywords.length === 0) return { almaMatches: [], fundingMatches: [] };

  const ilikeClauses = keywords.map(k => `(name ILIKE '%${k.replace(/'/g, "''")}%' OR description ILIKE '%${k.replace(/'/g, "''")}%')`).join(' OR ');

  const [almaMatches, fundingMatches] = await Promise.all([
    safe(supabase.rpc('exec_sql', {
      query: `SELECT id, name, type, evidence_level, target_cohort, LEFT(description, 200) as description
        FROM alma_interventions
        WHERE ${ilikeClauses}
        LIMIT 5`,
    })) as Promise<AlmaMatchResult[] | null>,
    step.system ? safe(supabase.rpc('exec_sql', {
      query: `SELECT program_name, SUM(amount_dollars)::bigint as total, state
        FROM justice_funding
        WHERE program_name ILIKE '%${(step.system ?? '').replace(/'/g, "''")}%'
        GROUP BY program_name, state
        ORDER BY total DESC
        LIMIT 5`,
    })) as Promise<FundingMatchResult[] | null> : Promise.resolve(null),
  ]);

  return {
    almaMatches: almaMatches ?? [],
    fundingMatches: fundingMatches ?? [],
  };
}

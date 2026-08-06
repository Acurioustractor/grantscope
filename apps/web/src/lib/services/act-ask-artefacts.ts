// Ask artefact links — the Notion-page URL annotation on a GHL Ask
// (wayfinder #162, docs/specs/grants-notion-handoff-spec.md). Supabase-side
// only, keyed on the GHL opportunity id; /make-the-ask writes it via
// scripts/set-ask-artefact.mjs when it parks the page. An Ask with no row is
// normal — never treat absence as a mismatch.
import { getServiceSupabase } from '@/lib/supabase';

export type AskArtefact = {
  ghlOpportunityId: string;
  orgProfileId: string;
  artefactUrl: string;
  askName: string | null;
  setBy: string | null;
  setAt: string;
};

type Row = {
  ghl_opportunity_id: string;
  org_profile_id: string;
  artefact_url: string;
  ask_name: string | null;
  set_by: string | null;
  set_at: string;
};

function fromRow(r: Row): AskArtefact {
  return {
    ghlOpportunityId: r.ghl_opportunity_id,
    orgProfileId: r.org_profile_id,
    artefactUrl: r.artefact_url,
    askName: r.ask_name,
    setBy: r.set_by,
    setAt: r.set_at,
  };
}

/** Artefact URLs for a set of Asks, keyed by GHL opportunity id. */
export async function getAskArtefacts(
  orgProfileId: string,
  ghlOpportunityIds: string[]
): Promise<Map<string, AskArtefact>> {
  if (ghlOpportunityIds.length === 0) return new Map();
  const db = getServiceSupabase();
  const { data, error } = await db
    .from('act_ask_artefacts')
    .select('*')
    .eq('org_profile_id', orgProfileId)
    .in('ghl_opportunity_id', ghlOpportunityIds);
  if (error) throw new Error(`act_ask_artefacts read failed: ${error.message}`);
  return new Map(((data ?? []) as Row[]).map((r) => [r.ghl_opportunity_id, fromRow(r)]));
}

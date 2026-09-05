// Where a commerce-lane submission enters the pipeline.
//
// Live GHL pipeline and entry-stage ids on the ACT location (agzsSZWgovjwgpcoASWG),
// lifted verbatim from act-regenerative-studio src/app/api/forms/submit/route.ts:173.
// That is the path this spine replaces, and the only mapping that has ever run in
// production. pipelineId is the GHL ghl_id, not the Supabase mirror row id.
//
// Deliberately not env-driven. The function was deployed reading GHL_PIPELINE_ID and
// GHL_PIPELINE_STAGE_ID, neither of which exists on this project, so the whole leg was
// a silent no-op. The only pipeline the project does hold is GHL_HARVEST_INBOX_*,
// which would have filed every property's prospect in The Harvest's inbox. A wrong
// pipeline is worse than a missing one, so the routing is stated here where it can be
// read and tested rather than guessed from a secret name.

export interface PipelineRoute {
  pipelineId: string;
  stageId: string;
}

export const PIPELINE_ROUTES: ReadonlyMap<string, PipelineRoute> = new Map<string, PipelineRoute>([
  ['ACT-EL', { pipelineId: 'aRGmSaMh62wPO2R0Bt4g', stageId: '5c73d63e-619f-465a-90bb-151ea20351d7' }], // Identified
  ['ACT-GD', { pipelineId: 'FjMyJM3YzWQFmKqR9fur', stageId: '1fd317ec-f8f1-4837-b324-e48c22956cdd' }], // First Contact
]);

/** Universal Inquiry / New Inquiry. Where anything without its own pipeline lands. */
export const PIPELINE_DEFAULT: PipelineRoute = {
  pipelineId: 'ggQw10DuH0XRji6keimS',
  stageId: '2eded979-7439-407d-89b6-762499b56658',
};

/**
 * The route for a submission, or null when it should open no opportunity.
 *
 * Call this only after mayCreateOpportunity(lane) — the lane decides whether an
 * opportunity is permitted at all, and this decides where a permitted one goes.
 *
 * A newsletter box is a subscriber, not a pipeline lead. It sits in the commerce lane
 * because it is an express opt-in, so without this the one form most likely to be
 * submitted would open an opportunity every time. Same rule as production.
 */
export function pipelineFor(projectCode: string, formType: string): PipelineRoute | null {
  if (formType === 'newsletter') return null;
  return PIPELINE_ROUTES.get(projectCode) ?? PIPELINE_DEFAULT;
}

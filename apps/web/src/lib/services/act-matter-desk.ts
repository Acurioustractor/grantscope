/**
 * Shared, project-neutral contract for ACT decision work.
 *
 * A matter desk is not a pipeline stage or a score. It is a read-only assembly
 * of the current matter, relationships, authority, evidence, decision and next
 * action. Project adapters keep their own domain records and translate only
 * the bounded read needed by the desk.
 */

export type ActMatterDeskEvidenceState =
  | 'verified'
  | 'partial'
  | 'unknown'
  | 'conflicted'
  | 'unavailable';

export interface ActMatterDeskProject {
  id: string;
  label: string;
  purpose: string;
}

export interface ActMatterDeskPathway {
  position: string;
  label: string;
  holds: string;
  disclaimer: string;
}

export interface ActMatterDeskAuthorityRead {
  state: ActMatterDeskEvidenceState;
  label: string;
  note: string;
}

export interface ActMatterDeskRequestRead {
  state: ActMatterDeskEvidenceState;
  label: string;
  note: string;
}

export interface ActMatterDeskEvidenceRead {
  state: ActMatterDeskEvidenceState;
  conflictCount: number;
  sourceCount: number;
  humanReviewConnected: boolean;
  note: string;
}

export interface ActMatterDeskAction {
  label: string;
  owner: string | null;
  dueAt: string | null;
  source: string | null;
}

export interface ActMatterDeskMatter<TMatterId extends string = string> {
  id: TMatterId;
  projectId: string;
  title: string;
  placeLabel: string;
  readAt: string;
  pathway: ActMatterDeskPathway;
  nextDecision: string;
  unresolvedQuestions: string[];
  authority: ActMatterDeskAuthorityRead;
  currentRequest: ActMatterDeskRequestRead;
  evidence: ActMatterDeskEvidenceRead;
  nextAction: ActMatterDeskAction;
}

export interface ActMatterDeskSnapshot<TMatterId extends string = string> {
  project: ActMatterDeskProject;
  matters: Record<TMatterId, ActMatterDeskMatter<TMatterId>>;
  matterOrder: TMatterId[];
  mode: 'read-only';
  assembledAt: string;
}


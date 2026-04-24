import { briefingLaneLabel, buildBriefingComposeHref, parseBriefingLanes } from '@/app/components/briefing-loop-bar';

import type { BriefingLaneKey, BriefingOutputKey } from '@/app/components/briefing-loop-bar';

export type BoardReportPageSearchParams = {
  q?: string;
  autosearch?: string;
  subject?: string;
  lanes?: string;
};

export type ReportBuilderPageSearchParams = {
  topic?: string;
  state?: string;
  focus?: string;
  autogenerate?: string;
  lanes?: string;
};

export type SharedBriefingSearchParams = {
  subject?: string;
  state?: string;
  lanes?: string;
  output?: string;
};

type BriefingLoopState = {
  output: BriefingOutputKey;
  subject?: string;
  state?: string;
  lanes: BriefingLaneKey[];
  message: string;
};

type BriefingPageState = {
  briefingComposeHref: string;
  briefingLanes: BriefingLaneKey[];
  nextPath: string;
  showBriefingLoop: boolean;
  loop?: BriefingLoopState;
};

type SharedBriefingContext = {
  briefingComposeHref: string;
  briefingLanes: BriefingLaneKey[];
  briefingOutput: string;
  briefingState: string;
  briefingSubject: string;
  hasBriefingContext: boolean;
  loop?: BriefingLoopState;
};

export type ClarityPageState = SharedBriefingContext;

export type TenderBriefingState = SharedBriefingContext & {
  notice: string;
  seed: string;
};

function buildNextPath(basePath: string, nextParams: URLSearchParams) {
  const query = nextParams.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function buildLoopState({
  output,
  subject,
  state,
  lanes,
  withSubjectMessage,
  withoutSubjectMessage,
}: {
  output: BriefingOutputKey;
  subject?: string;
  state?: string;
  lanes: BriefingLaneKey[];
  withSubjectMessage: (subject: string) => string;
  withoutSubjectMessage: string;
}): BriefingLoopState {
  return {
    output,
    subject,
    state,
    lanes,
    message: subject ? withSubjectMessage(subject) : withoutSubjectMessage,
  };
}

function buildSharedBriefingContext({
  start,
  output,
  params,
  topic,
  withSubjectMessage,
  withoutSubjectMessage,
}: {
  start: 'company' | 'funding' | 'procurement' | 'place';
  output: BriefingOutputKey;
  params: SharedBriefingSearchParams;
  topic?: string;
  withSubjectMessage: (subject: string) => string;
  withoutSubjectMessage: string;
}): SharedBriefingContext {
  const briefingSubject = params.subject?.trim() || '';
  const briefingState = params.state?.trim() || '';
  const briefingOutput = params.output || '';
  const briefingLanes = parseBriefingLanes(params.lanes);
  const hasBriefingContext = !!briefingSubject || !!briefingState || briefingLanes.length > 0 || !!briefingOutput;

  return {
    briefingComposeHref: buildBriefingComposeHref({
      start,
      output,
      subject: briefingSubject,
      state: briefingState,
      topic,
      lanes: briefingLanes,
    }),
    briefingLanes,
    briefingOutput,
    briefingState,
    briefingSubject,
    hasBriefingContext,
    loop: hasBriefingContext
      ? buildLoopState({
          output,
          subject: briefingSubject,
          state: briefingState,
          lanes: briefingLanes,
          withSubjectMessage,
          withoutSubjectMessage,
        })
      : undefined,
  };
}

export function buildBoardReportPageState(params: BoardReportPageSearchParams): BriefingPageState {
  const initialSearchTerm = params.q || '';
  const autoSearch = params.autosearch === '1';
  const shared = buildSharedBriefingContext({
    start: 'company',
    output: 'board-memo',
    params: {
      subject: params.subject?.trim() || initialSearchTerm.trim(),
      lanes: params.lanes,
    },
    withSubjectMessage: (subject) =>
      `This memo is carrying the briefing context for ${subject}. Refine the subject or evidence lanes in the hub, then come back here to regenerate the board pack.`,
    withoutSubjectMessage:
      'This memo is carrying briefing context from the hub. Refine the subject or evidence lanes there if the board pack needs a tighter frame.',
  });
  const { briefingComposeHref, briefingLanes, loop } = shared;
  const showBriefingLoop = autoSearch || briefingLanes.length > 0;

  const nextParams = new URLSearchParams();
  if (initialSearchTerm) nextParams.set('q', initialSearchTerm);
  if (autoSearch) nextParams.set('autosearch', '1');
  if (params.subject) nextParams.set('subject', params.subject);
  if (params.lanes) nextParams.set('lanes', params.lanes);

  return {
    briefingComposeHref,
    briefingLanes,
    nextPath: buildNextPath('/home/board-report', nextParams),
    showBriefingLoop,
    loop: showBriefingLoop ? loop : undefined,
  };
}

export function buildReportBuilderPageState(params: ReportBuilderPageSearchParams): BriefingPageState {
  const initialTopic = params.topic || 'youth-justice';
  const initialStateFilter = params.state || '';
  const initialFocus = params.focus || '';
  const autoGenerate = params.autogenerate === '1';
  const shared = buildSharedBriefingContext({
    start: 'funding',
    output: 'funding-brief',
    params: {
      subject: initialFocus,
      state: initialStateFilter,
      lanes: params.lanes,
    },
    topic: initialTopic,
    withSubjectMessage: (subject) =>
      `This funding brief is carrying the briefing context for ${subject}. Refine the topic, geography, or evidence lanes in the hub, then come back here to regenerate the report.`,
    withoutSubjectMessage:
      'This funding brief is carrying briefing context from the hub. Refine the topic, geography, or evidence lanes there if the report needs a different frame.',
  });
  const { briefingComposeHref, briefingLanes, loop } = shared;
  const showBriefingLoop = autoGenerate || !!initialFocus || !!initialStateFilter || briefingLanes.length > 0;

  const nextParams = new URLSearchParams();
  if (initialTopic) nextParams.set('topic', initialTopic);
  if (initialStateFilter) nextParams.set('state', initialStateFilter);
  if (initialFocus) nextParams.set('focus', initialFocus);
  if (autoGenerate) nextParams.set('autogenerate', '1');
  if (params.lanes) nextParams.set('lanes', params.lanes);

  return {
    briefingComposeHref,
    briefingLanes,
    nextPath: buildNextPath('/home/report-builder', nextParams),
    showBriefingLoop,
    loop: showBriefingLoop ? loop : undefined,
  };
}

export function buildClarityPageState(params: SharedBriefingSearchParams): ClarityPageState {
  return buildSharedBriefingContext({
    start: 'place',
    output: 'story-handoff',
    params,
    withSubjectMessage: (subject) =>
      `Clarity is carrying the story handoff for ${subject}. Verify the evidence chain here, then return to the hub if the subject, geography, or lanes need to change before narrative work starts.`,
    withoutSubjectMessage:
      'Clarity is carrying story context from the briefing hub. Verify the evidence chain here, then return to the hub if the subject, geography, or evidence lanes need to change.',
  });
}

export function buildTenderBriefingState(params: SharedBriefingSearchParams): TenderBriefingState {
  const shared = buildSharedBriefingContext({
    start: 'procurement',
    output: 'tender-pack',
    params,
    withSubjectMessage: (subject) =>
      `Tender Intelligence is carrying the briefing context for ${subject}. Change the subject, geography, or evidence lanes in the hub, then come back here to keep the decision pack tight.`,
    withoutSubjectMessage:
      'Tender Intelligence is carrying briefing context from the hub. Adjust the decision frame there if the procurement pack needs a different subject, geography, or evidence mix.',
  });

  const seed = [
    shared.briefingSubject,
    shared.briefingState,
    shared.briefingOutput,
    shared.briefingLanes.join(','),
  ].filter(Boolean).join('|');

  const laneSummary = shared.briefingLanes
    .map((lane) => briefingLaneLabel(lane).toLowerCase())
    .join(', ');

  return {
    ...shared,
    notice: [
      'Loaded briefing handoff',
      shared.briefingSubject ? `for ${shared.briefingSubject}` : null,
      shared.briefingState ? `in ${shared.briefingState}` : null,
      shared.briefingOutput === 'story-handoff' ? 'with story mode context' : null,
      laneSummary ? `carrying ${laneSummary}` : null,
      'Use the workspace search and current shortlist to turn that context into a procurement decision pack.',
    ].filter(Boolean).join(' '),
    seed,
  };
}

import Link from 'next/link';

export type BriefingStartPointKey = 'company' | 'funding' | 'procurement' | 'place';
export type BriefingOutputKey = 'board-memo' | 'funding-brief' | 'tender-pack' | 'story-handoff';
export type BriefingLaneKey = 'entity' | 'funding' | 'procurement' | 'place' | 'clarity';

const LANE_LABELS: Record<BriefingLaneKey, string> = {
  entity: 'Entity identity',
  funding: 'Funding context',
  procurement: 'Procurement context',
  place: 'Place and power',
  clarity: 'Story handoff',
};

const OUTPUT_LABELS: Record<BriefingOutputKey, string> = {
  'board-memo': 'Board memo',
  'funding-brief': 'Funding brief',
  'tender-pack': 'Tender pack',
  'story-handoff': 'Story handoff',
};

export function parseBriefingLanes(value: string | null | undefined): BriefingLaneKey[] {
  if (!value) return [];

  const laneSet = new Set<BriefingLaneKey>();
  for (const item of value.split(',')) {
    const trimmed = item.trim();
    if (trimmed === 'entity' || trimmed === 'funding' || trimmed === 'procurement' || trimmed === 'place' || trimmed === 'clarity') {
      laneSet.add(trimmed);
    }
  }

  return Array.from(laneSet);
}

export function briefingLaneLabel(value: BriefingLaneKey | string) {
  if (value === 'entity' || value === 'funding' || value === 'procurement' || value === 'place' || value === 'clarity') {
    return LANE_LABELS[value];
  }

  return value.replace(/-/g, ' ');
}

export function briefingOutputLabel(value: BriefingOutputKey) {
  return OUTPUT_LABELS[value];
}

export function buildBriefingComposeHref({
  start,
  output,
  subject,
  state,
  topic,
  lanes,
}: {
  start: BriefingStartPointKey;
  output: BriefingOutputKey;
  subject?: string;
  state?: string;
  topic?: string;
  lanes?: BriefingLaneKey[];
}) {
  const params = new URLSearchParams();
  params.set('start', start);
  params.set('output', output);

  const trimmedSubject = subject?.trim();
  if (trimmedSubject) params.set('subject', trimmedSubject);

  const trimmedState = state?.trim();
  if (trimmedState) params.set('state', trimmedState);

  const trimmedTopic = topic?.trim();
  if (trimmedTopic) params.set('topic', trimmedTopic);

  const validLanes = (lanes || []).filter(Boolean);
  if (validLanes.length > 0) params.set('lanes', validLanes.join(','));

  return `/briefing?${params.toString()}#composer`;
}

export function BriefingLoopBar({
  refineHref,
  message,
  output,
  subject,
  state,
  lanes,
  className = '',
}: {
  refineHref: string;
  message: string;
  output: BriefingOutputKey;
  subject?: string;
  state?: string;
  lanes?: BriefingLaneKey[];
  className?: string;
}) {
  const detailChips = [
    subject ? `Subject: ${subject}` : null,
    state ? `State: ${state}` : null,
    `Output: ${briefingOutputLabel(output)}`,
  ].filter(Boolean);

  return (
    <div className={`border-4 border-bauhaus-blue bg-blue-50 px-5 py-4 ${className}`.trim()}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-4xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Briefing Loop</p>
          <p className="mt-2 text-sm font-bold text-bauhaus-black">{message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {detailChips.map((chip) => (
              <span
                key={chip}
                className="border-2 border-bauhaus-blue bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue"
              >
                {chip}
              </span>
            ))}
            {(lanes || []).map((lane) => (
              <span
                key={lane}
                className="border-2 border-bauhaus-blue/30 bg-blue-100 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue"
              >
                {briefingLaneLabel(lane)}
              </span>
            ))}
          </div>
        </div>
        <Link
          href={refineHref}
          className="inline-flex items-center justify-center border-4 border-bauhaus-blue bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue transition-colors hover:bg-bauhaus-blue hover:text-white"
        >
          Refine In Briefing Hub
        </Link>
      </div>
    </div>
  );
}

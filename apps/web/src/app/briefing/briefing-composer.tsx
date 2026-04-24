'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { parseBriefingLanes } from '@/app/components/briefing-loop-bar';

type StartPointKey = 'company' | 'funding' | 'procurement' | 'place';
type OutputKey = 'board-memo' | 'funding-brief' | 'tender-pack' | 'story-handoff';
type LaneKey = 'entity' | 'funding' | 'procurement' | 'place' | 'clarity';
type AgentKey = 'scout' | 'link' | 'draft' | 'story';

type StartPoint = {
  key: StartPointKey;
  label: string;
  description: string;
  directRoute: string;
};

type OutputOption = {
  key: OutputKey;
  label: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  supportHrefs: Array<{ label: string; href: string }>;
};

type Lane = {
  key: LaneKey;
  label: string;
  description: string;
};

type Agent = {
  key: AgentKey;
  label: string;
  description: string;
};

const START_POINTS: StartPoint[] = [
  {
    key: 'company',
    label: 'Company / organisation',
    description: 'Use this when the core question is about one organisation, its relationships, and what to do next.',
    directRoute: '/entities',
  },
  {
    key: 'funding',
    label: 'Grant / funder',
    description: 'Use this when the work starts from a funding pathway, topic, or funder landscape.',
    directRoute: '/grants',
  },
  {
    key: 'procurement',
    label: 'Procurement / market',
    description: 'Use this when the decision is about suppliers, pathways, or a live procurement move.',
    directRoute: '/procurement',
  },
  {
    key: 'place',
    label: 'Place / field',
    description: 'Use this when the work starts from a geography, system problem, or field-level question.',
    directRoute: '/power',
  },
];

const OUTPUTS: OutputOption[] = [
  {
    key: 'board-memo',
    label: 'Board memo',
    description: 'Generate an internal memo or partner-facing brief from linked organisation context.',
    primaryHref: '/home/board-report',
    primaryLabel: 'Open board memo generator',
    supportHrefs: [
      { label: 'Open power map', href: '/power' },
      { label: 'Check clarity layer', href: '/insights' },
    ],
  },
  {
    key: 'funding-brief',
    label: 'Funding brief',
    description: 'Turn a topic, geography, or opportunity set into a stronger funding landscape read.',
    primaryHref: '/home/report-builder',
    primaryLabel: 'Open funding report builder',
    supportHrefs: [
      { label: 'Search grants', href: '/grants' },
      { label: 'Review funders', href: '/foundations' },
    ],
  },
  {
    key: 'tender-pack',
    label: 'Tender pack',
    description: 'Carry the evidence into supplier review, market testing, and sign-off-ready procurement work.',
    primaryHref: '/procurement',
    primaryLabel: 'Open tender intelligence',
    supportHrefs: [
      { label: 'See market power', href: '/power' },
      { label: 'Review reports', href: '/reports' },
    ],
  },
  {
    key: 'story-handoff',
    label: 'Story handoff',
    description: 'Prepare the evidence chain for reporting, company stories, and aligned narrative analysis.',
    primaryHref: '/insights',
    primaryLabel: 'Open clarity handoff',
    supportHrefs: [
      { label: 'Open reporting', href: '/reports' },
      { label: 'See entities', href: '/entities' },
    ],
  },
];

const TOPIC_OPTIONS = [
  { value: 'youth-justice', label: 'Youth Justice' },
  { value: 'child-protection', label: 'Child Protection' },
  { value: 'ndis', label: 'NDIS' },
  { value: 'family-services', label: 'Family Services' },
  { value: 'indigenous', label: 'Indigenous' },
  { value: 'legal-services', label: 'Legal Services' },
  { value: 'diversion', label: 'Diversion' },
  { value: 'prevention', label: 'Prevention' },
] as const;

const STATE_OPTIONS = ['', 'NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'] as const;

const LANES: Lane[] = [
  {
    key: 'entity',
    label: 'Entity identity',
    description: 'Resolved organisation records, identifiers, and relationship context.',
  },
  {
    key: 'funding',
    label: 'Funding context',
    description: 'Grants, foundations, and the surrounding funding environment.',
  },
  {
    key: 'procurement',
    label: 'Procurement context',
    description: 'Suppliers, pathways, procurement packs, and decision records.',
  },
  {
    key: 'place',
    label: 'Place and power',
    description: 'Place signals, power concentration, and field-level context.',
  },
  {
    key: 'clarity',
    label: 'Story handoff',
    description: 'Evidence lineage and narrative-ready framing for downstream reporting.',
  },
];

const AGENTS: Agent[] = [
  {
    key: 'scout',
    label: 'Scout',
    description: 'Find new signals, pathways, and changes worth briefing.',
  },
  {
    key: 'link',
    label: 'Link',
    description: 'Resolve entities, places, and related systems into one working context.',
  },
  {
    key: 'draft',
    label: 'Draft',
    description: 'Assemble the memo, recommendation, or report shell from the evidence.',
  },
  {
    key: 'story',
    label: 'Story layer',
    description: 'Prepare a clean handoff for company stories, reporting, and aligned analysis.',
  },
];

function parseStart(value: string | null): StartPointKey {
  return START_POINTS.some((item) => item.key === value) ? (value as StartPointKey) : 'company';
}

function parseOutput(value: string | null): OutputKey {
  return OUTPUTS.some((item) => item.key === value) ? (value as OutputKey) : 'board-memo';
}

function recommendationLanes(start: StartPointKey, output: OutputKey): LaneKey[] {
  const fromStart: Record<StartPointKey, LaneKey[]> = {
    company: ['entity', 'funding', 'place'],
    funding: ['funding', 'place', 'entity'],
    procurement: ['procurement', 'entity', 'place'],
    place: ['place', 'funding', 'entity'],
  };

  const fromOutput: Record<OutputKey, LaneKey[]> = {
    'board-memo': ['entity', 'funding', 'place'],
    'funding-brief': ['funding', 'place', 'clarity'],
    'tender-pack': ['procurement', 'entity', 'place'],
    'story-handoff': ['clarity', 'entity', 'place'],
  };

  return Array.from(new Set([...fromStart[start], ...fromOutput[output]]));
}

function recommendedAgents(output: OutputKey): AgentKey[] {
  const map: Record<OutputKey, AgentKey[]> = {
    'board-memo': ['scout', 'link', 'draft'],
    'funding-brief': ['scout', 'link', 'draft'],
    'tender-pack': ['scout', 'link', 'draft'],
    'story-handoff': ['link', 'draft', 'story'],
  };

  return map[output];
}

function buildWorkingAsk(start: StartPointKey, output: OutputKey) {
  const startText: Record<StartPointKey, string> = {
    company: 'What is actually happening around this organisation, and what is the next move?',
    funding: 'Which funding pathway is real, and how should we frame it for action?',
    procurement: 'Which procurement move is strongest, and what evidence supports it?',
    place: 'What is happening in this place or field, and what recommendation follows from that reality?',
  };

  const outputText: Record<OutputKey, string> = {
    'board-memo': 'End with a board-ready memo that can support an internal decision.',
    'funding-brief': 'End with a brief that sharpens the funding opportunity or landscape.',
    'tender-pack': 'End with a procurement recommendation or sign-off-ready pack.',
    'story-handoff': 'End with a narrative handoff that can support reporting or a company story.',
  };

  return [startText[start], outputText[output]];
}

function focusLabel(start: StartPointKey, output: OutputKey) {
  if (output === 'board-memo') return 'Organisation or company';
  if (output === 'funding-brief') return 'Funding angle or partner';
  if (output === 'tender-pack') return 'Supplier, buyer, or procurement angle';

  switch (start) {
    case 'company':
      return 'Organisation or company';
    case 'funding':
      return 'Funding angle';
    case 'procurement':
      return 'Procurement angle';
    case 'place':
    default:
      return 'Place, field, or story angle';
  }
}

function focusPlaceholder(start: StartPointKey, output: OutputKey) {
  if (output === 'board-memo') return 'e.g. Life Without Barriers';
  if (output === 'funding-brief') return 'e.g. Youth justice reform';
  if (output === 'tender-pack') return 'e.g. Remote service delivery suppliers';

  switch (start) {
    case 'company':
      return 'e.g. Save the Children Australia';
    case 'funding':
      return 'e.g. Diversion and prevention';
    case 'procurement':
      return 'e.g. Community-led procurement';
    case 'place':
    default:
      return 'e.g. Townsville youth justice';
  }
}

function buildPrimaryHref({
  output,
  subject,
  topicPreset,
  stateFocus,
  selectedLaneKeys,
}: {
  output: OutputOption;
  subject: string;
  topicPreset: string;
  stateFocus: string;
  selectedLaneKeys: LaneKey[];
}) {
  const params = new URLSearchParams();
  const trimmedSubject = subject.trim();

  if (output.key === 'board-memo') {
    if (trimmedSubject) {
      params.set('q', trimmedSubject);
      params.set('autosearch', '1');
    }
  }

  if (output.key === 'funding-brief') {
    params.set('topic', topicPreset);
    params.set('autogenerate', '1');
    if (stateFocus) params.set('state', stateFocus);
    if (trimmedSubject) params.set('focus', trimmedSubject);
  }

  if (output.key === 'tender-pack') {
    params.set('tab', 'pack');
    if (trimmedSubject) params.set('subject', trimmedSubject);
    if (stateFocus) params.set('state', stateFocus);
  }

  if (output.key === 'story-handoff') {
    params.set('output', output.key);
    if (trimmedSubject) params.set('subject', trimmedSubject);
    if (stateFocus) params.set('state', stateFocus);
  }

  params.set('lanes', selectedLaneKeys.join(','));

  const query = params.toString();
  return query ? `${output.primaryHref}?${query}` : output.primaryHref;
}

function buildContextHref(start: StartPoint, subject: string) {
  const trimmedSubject = subject.trim();
  if (!trimmedSubject) return start.directRoute;

  if (start.key === 'company') {
    return `/entities?q=${encodeURIComponent(trimmedSubject)}`;
  }

  if (start.key === 'funding') {
    return `/grants?q=${encodeURIComponent(trimmedSubject)}`;
  }

  return start.directRoute;
}

export function BriefingComposer() {
  const searchParams = useSearchParams();
  const [startPoint, setStartPoint] = useState<StartPointKey>('company');
  const [output, setOutput] = useState<OutputKey>('board-memo');
  const [subject, setSubject] = useState('');
  const [topicPreset, setTopicPreset] = useState<string>('youth-justice');
  const [stateFocus, setStateFocus] = useState<string>('');
  const [selectedLanes, setSelectedLanes] = useState<LaneKey[]>(recommendationLanes('company', 'board-memo'));

  useEffect(() => {
    const nextStart = parseStart(searchParams.get('start'));
    const nextOutput = parseOutput(searchParams.get('output'));
    const nextSubject = searchParams.get('subject') || '';
    const nextTopic = searchParams.get('topic') || 'youth-justice';
    const nextState = searchParams.get('state') || '';
    const nextLanes = parseBriefingLanes(searchParams.get('lanes'));
    setStartPoint(nextStart);
    setOutput(nextOutput);
    setSubject(nextSubject);
    setTopicPreset(TOPIC_OPTIONS.some((item) => item.value === nextTopic) ? nextTopic : 'youth-justice');
    setStateFocus(STATE_OPTIONS.includes(nextState as (typeof STATE_OPTIONS)[number]) ? nextState : '');
    setSelectedLanes(nextLanes.length > 0 ? nextLanes : recommendationLanes(nextStart, nextOutput));
  }, [searchParams]);

  const currentStart = START_POINTS.find((item) => item.key === startPoint) || START_POINTS[0];
  const currentOutput = OUTPUTS.find((item) => item.key === output) || OUTPUTS[0];
  const activeAgents = recommendedAgents(output)
    .map((key) => AGENTS.find((agent) => agent.key === key))
    .filter((agent): agent is Agent => Boolean(agent));
  const activeLanes = selectedLanes
    .map((key) => LANES.find((lane) => lane.key === key))
    .filter((lane): lane is Lane => Boolean(lane));
  const workingAsk = buildWorkingAsk(startPoint, output);
  const launchHref = buildPrimaryHref({
    output: currentOutput,
    subject,
    topicPreset,
    stateFocus,
    selectedLaneKeys: selectedLanes,
  });
  const contextHref = buildContextHref(currentStart, subject);

  function toggleLane(laneKey: LaneKey) {
    setSelectedLanes((current) =>
      current.includes(laneKey) ? current.filter((item) => item !== laneKey) : [...current, laneKey],
    );
  }

  return (
    <section id="composer">
      <div
        className="rounded-xl border p-5"
        style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}
      >
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
          <div className="space-y-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>
                Compose The Brief
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight" style={{ color: 'var(--ws-text)' }}>
                Configure the decision before you open the generator.
              </h2>
              <p className="mt-2 text-sm max-w-3xl" style={{ color: 'var(--ws-text-secondary)' }}>
                Pick the subject, choose the output, and confirm which evidence lanes need to travel with the work.
                This keeps the older memo and report tools inside one simpler operating flow.
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--ws-text-tertiary)' }}>
                1. Start point
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {START_POINTS.map((item) => {
                  const active = item.key === startPoint;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setStartPoint(item.key);
                        setSelectedLanes(recommendationLanes(item.key, output));
                      }}
                      className="rounded-lg border px-4 py-4 text-left transition-colors"
                      style={{
                        borderColor: active ? 'var(--ws-accent)' : 'var(--ws-border)',
                        background: active ? 'rgba(37,99,235,0.06)' : 'var(--ws-surface-0)',
                      }}
                    >
                      <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>
                        {item.label}
                      </p>
                      <p className="mt-1 text-xs leading-5" style={{ color: 'var(--ws-text-secondary)' }}>
                        {item.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--ws-text-tertiary)' }}>
                2. Output
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {OUTPUTS.map((item) => {
                  const active = item.key === output;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setOutput(item.key);
                        setSelectedLanes(recommendationLanes(startPoint, item.key));
                      }}
                      className="rounded-lg border px-4 py-4 text-left transition-colors"
                      style={{
                        borderColor: active ? 'var(--ws-accent)' : 'var(--ws-border)',
                        background: active ? 'rgba(37,99,235,0.06)' : 'var(--ws-surface-0)',
                      }}
                    >
                      <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>
                        {item.label}
                      </p>
                      <p className="mt-1 text-xs leading-5" style={{ color: 'var(--ws-text-secondary)' }}>
                        {item.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--ws-text-tertiary)' }}>
                3. Brief focus
              </p>
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_180px_180px] gap-3">
                <div
                  className="rounded-lg border px-4 py-4"
                  style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-0)' }}
                >
                  <label className="block text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ws-text-tertiary)' }}>
                    {focusLabel(startPoint, output)}
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder={focusPlaceholder(startPoint, output)}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)', color: 'var(--ws-text)' }}
                  />
                  <p className="mt-2 text-xs leading-5" style={{ color: 'var(--ws-text-secondary)' }}>
                    Keep this short. It becomes the search seed or handoff label when the next tool opens.
                  </p>
                </div>

                <div
                  className="rounded-lg border px-4 py-4"
                  style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-0)' }}
                >
                  <label className="block text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ws-text-tertiary)' }}>
                    Topic preset
                  </label>
                  <select
                    value={topicPreset}
                    onChange={(event) => setTopicPreset(event.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)', color: 'var(--ws-text)' }}
                  >
                    {TOPIC_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs leading-5" style={{ color: 'var(--ws-text-secondary)' }}>
                    Used when the output is a funding brief.
                  </p>
                </div>

                <div
                  className="rounded-lg border px-4 py-4"
                  style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-0)' }}
                >
                  <label className="block text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ws-text-tertiary)' }}>
                    State focus
                  </label>
                  <select
                    value={stateFocus}
                    onChange={(event) => setStateFocus(event.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)', color: 'var(--ws-text)' }}
                  >
                    <option value="">National / all states</option>
                    {STATE_OPTIONS.filter(Boolean).map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs leading-5" style={{ color: 'var(--ws-text-secondary)' }}>
                    Passed into funding briefs when useful.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>
                  4. Evidence lanes
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedLanes(recommendationLanes(startPoint, output))}
                  className="text-[11px] font-medium"
                  style={{ color: 'var(--ws-accent)' }}
                >
                  Reset to recommended
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {LANES.map((lane) => {
                  const active = selectedLanes.includes(lane.key);
                  return (
                    <button
                      key={lane.key}
                      type="button"
                      onClick={() => toggleLane(lane.key)}
                      className="rounded-lg border px-4 py-4 text-left transition-colors"
                      style={{
                        borderColor: active ? 'var(--ws-accent)' : 'var(--ws-border)',
                        background: active ? 'rgba(37,99,235,0.06)' : 'var(--ws-surface-0)',
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>
                          {lane.label}
                        </p>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                          style={{
                            background: active ? 'var(--ws-accent)' : 'var(--ws-surface-1)',
                            color: active ? '#fff' : 'var(--ws-text-tertiary)',
                          }}
                        >
                          {active ? 'Included' : 'Optional'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5" style={{ color: 'var(--ws-text-secondary)' }}>
                        {lane.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div
            className="rounded-xl border p-5 h-fit"
            style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-0)' }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>
              Current Brief
            </p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight" style={{ color: 'var(--ws-text)' }}>
              {currentStart.label} to {currentOutput.label}
            </h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--ws-text-secondary)' }}>
              {currentOutput.description}
            </p>

            <div className="mt-4 space-y-3">
              {workingAsk.map((item) => (
                <div
                  key={item}
                  className="rounded-lg border px-4 py-3"
                  style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}
                >
                  <p className="text-sm" style={{ color: 'var(--ws-text)' }}>
                    {item}
                  </p>
                </div>
              ))}
              {(subject.trim() || output === 'funding-brief' || stateFocus) && (
                <div
                  className="rounded-lg border px-4 py-3"
                  style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}
                >
                  <p className="text-sm" style={{ color: 'var(--ws-text)' }}>
                    {subject.trim() ? `Focus: ${subject.trim()}. ` : ''}
                    {output === 'funding-brief' ? `Topic preset: ${TOPIC_OPTIONS.find((item) => item.value === topicPreset)?.label || topicPreset}. ` : ''}
                    {stateFocus ? `State focus: ${stateFocus}.` : 'State focus: National.'}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ws-text-tertiary)' }}>
                Evidence carried forward
              </p>
              <div className="flex flex-wrap gap-2">
                {activeLanes.map((lane) => (
                  <span
                    key={lane.key}
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                    style={{ background: 'rgba(37,99,235,0.06)', color: 'var(--ws-accent)' }}
                  >
                    {lane.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ws-text-tertiary)' }}>
                Agent support
              </p>
              <div className="space-y-2">
                {activeAgents.map((agent) => (
                  <div
                    key={agent.key}
                    className="rounded-lg border px-4 py-3"
                    style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}
                  >
                    <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>
                      {agent.label}
                    </p>
                    <p className="mt-1 text-xs leading-5" style={{ color: 'var(--ws-text-secondary)' }}>
                      {agent.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <Link
                href={launchHref}
                className="flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
                style={{ background: 'var(--ws-accent)', color: '#fff' }}
              >
                {currentOutput.primaryLabel}
              </Link>
              <div className="grid grid-cols-1 gap-2">
                <Link
                  href={contextHref}
                  className="rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors hover:border-[var(--ws-accent)]"
                  style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-secondary)' }}
                >
                  Open subject context
                </Link>
                {currentOutput.supportHrefs.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors hover:border-[var(--ws-accent)]"
                    style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-secondary)' }}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div
              className="mt-5 rounded-lg border px-4 py-3"
              style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>
                Story bridge
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--ws-text-secondary)' }}>
                Keep company facts, procurement opportunity analysis, and reporting notes in the same thread so the downstream story layer does not have to reconstruct reality from scratch.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

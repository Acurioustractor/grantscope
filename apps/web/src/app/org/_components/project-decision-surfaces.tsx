import type {
  OrgPipelineItem,
  OrgProject,
  OrgProjectFoundationPortfolioRow,
} from '@/lib/services/org-dashboard-service';
import { getProjectWorkspaceCopy, isGoodsProject } from '@/lib/project-workspace';
import Link from 'next/link';
import { Section, StatusBadge } from './ui';

type CapitalStackItem = {
  layer?: string;
  source?: string;
  amount?: string;
  status?: string;
};

type ProcurementRoute = {
  name?: string;
  counterpart?: string;
  route_type?: string;
  stage?: string;
  why_it_matters?: string;
  next_move?: string;
  evidence?: string;
};

type OperatingSystem = {
  name?: string;
  role?: string;
  kind?: string;
  status?: string;
  href?: string;
  cta_label?: string;
  external?: boolean;
};

function getString(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function getStringArray(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function getObjectArray<T extends Record<string, unknown>>(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  if (!Array.isArray(value)) return [] as T[];
  return value.filter((item): item is T => typeof item === 'object' && item !== null);
}

function routeTone(stage: string | undefined) {
  if (stage === 'live') return 'border-money bg-money-light text-money';
  if (stage === 'warm') return 'border-bauhaus-blue bg-link-light text-bauhaus-blue';
  if (stage === 'priority') return 'border-bauhaus-red bg-bauhaus-red/5 text-bauhaus-red';
  if (stage === 'build') return 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-black';
  return 'border-bauhaus-black/20 bg-white text-bauhaus-muted';
}

function routeLabel(stage: string | undefined) {
  if (!stage) return 'Tracked';
  return stage.replace(/_/g, ' ');
}

function compactSourceLabel(path: string) {
  const pieces = path.split('/');
  return pieces[pieces.length - 1] || path;
}

function formatFreshnessDate(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function routeStageRank(stage: string | undefined) {
  if (stage === 'live') return 0;
  if (stage === 'priority') return 1;
  if (stage === 'warm') return 2;
  if (stage === 'build') return 3;
  return 4;
}

function previewItems(items: string[], max = 3) {
  return items.slice(0, max);
}

function procurementDeadlineSoon(deadline: string | null | undefined) {
  if (!deadline) return false;
  const now = Date.now();
  const then = new Date(deadline).getTime();
  const in21Days = now + 21 * 24 * 60 * 60 * 1000;
  return then >= now && then <= in21Days;
}

function isDueNow(nextTouchAt: string | null | undefined) {
  if (!nextTouchAt) return false;
  return new Date(nextTouchAt).getTime() <= Date.now();
}

function isUpcoming(nextTouchAt: string | null | undefined) {
  if (!nextTouchAt) return false;
  const now = Date.now();
  const then = new Date(nextTouchAt).getTime();
  const in14Days = now + 14 * 24 * 60 * 60 * 1000;
  return then > now && then <= in14Days;
}

function deadlineWithinDays(deadline: string | null | undefined, days: number) {
  if (!deadline) return false;
  const now = Date.now();
  const then = new Date(deadline).getTime();
  const cutoff = now + days * 24 * 60 * 60 * 1000;
  return then >= now && then <= cutoff;
}

function topDueFoundationTouch(rows: OrgProjectFoundationPortfolioRow[]) {
  return (
    [...rows]
      .filter((row) => isDueNow(row.next_touch_at))
      .sort(
        (left, right) =>
          new Date(left.next_touch_at || '9999-12-31').getTime() - new Date(right.next_touch_at || '9999-12-31').getTime(),
      )[0] || null
  );
}

function topDeadlinePipelineByTypes(rows: OrgPipelineItem[], types: string[], days: number) {
  return (
    [...rows]
      .filter((item) => types.includes(item.funder_type || '') && deadlineWithinDays(item.deadline, days))
      .sort(
        (left, right) =>
          new Date(left.deadline || '9999-12-31').getTime() - new Date(right.deadline || '9999-12-31').getTime(),
      )[0] || null
  );
}

function topGovernmentProcurement(rows: OrgPipelineItem[]) {
  return (
    [...rows]
      .filter((item) => item.funder_type === 'government')
      .sort((left, right) => {
        if (procurementDeadlineSoon(left.deadline) && !procurementDeadlineSoon(right.deadline)) return -1;
        if (!procurementDeadlineSoon(left.deadline) && procurementDeadlineSoon(right.deadline)) return 1;
        return (right.amount_numeric ?? 0) - (left.amount_numeric ?? 0);
      })[0] || null
  );
}

function topCommercialProcurement(rows: OrgPipelineItem[]) {
  return (
    [...rows]
      .filter((item) => ['commercial', 'corporate', 'partner'].includes(item.funder_type || ''))
      .sort((left, right) => {
        const score = (item: OrgPipelineItem) => {
          const text = `${item.name} ${item.notes || ''}`.toLowerCase();
          let value = 0;
          if (text.includes('procurement')) value += 3;
          if (text.includes('platform')) value += 3;
          if (text.includes('compliance')) value += 2;
          if (text.includes('buyer')) value += 2;
          if (text.includes('supply')) value += 2;
          if ((item.funder_type || '') === 'corporate') value += 1;
          return value;
        };
        return score(right) - score(left);
      })[0] || null
  );
}

export function ProjectDecisionBriefSection({ project }: { project: OrgProject }) {
  const metadata = project.metadata || {};
  const workspaceCopy = getProjectWorkspaceCopy(project);
  const freshnessLabel = formatFreshnessDate(project.updated_at);
  const operatingThesis = getString(metadata, 'operating_thesis');
  const capitalThesis = getString(metadata, 'capital_thesis');
  const procurementThesis = getString(metadata, 'procurement_thesis');
  const vehicleStrategy = getString(metadata, 'vehicle_strategy');
  const ownershipPathway = getString(metadata, 'ownership_pathway');
  const currentPriorities = getStringArray(metadata, 'current_priorities');
  const proofPoints = getStringArray(metadata, 'proof_points');
  const readinessGaps = getStringArray(metadata, 'readiness_gaps');
  const capitalStack = getObjectArray<CapitalStackItem>(metadata, 'capital_stack');
  const operatingSystems = getObjectArray<OperatingSystem>(metadata, 'operating_systems');
  const decisionSourcePaths = getStringArray(metadata, 'decision_source_paths');

  if (
    !operatingThesis &&
    !capitalThesis &&
    !procurementThesis &&
    !vehicleStrategy &&
    !ownershipPathway &&
    currentPriorities.length === 0 &&
    proofPoints.length === 0 &&
    readinessGaps.length === 0 &&
    capitalStack.length === 0 &&
    operatingSystems.length === 0
  ) {
    return null;
  }

  return (
    <Section title="Decision Brief">
      <div className="space-y-4">
        <div className="border-2 border-bauhaus-black bg-white p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">
            {workspaceCopy.decisionSource}
          </div>
          {freshnessLabel ? (
            <div className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
              Current as of {freshnessLabel}
            </div>
          ) : null}
          <p className="mt-2 max-w-4xl text-sm font-medium leading-relaxed text-bauhaus-muted">
            {workspaceCopy.decisionDescription}
          </p>

          <div className="mt-3 grid gap-3 xl:grid-cols-3">
            {operatingThesis ? (
              <div className="border-2 border-bauhaus-black/10 bg-bauhaus-canvas p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">Operating thesis</div>
                <p className="mt-2 line-clamp-4 text-sm font-medium leading-relaxed text-bauhaus-black">{operatingThesis}</p>
              </div>
            ) : null}
            {capitalThesis ? (
              <div className="border-2 border-bauhaus-black/10 bg-bauhaus-canvas p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">Capital thesis</div>
                <p className="mt-2 line-clamp-4 text-sm font-medium leading-relaxed text-bauhaus-black">{capitalThesis}</p>
              </div>
            ) : null}
            {procurementThesis ? (
              <div className="border-2 border-bauhaus-black/10 bg-bauhaus-canvas p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">Procurement thesis</div>
                <p className="mt-2 line-clamp-4 text-sm font-medium leading-relaxed text-bauhaus-black">{procurementThesis}</p>
              </div>
            ) : null}
          </div>

          {(vehicleStrategy || ownershipPathway) ? (
            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              {vehicleStrategy ? (
                <div className="border-2 border-bauhaus-blue bg-link-light p-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue">Vehicle & applicant path</div>
                  <p className="mt-2 line-clamp-4 text-sm font-medium leading-relaxed text-bauhaus-black">{vehicleStrategy}</p>
                </div>
              ) : null}
              {ownershipPathway ? (
                <div className="border-2 border-money bg-money-light p-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-money">Ownership pathway</div>
                  <p className="mt-2 line-clamp-4 text-sm font-medium leading-relaxed text-bauhaus-black">{ownershipPathway}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {(currentPriorities.length > 0 || proofPoints.length > 0 || readinessGaps.length > 0) && (
            <div className="mt-3 grid gap-3 xl:grid-cols-3">
              {currentPriorities.length > 0 ? (
                <div className="border-2 border-money bg-money-light p-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-money">Current priorities</div>
                  <div className="mt-3 space-y-2">
                    {previewItems(currentPriorities).map((item) => (
                      <div key={item} className="text-sm font-medium leading-relaxed text-bauhaus-black">
                        {item}
                      </div>
                    ))}
                    {currentPriorities.length > 3 ? (
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-muted">
                        +{currentPriorities.length - 3} more
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {proofPoints.length > 0 ? (
                <div className="border-2 border-bauhaus-blue bg-link-light p-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue">Proof points</div>
                  <div className="mt-3 space-y-2">
                    {previewItems(proofPoints).map((item) => (
                      <div key={item} className="text-sm font-medium leading-relaxed text-bauhaus-black">
                        {item}
                      </div>
                    ))}
                    {proofPoints.length > 3 ? (
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-muted">
                        +{proofPoints.length - 3} more
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {readinessGaps.length > 0 ? (
                <div className="border-2 border-bauhaus-red/25 bg-bauhaus-red/5 p-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">Readiness gaps</div>
                  <div className="mt-3 space-y-2">
                    {previewItems(readinessGaps).map((item) => (
                      <div key={item} className="text-sm font-medium leading-relaxed text-bauhaus-black">
                        {item}
                      </div>
                    ))}
                    {readinessGaps.length > 3 ? (
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-muted">
                        +{readinessGaps.length - 3} more
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {operatingSystems.length > 0 ? (
            <details className="mt-3 border-2 border-bauhaus-black/10 bg-white p-3">
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">Operating systems in play</div>
                    <div className="mt-1 text-sm font-medium text-bauhaus-muted">
                      {operatingSystems.length} system{operatingSystems.length === 1 ? '' : 's'} supporting delivery and execution
                    </div>
                  </div>
                  <span className="border-2 border-bauhaus-black/10 bg-bauhaus-canvas px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-black">
                    Expand
                  </span>
                </div>
              </summary>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {operatingSystems.map((system) => (
                  <div
                    key={`${system.name || 'system'}-${system.kind || 'kind'}`}
                    className="border-2 border-bauhaus-black/10 bg-bauhaus-canvas p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="text-sm font-black text-bauhaus-black">{system.name || 'System'}</div>
                      {system.status ? <StatusBadge status={system.status.toLowerCase().replace(/\s+/g, '_')} /> : null}
                    </div>
                    {system.kind ? (
                      <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-muted">
                        {system.kind.replace(/_/g, ' ')}
                      </div>
                    ) : null}
                    {system.role ? (
                      <p className="mt-2 line-clamp-4 text-sm font-medium leading-relaxed text-bauhaus-black">{system.role}</p>
                    ) : null}
                    {system.href ? (
                      system.external ? (
                        <a
                          href={system.href}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex border-2 border-bauhaus-black/15 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
                        >
                          {system.cta_label || 'Open system'}
                        </a>
                      ) : (
                        <Link
                          href={system.href}
                          className="mt-3 inline-flex border-2 border-bauhaus-black/15 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
                        >
                          {system.cta_label || 'Open system'}
                        </Link>
                      )
                    ) : null}
                  </div>
                ))}
              </div>
            </details>
          ) : null}

          {capitalStack.length > 0 ? (
            <details className="mt-3 border-2 border-bauhaus-black/10 bg-white p-3">
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">Current capital stack</div>
                    <div className="mt-1 text-sm font-medium text-bauhaus-muted">
                      {capitalStack.length} tracked capital layer{capitalStack.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <span className="border-2 border-bauhaus-black/10 bg-bauhaus-canvas px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-black">
                    Expand
                  </span>
                </div>
              </summary>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {capitalStack.map((item) => (
                  <div key={`${item.layer || 'layer'}-${item.source || 'source'}`} className="border-2 border-bauhaus-black/10 bg-bauhaus-canvas p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">{item.layer || 'Capital layer'}</div>
                    <div className="mt-1 text-sm font-black text-bauhaus-black">{item.source || 'Source'}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {item.amount ? (
                        <span className="border-2 border-bauhaus-black/10 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-black">
                          {item.amount}
                        </span>
                      ) : null}
                      {item.status ? <StatusBadge status={item.status.toLowerCase().replace(/\s+/g, '_')} /> : null}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ) : null}

          {decisionSourcePaths.length > 0 ? (
            <div className="mt-3 border-t border-bauhaus-black/10 pt-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">Decision sources</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {decisionSourcePaths.map((path) => (
                  <span
                    key={path}
                    className="border-2 border-bauhaus-black/10 bg-bauhaus-canvas px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-muted"
                  >
                    {compactSourceLabel(path)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

export function ProjectPressurePointsSection({
  project,
  pipeline,
  foundationPortfolio,
}: {
  project: OrgProject;
  pipeline: OrgPipelineItem[];
  foundationPortfolio: OrgProjectFoundationPortfolioRow[];
}) {
  const metadata = project.metadata || {};
  const readinessGaps = getStringArray(metadata, 'readiness_gaps');
  const dueFoundationTouches = foundationPortfolio.filter((row) => isDueNow(row.next_touch_at)).length;
  const upcomingFoundationTouches = foundationPortfolio.filter(
    (row) => !isDueNow(row.next_touch_at) && isUpcoming(row.next_touch_at),
  ).length;
  const dueFoundationLead = topDueFoundationTouch(foundationPortfolio);
  const capitalDeadlinesSoon = pipeline.filter(
    (item) => ['foundation', 'government'].includes(item.funder_type || '') && deadlineWithinDays(item.deadline, 30),
  ).length;
  const procurementDeadlinesSoon = pipeline.filter(
    (item) =>
      ['commercial', 'corporate', 'government', 'partner'].includes(item.funder_type || '') &&
      deadlineWithinDays(item.deadline, 30),
  ).length;
  const capitalDeadlineLead = topDeadlinePipelineByTypes(pipeline, ['foundation', 'government'], 30);
  const procurementDeadlineLead = topDeadlinePipelineByTypes(
    pipeline,
    ['commercial', 'corporate', 'government', 'partner'],
    30,
  );

  if (
    readinessGaps.length === 0 &&
    dueFoundationTouches === 0 &&
    upcomingFoundationTouches === 0 &&
    capitalDeadlinesSoon === 0 &&
    procurementDeadlinesSoon === 0
  ) {
    return null;
  }

  return (
    <Section title="Pressure Points">
      <div className="border-2 border-bauhaus-black bg-white p-3">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">Attention Surface</div>
        <p className="mt-2 max-w-4xl text-sm font-medium leading-relaxed text-bauhaus-muted">
          What is blocking or time-sensitive across readiness, foundations, capital, and buyer timing.
        </p>

        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="border-2 border-bauhaus-red/25 bg-bauhaus-red/5 p-3">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">Readiness gaps</div>
            <div className="mt-2 text-2xl font-black text-bauhaus-black">{readinessGaps.length}</div>
            <p className="mt-2 line-clamp-3 text-sm font-medium leading-relaxed text-bauhaus-black">
              {readinessGaps.length > 0 ? readinessGaps[0] : 'No major readiness blocker currently flagged.'}
            </p>
            <Link
              href="#project-decision-brief"
              className="mt-3 inline-flex border-2 border-bauhaus-red/25 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red transition-colors hover:border-bauhaus-red hover:bg-bauhaus-red hover:text-white"
            >
              Open decision brief
            </Link>
          </div>

          <div className="border-2 border-money bg-money-light p-3">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-money">Foundation follow-up</div>
            <div className="mt-2 text-2xl font-black text-bauhaus-black">{dueFoundationTouches}</div>
            <p className="mt-2 line-clamp-3 text-sm font-medium leading-relaxed text-bauhaus-black">
              {dueFoundationTouches > 0
                ? `${dueFoundationTouches} follow-up${dueFoundationTouches === 1 ? '' : 's'} due now and ${upcomingFoundationTouches} due soon.`
                : `${upcomingFoundationTouches} follow-up${upcomingFoundationTouches === 1 ? '' : 's'} scheduled soon.`}
            </p>
            {dueFoundationLead ? (
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-bauhaus-muted">
                Lead: {dueFoundationLead.foundation.name}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {dueFoundationLead ? (
                <Link
                  href={`/foundations/${dueFoundationLead.foundation.id}`}
                  className="inline-flex border-2 border-money/30 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-money transition-colors hover:border-money hover:bg-money hover:text-white"
                >
                  Open foundation
                </Link>
              ) : null}
              <Link
                href="#project-foundations"
                className="inline-flex border-2 border-money/30 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-money transition-colors hover:border-money hover:bg-money hover:text-white"
              >
                Open foundation board
              </Link>
            </div>
          </div>

          <div className="border-2 border-bauhaus-blue bg-link-light p-3">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue">Capital timing</div>
            <div className="mt-2 text-2xl font-black text-bauhaus-black">{capitalDeadlinesSoon}</div>
            <p className="mt-2 line-clamp-3 text-sm font-medium leading-relaxed text-bauhaus-black">
              {capitalDeadlinesSoon > 0
                ? `${capitalDeadlinesSoon} capital route${capitalDeadlinesSoon === 1 ? '' : 's'} has a deadline in the next 30 days.`
                : 'No near-term capital deadline is currently flagged.'}
            </p>
            {capitalDeadlineLead ? (
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-bauhaus-muted">
                Lead: {capitalDeadlineLead.name}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {capitalDeadlineLead?.grant_opportunity_id ? (
                <Link
                  href={`/grants/${capitalDeadlineLead.grant_opportunity_id}`}
                  className="inline-flex border-2 border-bauhaus-blue/25 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
                >
                  Open grant
                </Link>
              ) : null}
              <Link
                href="#project-capital-routes"
                className="inline-flex border-2 border-bauhaus-blue/25 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
              >
                Open capital lane
              </Link>
            </div>
          </div>

          <div className="border-2 border-bauhaus-black/15 bg-bauhaus-canvas p-3">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">Buyer timing</div>
            <div className="mt-2 text-2xl font-black text-bauhaus-black">{procurementDeadlinesSoon}</div>
            <p className="mt-2 line-clamp-3 text-sm font-medium leading-relaxed text-bauhaus-black">
              {procurementDeadlinesSoon > 0
                ? `${procurementDeadlinesSoon} buyer or procurement route${procurementDeadlinesSoon === 1 ? '' : 's'} has a near-term deadline.`
                : 'No near-term buyer deadline is currently flagged.'}
            </p>
            {procurementDeadlineLead ? (
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-bauhaus-muted">
                Lead: {procurementDeadlineLead.name}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {procurementDeadlineLead?.grant_opportunity_id ? (
                <Link
                  href={`/grants/${procurementDeadlineLead.grant_opportunity_id}`}
                  className="inline-flex border-2 border-bauhaus-black/15 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
                >
                  Open grant
                </Link>
              ) : null}
              <Link
                href="#project-procurement-routes"
                className="inline-flex border-2 border-bauhaus-black/15 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
              >
                Open procurement lane
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

export function ProjectProcurementRoutesSection({
  project,
  pipeline,
}: {
  project: OrgProject;
  pipeline: OrgPipelineItem[];
}) {
  const metadata = project.metadata || {};
  const procurementRoutes = getObjectArray<ProcurementRoute>(metadata, 'procurement_routes');
  const procurementPipeline = pipeline.filter((item) =>
    ['commercial', 'corporate', 'government', 'partner'].includes(item.funder_type || ''),
  );
  const liveRoutes = procurementRoutes.filter((route) => ['live', 'priority', 'warm'].includes(route.stage || ''));
  const topRoute = [...procurementRoutes].sort((left, right) => routeStageRank(left.stage) - routeStageRank(right.stage))[0] || null;
  const governmentRoute = topGovernmentProcurement(procurementPipeline);
  const commercialRoute = topCommercialProcurement(procurementPipeline);
  const governmentCount = procurementPipeline.filter((item) => item.funder_type === 'government').length;
  const partnerCount = procurementPipeline.filter((item) => item.funder_type === 'partner').length;
  const commercialCount = procurementPipeline.filter((item) => ['commercial', 'corporate'].includes(item.funder_type || '')).length;
  const deadlineSoonCount = procurementPipeline.filter((item) => procurementDeadlineSoon(item.deadline)).length;

  if (procurementRoutes.length === 0 && procurementPipeline.length === 0) {
    return null;
  }

  return (
    <Section title="Buyer & Procurement Routes">
      <div className="space-y-4">
        <div className="border-2 border-bauhaus-black bg-white p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">
            Decision Surface
          </div>
          <p className="mt-2 max-w-4xl text-sm font-medium leading-relaxed text-bauhaus-muted">
            Most relevant buyer and procurement routes already shaping Goods delivery.
          </p>

          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <div className="border-2 border-money bg-money-light p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-money">Live routes</div>
              <div className="mt-2 text-2xl font-black text-bauhaus-black">{liveRoutes.length}</div>
            </div>
            <div className="border-2 border-bauhaus-blue bg-link-light p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue">Government buyers</div>
              <div className="mt-2 text-2xl font-black text-bauhaus-black">{governmentCount}</div>
            </div>
            <div className="border-2 border-bauhaus-black/15 bg-bauhaus-canvas p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">Commercial or partner</div>
              <div className="mt-2 text-2xl font-black text-bauhaus-black">{commercialCount + partnerCount}</div>
            </div>
            <div className="border-2 border-bauhaus-red/25 bg-bauhaus-red/5 p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">Deadlines soon</div>
              <div className="mt-2 text-2xl font-black text-bauhaus-black">{deadlineSoonCount}</div>
            </div>
          </div>

          {(topRoute || governmentRoute || commercialRoute) ? (
            <div className="mt-3 grid gap-3 xl:grid-cols-3">
              {topRoute ? (
                <div className="border-2 border-money bg-money-light p-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-money">Lead buyer route</div>
                  <div className="mt-2 text-base font-black leading-tight text-bauhaus-black">{topRoute.name || 'Unnamed route'}</div>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-bauhaus-muted">
                    {topRoute.counterpart || topRoute.route_type || 'Procurement route'}
                  </p>
                  {topRoute.next_move ? (
                    <p className="mt-3 line-clamp-3 text-sm font-medium leading-relaxed text-bauhaus-black">{topRoute.next_move}</p>
                  ) : topRoute.why_it_matters ? (
                    <p className="mt-3 line-clamp-3 text-sm font-medium leading-relaxed text-bauhaus-black">{topRoute.why_it_matters}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href="#project-procurement-routes"
                      className="inline-flex border-2 border-money/30 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-money transition-colors hover:border-money hover:bg-money hover:text-white"
                    >
                      Open procurement lane
                    </Link>
                  </div>
                </div>
              ) : null}

              {governmentRoute ? (
                <div className="border-2 border-bauhaus-blue bg-link-light p-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue">Top government path</div>
                  <div className="mt-2 text-base font-black leading-tight text-bauhaus-black">{governmentRoute.name}</div>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-bauhaus-muted">
                    {governmentRoute.funder || 'Government buyer'}
                  </p>
                  {governmentRoute.notes ? (
                    <p className="mt-3 line-clamp-3 text-sm font-medium leading-relaxed text-bauhaus-black">
                      {governmentRoute.notes.length > 180 ? `${governmentRoute.notes.slice(0, 177)}…` : governmentRoute.notes}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {governmentRoute.grant_opportunity_id ? (
                      <Link
                        href={`/grants/${governmentRoute.grant_opportunity_id}`}
                        className="inline-flex border-2 border-bauhaus-blue/25 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
                      >
                        Open grant
                      </Link>
                    ) : null}
                    <Link
                      href="#project-pipeline"
                      className="inline-flex border-2 border-bauhaus-black/15 bg-bauhaus-canvas px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
                    >
                      Open pipeline
                    </Link>
                  </div>
                </div>
              ) : null}

              {commercialRoute ? (
                <div className="border-2 border-bauhaus-red/25 bg-bauhaus-red/5 p-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">Top commercial path</div>
                  <div className="mt-2 text-base font-black leading-tight text-bauhaus-black">{commercialRoute.name}</div>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-bauhaus-muted">
                    {commercialRoute.funder || 'Commercial or partner route'}
                  </p>
                  {commercialRoute.notes ? (
                    <p className="mt-3 line-clamp-3 text-sm font-medium leading-relaxed text-bauhaus-black">
                      {commercialRoute.notes.length > 180 ? `${commercialRoute.notes.slice(0, 177)}…` : commercialRoute.notes}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {commercialRoute.grant_opportunity_id ? (
                      <Link
                        href={`/grants/${commercialRoute.grant_opportunity_id}`}
                        className="inline-flex border-2 border-bauhaus-red/25 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red transition-colors hover:border-bauhaus-red hover:bg-bauhaus-red hover:text-white"
                      >
                        Open grant
                      </Link>
                    ) : null}
                    <Link
                      href="#project-pipeline"
                      className="inline-flex border-2 border-bauhaus-black/15 bg-bauhaus-canvas px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
                    >
                      Open pipeline
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {procurementRoutes.length > 0 ? (
            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              {procurementRoutes.map((route) => (
                <div key={`${route.name || 'route'}-${route.counterpart || 'counterpart'}`} className="border-2 border-bauhaus-black/10 bg-bauhaus-canvas p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
                        {route.route_type || 'Procurement route'}
                        {route.counterpart ? ` · ${route.counterpart}` : ''}
                      </div>
                      <div className="mt-1 text-base font-black leading-tight text-bauhaus-black">{route.name || 'Unnamed route'}</div>
                    </div>
                    <span className={`border-2 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${routeTone(route.stage)}`}>
                      {routeLabel(route.stage)}
                    </span>
                  </div>
                  {route.why_it_matters ? (
                    <p className="mt-3 line-clamp-3 text-sm font-medium leading-relaxed text-bauhaus-black">{route.why_it_matters}</p>
                  ) : null}
                  {route.next_move ? (
                    <div className="mt-3 border-2 border-bauhaus-black/10 bg-white p-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-muted">Next move</div>
                      <p className="mt-1 line-clamp-3 text-sm font-medium leading-relaxed text-bauhaus-black">{route.next_move}</p>
                    </div>
                  ) : null}
                  {route.evidence ? (
                    <div className="mt-3 text-xs font-medium leading-relaxed text-bauhaus-muted">
                      Evidence: {route.evidence}
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href="/social-enterprises"
                      className="inline-flex border-2 border-bauhaus-black/15 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
                    >
                      Open workspace
                    </Link>
                    <Link
                      href="#project-pipeline"
                      className="inline-flex border-2 border-bauhaus-black/15 bg-bauhaus-canvas px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
                    >
                      Open pipeline
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {procurementPipeline.length > 0 ? (
            <div className="mt-3 border-2 border-bauhaus-black/10 bg-white p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">Tracked procurement routes already in CivicGraph</div>
              <div className="mt-3 grid gap-3">
                {procurementPipeline.slice(0, 8).map((item) => (
                  <div key={item.id} className="border-2 border-bauhaus-black/10 bg-bauhaus-canvas p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-black text-bauhaus-black">{item.name}</div>
                        <div className="mt-1 text-xs font-medium text-bauhaus-muted">
                          {item.funder || 'No counterparty listed'}
                          {item.amount_display ? ` · ${item.amount_display}` : ''}
                        </div>
                        {item.notes ? (
                          <p className="mt-2 line-clamp-3 text-sm font-medium leading-relaxed text-bauhaus-muted">
                            {item.notes.length > 180 ? `${item.notes.slice(0, 177)}…` : item.notes}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {item.funder_type ? (
                          <span className="border-2 border-bauhaus-black/10 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-black">
                            {item.funder_type}
                          </span>
                        ) : null}
                        <StatusBadge status={item.status} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('en-AU');
}

function highestFoundationLead(rows: OrgProjectFoundationPortfolioRow[]) {
  return [...rows].sort((left, right) => {
    const touchDelta =
      new Date(left.next_touch_at || '9999-12-31').getTime() - new Date(right.next_touch_at || '9999-12-31').getTime();
    if (touchDelta !== 0) return touchDelta;
    return (right.fit_score ?? -1) - (left.fit_score ?? -1);
  })[0] || null;
}

function topCapitalPipeline(rows: OrgPipelineItem[]) {
  return (
    [...rows]
      .filter((item) => item.funder_type === 'foundation' || item.funder_type === 'government')
      .sort((left, right) => {
        if (left.status === 'upcoming' && right.status !== 'upcoming') return -1;
        if (left.status !== 'upcoming' && right.status === 'upcoming') return 1;
        return (right.amount_numeric ?? 0) - (left.amount_numeric ?? 0);
      })[0] || null
  );
}

function topProcurementPipeline(rows: OrgPipelineItem[]) {
  return (
    [...rows]
      .filter((item) => ['commercial', 'corporate', 'partner', 'government'].includes(item.funder_type || ''))
      .sort((left, right) => {
        const score = (item: OrgPipelineItem) => {
          const text = `${item.name} ${item.notes || ''}`.toLowerCase();
          let value = 0;
          if (text.includes('procurement')) value += 3;
          if (text.includes('housing')) value += 3;
          if (text.includes('compliance')) value += 2;
          if (text.includes('platform')) value += 2;
          if (text.includes('buyer')) value += 2;
          if ((item.funder_type || '') === 'government') value += 1;
          return value;
        };
        return score(right) - score(left);
      })[0] || null
  );
}

export function ProjectOperatingQueueSection({
  project,
  pipeline,
  foundationPortfolio,
}: {
  project: OrgProject;
  pipeline: OrgPipelineItem[];
  foundationPortfolio: OrgProjectFoundationPortfolioRow[];
}) {
  const goodsProject = isGoodsProject(project);
  const foundationLead = highestFoundationLead(foundationPortfolio);
  const capitalLead = topCapitalPipeline(pipeline);
  const procurementLead = topProcurementPipeline(pipeline);

  if (!foundationLead && !capitalLead && !procurementLead) {
    return null;
  }

  return (
    <Section title="Operating Queue">
      <div className="border-2 border-bauhaus-black bg-white p-3">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">
          Next Moves
        </div>
        <p className="mt-2 max-w-4xl text-sm font-medium leading-relaxed text-bauhaus-muted">
          Strongest live moves across foundations, capital, and procurement.
        </p>

        <div className="mt-3 grid gap-3 xl:grid-cols-3">
          {foundationLead ? (
            <div className="border-2 border-money bg-money-light p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-money">Foundation move</div>
              <div className="mt-2 text-base font-black leading-tight text-bauhaus-black">{foundationLead.foundation.name}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge status={foundationLead.engagement_status} />
                {foundationLead.next_touch_at ? (
                  <span className="border-2 border-money/30 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-money">
                    Next {formatDateLabel(foundationLead.next_touch_at)}
                  </span>
                ) : null}
              </div>
              {foundationLead.next_step ? (
                <p className="mt-3 line-clamp-3 text-sm font-medium leading-relaxed text-bauhaus-black">{foundationLead.next_step}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/foundations/${foundationLead.foundation.id}`}
                  className="inline-flex border-2 border-money/30 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-money transition-colors hover:border-money hover:bg-money hover:text-white"
                >
                  Open foundation
                </Link>
                <Link
                  href="#project-foundations"
                  className="inline-flex border-2 border-money/30 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-money transition-colors hover:border-money hover:bg-money hover:text-white"
                >
                  Open foundation board
                </Link>
              </div>
            </div>
          ) : null}

          {capitalLead ? (
            <div className="border-2 border-bauhaus-blue bg-link-light p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue">Capital move</div>
              <div className="mt-2 text-base font-black leading-tight text-bauhaus-black">{capitalLead.name}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge status={capitalLead.status} />
                {capitalLead.amount_display ? (
                  <span className="border-2 border-bauhaus-blue/25 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-blue">
                    {capitalLead.amount_display}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-bauhaus-muted">
                {capitalLead.funder || 'No funder listed'}
              </p>
              {capitalLead.notes ? (
                <p className="mt-3 line-clamp-3 text-sm font-medium leading-relaxed text-bauhaus-black">
                  {capitalLead.notes.length > 180 ? `${capitalLead.notes.slice(0, 177)}…` : capitalLead.notes}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {capitalLead.grant_opportunity_id ? (
                  <Link
                    href={`/grants/${capitalLead.grant_opportunity_id}`}
                    className="inline-flex border-2 border-bauhaus-blue/25 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
                  >
                    Open grant
                  </Link>
                ) : null}
                {goodsProject ? (
                  <a
                    href="https://www.goodsoncountry.com/admin/qbe-program"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex border-2 border-bauhaus-blue/25 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
                  >
                    Open QBE Program
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}

          {procurementLead ? (
            <div className="border-2 border-bauhaus-red/25 bg-bauhaus-red/5 p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">Procurement move</div>
              <div className="mt-2 text-base font-black leading-tight text-bauhaus-black">{procurementLead.name}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge status={procurementLead.status} />
                {procurementLead.funder_type ? (
                  <span className="border-2 border-bauhaus-red/25 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-red">
                    {procurementLead.funder_type}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-bauhaus-muted">
                {procurementLead.funder || 'No counterparty listed'}
              </p>
              {procurementLead.notes ? (
                <p className="mt-3 line-clamp-3 text-sm font-medium leading-relaxed text-bauhaus-black">
                  {procurementLead.notes.length > 180 ? `${procurementLead.notes.slice(0, 177)}…` : procurementLead.notes}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {procurementLead.grant_opportunity_id ? (
                  <Link
                    href={`/grants/${procurementLead.grant_opportunity_id}`}
                    className="inline-flex border-2 border-bauhaus-red/25 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red transition-colors hover:border-bauhaus-red hover:bg-bauhaus-red hover:text-white"
                  >
                    Open grant
                  </Link>
                ) : null}
                <Link
                  href="#project-procurement-routes"
                  className="inline-flex border-2 border-bauhaus-red/25 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red transition-colors hover:border-bauhaus-red hover:bg-bauhaus-red hover:text-white"
                >
                  Open procurement lane
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

function activeFoundationRows(rows: OrgProjectFoundationPortfolioRow[]) {
  return [...rows]
    .filter((row) => ['ready_to_approach', 'approached', 'meeting', 'proposal'].includes(row.engagement_status))
    .sort((left, right) => {
      const statusRank = (value: OrgProjectFoundationPortfolioRow['engagement_status']) => {
        if (value === 'proposal') return 0;
        if (value === 'meeting') return 1;
        if (value === 'approached') return 2;
        if (value === 'ready_to_approach') return 3;
        return 4;
      };
      const rankDelta = statusRank(left.engagement_status) - statusRank(right.engagement_status);
      if (rankDelta !== 0) return rankDelta;
      return (right.fit_score ?? -1) - (left.fit_score ?? -1);
    })
    .slice(0, 4);
}

function capitalPipelineRows(rows: OrgPipelineItem[]) {
  return [...rows]
    .filter((item) => item.funder_type === 'foundation' || item.funder_type === 'government')
    .sort((left, right) => {
      const statusRank = (value: string) => {
        if (value === 'submitted') return 0;
        if (value === 'upcoming') return 1;
        if (value === 'prospect') return 2;
        return 3;
      };
      const rankDelta = statusRank(left.status) - statusRank(right.status);
      if (rankDelta !== 0) return rankDelta;
      return (right.amount_numeric ?? 0) - (left.amount_numeric ?? 0);
    })
    .slice(0, 4);
}

function dueSoonCount(rows: OrgProjectFoundationPortfolioRow[]) {
  const in14Days = Date.now() + 14 * 24 * 60 * 60 * 1000;
  return rows.filter((row) => {
    if (!row.next_touch_at) return false;
    const then = new Date(row.next_touch_at).getTime();
    return then <= in14Days;
  }).length;
}

export function ProjectCapitalRoutesSection({
  project,
  foundationPortfolio,
  pipeline,
}: {
  project: OrgProject;
  foundationPortfolio: OrgProjectFoundationPortfolioRow[];
  pipeline: OrgPipelineItem[];
}) {
  const goodsProject = isGoodsProject(project);
  const activeFoundations = activeFoundationRows(foundationPortfolio);
  const capitalRoutes = capitalPipelineRows(pipeline);
  const activeConversations = foundationPortfolio.filter((row) =>
    ['approached', 'meeting', 'proposal'].includes(row.engagement_status),
  ).length;
  const readyNow = foundationPortfolio.filter((row) => row.engagement_status === 'ready_to_approach').length;
  const dueSoon = dueSoonCount(foundationPortfolio);

  if (activeFoundations.length === 0 && capitalRoutes.length === 0) {
    return null;
  }

  return (
    <Section title="Funder & Capital Routes">
      <div className="space-y-4">
        <div className="border-2 border-bauhaus-black bg-white p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">
            Capital Surface
          </div>
          <p className="mt-2 max-w-4xl text-sm font-medium leading-relaxed text-bauhaus-muted">
            Warm funders and capital paths already in motion for this project.
          </p>

          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <div className="border-2 border-money bg-money-light p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-money">Ready now</div>
              <div className="mt-2 text-2xl font-black text-bauhaus-black">{readyNow}</div>
            </div>
            <div className="border-2 border-bauhaus-blue bg-link-light p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue">Active now</div>
              <div className="mt-2 text-2xl font-black text-bauhaus-black">{activeConversations}</div>
            </div>
            <div className="border-2 border-bauhaus-black/15 bg-bauhaus-canvas p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">Capital routes</div>
              <div className="mt-2 text-2xl font-black text-bauhaus-black">{capitalRoutes.length}</div>
            </div>
            <div className="border-2 border-bauhaus-red/25 bg-bauhaus-red/5 p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">Due soon</div>
              <div className="mt-2 text-2xl font-black text-bauhaus-black">{dueSoon}</div>
            </div>
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            {activeFoundations.length > 0 ? (
              <div className="border-2 border-bauhaus-black/10 bg-bauhaus-canvas p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
                  Strongest saved foundation relationships
                </div>
                <div className="mt-3 space-y-3">
                  {activeFoundations.map((row) => (
                    <div key={row.id} className="border-2 border-bauhaus-black/10 bg-white p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-black text-bauhaus-black">{row.foundation.name}</div>
                          {row.fit_summary ? (
                            <p className="mt-1 line-clamp-3 text-sm font-medium leading-relaxed text-bauhaus-muted">
                              {row.fit_summary}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge status={row.engagement_status} />
                          {row.fit_score != null ? (
                            <span className="border-2 border-bauhaus-black/10 bg-bauhaus-canvas px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-black">
                              Fit {row.fit_score}
                            </span>
                          ) : null}
                        </div>
                      </div>
                  {row.next_step ? (
                    <div className="mt-3 border-2 border-bauhaus-black/10 bg-bauhaus-canvas p-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-muted">Next move</div>
                      <p className="mt-1 line-clamp-3 text-sm font-medium leading-relaxed text-bauhaus-black">{row.next_step}</p>
                    </div>
                  ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href={`/foundations/${row.foundation.id}`}
                          className="inline-flex border-2 border-bauhaus-black/15 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
                        >
                          Open foundation
                        </Link>
                        <Link
                          href="#project-foundations"
                          className="inline-flex border-2 border-bauhaus-black/15 bg-bauhaus-canvas px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
                        >
                          Open foundation board
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {capitalRoutes.length > 0 ? (
              <div className="border-2 border-bauhaus-black/10 bg-bauhaus-canvas p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
                  Live capital routes already in pipeline
                </div>
                <div className="mt-3 space-y-3">
                  {capitalRoutes.map((item) => (
                    <div key={item.id} className="border-2 border-bauhaus-black/10 bg-white p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-black text-bauhaus-black">{item.name}</div>
                          <div className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-bauhaus-muted">
                            {item.funder || 'No funder listed'}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge status={item.status} />
                          {item.amount_display ? (
                            <span className="border-2 border-bauhaus-black/10 bg-bauhaus-canvas px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-black">
                              {item.amount_display}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {item.notes ? (
                        <p className="mt-3 line-clamp-3 text-sm font-medium leading-relaxed text-bauhaus-muted">
                          {item.notes.length > 180 ? `${item.notes.slice(0, 177)}…` : item.notes}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.grant_opportunity_id ? (
                          <Link
                            href={`/grants/${item.grant_opportunity_id}`}
                            className="inline-flex border-2 border-bauhaus-black/15 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
                          >
                            Open grant
                          </Link>
                        ) : null}
                        {goodsProject ? (
                          <a
                            href="https://www.goodsoncountry.com/admin/qbe-program"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex border-2 border-bauhaus-black/15 bg-bauhaus-canvas px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
                          >
                            Open QBE Program
                          </a>
                        ) : null}
                        <Link
                          href="#project-pipeline"
                          className="inline-flex border-2 border-bauhaus-black/15 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
                        >
                          Open pipeline
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Section>
  );
}

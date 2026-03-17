'use client';

import { useState, useEffect } from 'react';
import type { IntakeUpdate } from './intake-chat';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types (mirror server-side IntakeIntelligence)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface IntelState {
  ideaSummary: string | null;
  problemStatement: string | null;
  issueAreas: string[];
  location: { state?: string; lga?: string; postcode?: string } | null;
  beneficiary: { cohort?: string; location?: string; demographics?: string } | null;
  recommendedEntityType: string | null;
  entityTypeRationale: string | null;
  entityFactors: Record<string, boolean> | null;
  landscapeOrgs: Array<{ name: string; gs_id?: string; relevance?: string }>;
  matchedGrants: Array<{ name: string; amount?: string; deadline?: string }>;
  matchedFoundations: Array<{ name: string; giving?: string }>;
  actionPlan: Array<{ step: string; description: string; timeline: string }>;
  draftEmail: string | null;
  phase: string;
}

const EMPTY_STATE: IntelState = {
  ideaSummary: null,
  problemStatement: null,
  issueAreas: [],
  location: null,
  beneficiary: null,
  recommendedEntityType: null,
  entityTypeRationale: null,
  entityFactors: null,
  landscapeOrgs: [],
  matchedGrants: [],
  matchedFoundations: [],
  actionPlan: [],
  draftEmail: null,
  phase: 'idea',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Entity type comparison card
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ENTITY_TYPE_INFO: Record<string, { label: string; color: string }> = {
  charity: { label: 'Registered Charity', color: 'border-emerald-500' },
  social_enterprise: { label: 'Social Enterprise', color: 'border-blue-500' },
  pty: { label: 'Company (PTY)', color: 'border-gray-500' },
  indigenous_corp: { label: 'Indigenous Corp (ORIC)', color: 'border-amber-500' },
  coop: { label: 'Co-operative', color: 'border-purple-500' },
};

function EntityTypeCard({ type, rationale }: { type: string; rationale: string | null }) {
  const info = ENTITY_TYPE_INFO[type] ?? { label: type, color: 'border-gray-300' };

  return (
    <div className={`border-l-4 ${info.color} bg-white border border-gray-200 rounded-sm p-4`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Recommended Structure</p>
      <p className="text-lg font-black text-bauhaus-black mt-1">{info.label}</p>
      {rationale && (
        <p className="text-xs text-gray-600 mt-2 leading-relaxed">{rationale}</p>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Community snapshot card
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function CommunitySnapshotCard({ location }: { location: { state?: string; lga?: string; postcode?: string } }) {
  const [snapshot, setSnapshot] = useState<{
    locality?: string;
    remoteness?: string;
    seifa_decile?: number;
    entity_count?: number;
    total_funding?: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!location.postcode) return;

    setLoading(true);
    // Fetch area profile via intake intelligence API
    fetch(`/api/start/area-profile?postcode=${location.postcode}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setSnapshot(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [location.postcode]);

  const locationLabel = [location.lga, location.state].filter(Boolean).join(', ') || location.postcode || 'Unknown';

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-sm p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Community Snapshot</p>
      <p className="text-sm font-black text-bauhaus-black mt-1">{locationLabel}</p>
      {loading && <p className="text-xs text-gray-400 mt-2 animate-pulse">Loading area data...</p>}
      {snapshot && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {snapshot.remoteness && (
            <MiniStat label="Remoteness" value={snapshot.remoteness} />
          )}
          {snapshot.seifa_decile && (
            <MiniStat
              label="Disadvantage"
              value={`Decile ${snapshot.seifa_decile}/10`}
              sub={snapshot.seifa_decile <= 3 ? 'High' : snapshot.seifa_decile <= 7 ? 'Moderate' : 'Low'}
            />
          )}
          {snapshot.entity_count != null && (
            <MiniStat label="Orgs in area" value={String(snapshot.entity_count)} />
          )}
          {snapshot.total_funding != null && (
            <MiniStat label="Total funding" value={formatMoney(snapshot.total_funding)} />
          )}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="text-sm font-black text-bauhaus-black">{value}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  );
}

function formatMoney(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Intelligence Panel
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function IntelligencePanel({
  intakeId,
  updates,
}: {
  intakeId: string;
  updates: IntakeUpdate[];
}) {
  const [state, setState] = useState<IntelState>(EMPTY_STATE);

  // Apply updates from chat
  useEffect(() => {
    if (updates.length === 0) return;

    setState(prev => {
      let next = { ...prev };
      for (const u of updates) {
        switch (u.type) {
          case 'phase_change':
            if (u.phase) next.phase = u.phase;
            break;
          case 'idea_extracted':
            if (u.idea_summary) next.ideaSummary = u.idea_summary;
            if (u.problem_statement) next.problemStatement = u.problem_statement;
            if (u.issue_areas) next.issueAreas = u.issue_areas;
            if (u.geographic_focus) next.location = u.geographic_focus;
            break;
          case 'beneficiary_extracted':
            if (u.target_beneficiary) next.beneficiary = u.target_beneficiary;
            break;
          case 'entity_recommended':
            if (u.recommended_entity_type) next.recommendedEntityType = u.recommended_entity_type;
            if (u.entity_type_rationale) next.entityTypeRationale = u.entity_type_rationale;
            if (u.factors) next.entityFactors = u.factors;
            break;
          case 'landscape_shown':
            if (u.orgs) next.landscapeOrgs = u.orgs;
            break;
          case 'funding_matched':
            if (u.grants) next.matchedGrants = u.grants;
            if (u.foundations) next.matchedFoundations = u.foundations;
            break;
          case 'plan_generated':
            if (u.action_plan) next.actionPlan = u.action_plan;
            if (u.draft_email) next.draftEmail = u.draft_email;
            break;
        }
      }
      return next;
    });
  }, [updates]);

  const hasAnything = state.ideaSummary || state.location || state.landscapeOrgs.length > 0 ||
    state.recommendedEntityType || state.matchedGrants.length > 0 || state.actionPlan.length > 0;

  return (
    <div className="h-full overflow-y-auto bg-gray-50 border-l border-gray-200">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="border-b border-gray-200 pb-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">
            Intelligence Panel
          </h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Live data matching as you talk
          </p>
        </div>

        {!hasAnything && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-400">
              Start talking about your idea and watch the intelligence build here.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <span className="w-2 h-2 bg-gray-300 rounded-full animate-pulse" />
              <span className="w-2 h-2 bg-gray-300 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
              <span className="w-2 h-2 bg-gray-300 rounded-full animate-pulse" style={{ animationDelay: '600ms' }} />
            </div>
          </div>
        )}

        {/* Idea summary */}
        {state.ideaSummary && (
          <div className="bg-white border border-gray-200 rounded-sm p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Your Idea</p>
            <p className="text-sm font-bold text-bauhaus-black mt-1">{state.ideaSummary}</p>
            {state.problemStatement && (
              <p className="text-xs text-gray-600 mt-2">{state.problemStatement}</p>
            )}
            {state.issueAreas.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {state.issueAreas.map(area => (
                  <span key={area} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-bold uppercase">
                    {area}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Community snapshot */}
        {state.location && (
          <CommunitySnapshotCard location={state.location} />
        )}

        {/* Beneficiary */}
        {state.beneficiary && (
          <div className="bg-white border border-gray-200 rounded-sm p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Who You Serve</p>
            {state.beneficiary.cohort && (
              <p className="text-sm font-bold text-bauhaus-black mt-1">{state.beneficiary.cohort}</p>
            )}
            {state.beneficiary.location && (
              <p className="text-xs text-gray-600 mt-1">{state.beneficiary.location}</p>
            )}
            {state.beneficiary.demographics && (
              <p className="text-xs text-gray-500 mt-1">{state.beneficiary.demographics}</p>
            )}
          </div>
        )}

        {/* Entity type recommendation */}
        {state.recommendedEntityType && (
          <EntityTypeCard
            type={state.recommendedEntityType}
            rationale={state.entityTypeRationale}
          />
        )}

        {/* Landscape orgs */}
        {state.landscapeOrgs.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-sm p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Existing Organisations ({state.landscapeOrgs.length})
            </p>
            <div className="mt-2 space-y-2">
              {state.landscapeOrgs.slice(0, 6).map((org, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-bauhaus-black rounded-full mt-1.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-bauhaus-black">{org.name}</p>
                    {org.relevance && (
                      <p className="text-[10px] text-gray-500">{org.relevance}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Matched grants */}
        {state.matchedGrants.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-sm p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
              Funding Matches ({state.matchedGrants.length})
            </p>
            <div className="mt-2 space-y-2">
              {state.matchedGrants.map((g, i) => (
                <div key={i} className="border-l-2 border-emerald-300 pl-3">
                  <p className="text-xs font-bold text-bauhaus-black">{g.name}</p>
                  <div className="flex gap-3 text-[10px] text-gray-500 mt-0.5">
                    {g.amount && <span>{g.amount}</span>}
                    {g.deadline && <span>Due: {g.deadline}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Matched foundations */}
        {state.matchedFoundations.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-sm p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-purple-600">
              Foundation Matches ({state.matchedFoundations.length})
            </p>
            <div className="mt-2 space-y-2">
              {state.matchedFoundations.map((f, i) => (
                <div key={i} className="border-l-2 border-purple-300 pl-3">
                  <p className="text-xs font-bold text-bauhaus-black">{f.name}</p>
                  {f.giving && (
                    <p className="text-[10px] text-gray-500">{f.giving}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action plan */}
        {state.actionPlan.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-sm p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-bauhaus-red">90-Day Action Plan</p>
            <div className="mt-3 space-y-3">
              {state.actionPlan.map((step, i) => (
                <div key={i} className="border-l-2 border-bauhaus-red pl-3">
                  <p className="text-xs font-bold text-bauhaus-black">{step.step}</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">{step.description}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{step.timeline}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Draft email */}
        {state.draftEmail && (
          <div className="bg-amber-50 border border-amber-200 rounded-sm p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Draft Outreach Email</p>
            <pre className="text-xs text-gray-700 mt-2 whitespace-pre-wrap font-sans leading-relaxed">
              {state.draftEmail}
            </pre>
            <button
              onClick={() => navigator.clipboard.writeText(state.draftEmail!)}
              className="mt-3 text-[10px] font-bold uppercase tracking-wider text-amber-700 hover:text-amber-900 transition-colors"
            >
              Copy to clipboard
            </button>
          </div>
        )}

        {/* View brief link */}
        {(state.phase === 'plan' || state.phase === 'complete') && (
          <a
            href={`/start/${intakeId}/brief`}
            target="_blank"
            className="block text-center bg-bauhaus-black text-white px-4 py-3 text-xs font-black uppercase tracking-widest
              hover:bg-gray-800 transition-colors"
          >
            View Full Project Brief
          </a>
        )}
      </div>
    </div>
  );
}

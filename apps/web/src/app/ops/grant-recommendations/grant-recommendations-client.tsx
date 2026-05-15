'use client';

import { useMemo, useState, useTransition } from 'react';
import { SlidePanel, SlidePanelHeader, SlidePanelBody } from '@/app/components/slide-panel';

export interface Recommendation {
  project_code: string;
  project_name: string;
  opportunity_id: string;
  opportunity_name: string;
  funder_name: string | null;
  deadline: string | null;
  min_grant_amount: number | null;
  max_grant_amount: number | null;
  is_national: boolean | null;
  jurisdictions: string[] | null;
  eligible_org_types: string[] | null;
  focus_areas: string[] | null;
  keywords: string[] | null;
  source_url: string | null;
  application_url: string | null;
  theme_score: number;
  geography_score: number;
  eligibility_score: number;
  timing_score: number;
  fit_score: number;
  is_strong_fit: boolean;
  flags: string[] | null;
}

export interface Decision {
  project_code: string;
  opportunity_id: string;
  decision: string;
  decided_at: string;
  notes: string | null;
  grant_opportunity_id?: string | null;
}

const DECISION_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'undecided', label: 'Undecided' },
  { value: 'pursuing', label: 'Pursuing' },
  { value: 'watching', label: 'Watching' },
  { value: 'applied', label: 'Applied' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'passed', label: 'Passed' },
] as const;

type DecisionFilter = (typeof DECISION_FILTERS)[number]['value'];

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export interface ProjectSummary {
  project_code: string;
  project_label: string;
  home_states: string[];
  total: number;
  strong_count: number;
  top_tier_count: number;
  max_score: number;
}

type DecisionState = 'pursuing' | 'watching' | 'passed' | 'applied' | 'submitted' | 'won' | 'lost';

const FLAG_LABELS: Record<string, { text: string; classes: string }> = {
  requires_dgr: { text: 'DGR req.', classes: 'bg-bauhaus-red text-white' },
  partner_required: { text: 'Partner req.', classes: 'bg-bauhaus-yellow text-bauhaus-black' },
  tight_deadline: { text: 'Tight', classes: 'bg-bauhaus-red text-white' },
  national: { text: 'National', classes: 'bg-bauhaus-blue text-white' },
  large_grant: { text: 'Large $', classes: 'bg-green-600 text-white' },
  small_grant: { text: 'Small $', classes: 'bg-gray-300 text-bauhaus-black' },
};

const DECISION_BADGES: Record<string, string> = {
  pursuing: 'bg-bauhaus-blue text-white',
  watching: 'bg-bauhaus-yellow text-bauhaus-black',
  passed: 'bg-gray-400 text-white',
  applied: 'bg-bauhaus-blue text-white',
  submitted: 'bg-bauhaus-blue text-white',
  won: 'bg-green-600 text-white',
  lost: 'bg-bauhaus-red text-white',
};

function formatAmount(min: number | null, max: number | null): string {
  if (min != null && max != null) return `$${min.toLocaleString()}–$${max.toLocaleString()}`;
  if (max != null) return `≤ $${max.toLocaleString()}`;
  if (min != null) return `≥ $${min.toLocaleString()}`;
  return '—';
}

function formatDeadline(deadline: string | null): string {
  if (!deadline) return 'Rolling';
  const d = new Date(deadline);
  const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const dateStr = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  if (days < 0) return `${dateStr} (past)`;
  if (days === 0) return `${dateStr} (today)`;
  if (days < 14) return `${dateStr} (${days}d)`;
  return dateStr;
}

export function GrantRecommendationsClient({
  recommendations,
  decisions,
  summary,
}: {
  recommendations: Recommendation[];
  decisions: Decision[];
  summary: ProjectSummary[];
}) {
  const [filterProject, setFilterProject] = useState<string>('all');
  const [strongFitOnly, setStrongFitOnly] = useState(true);
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>('all');
  const [decisionMap, setDecisionMap] = useState<Map<string, Decision>>(
    () => new Map(decisions.map((d) => [`${d.project_code}|${d.opportunity_id}`, d]))
  );
  const [isPending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);

  const previewRec = useMemo(() => {
    if (!previewKey) return null;
    return recommendations.find(
      (r) => `${r.project_code}|${r.opportunity_id}` === previewKey
    ) ?? null;
  }, [previewKey, recommendations]);
  const previewDecision = previewKey ? decisionMap.get(previewKey) ?? null : null;

  async function syncToNotion(includeUndecided: boolean) {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/ops/grant-recommendations/sync-notion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ include_undecided: includeUndecided }),
      });
      const body = await res.json();
      if (!res.ok) {
        setSyncResult(`Error: ${body.error ?? res.statusText}`);
      } else {
        setSyncResult(
          `Synced: ${body.created} created · ${body.updated} updated · ${body.skipped} skipped · ${body.failed} failed`
        );
      }
    } catch (err) {
      setSyncResult(`Error: ${(err as Error).message}`);
    } finally {
      setSyncing(false);
    }
  }

  // Count per decision state for the filter UI badges.
  const decisionCounts = useMemo(() => {
    const counts: Record<string, number> = { all: recommendations.length, undecided: 0 };
    for (const r of recommendations) {
      const d = decisionMap.get(`${r.project_code}|${r.opportunity_id}`);
      if (!d) counts.undecided = (counts.undecided ?? 0) + 1;
      else counts[d.decision] = (counts[d.decision] ?? 0) + 1;
    }
    return counts;
  }, [recommendations, decisionMap]);

  const filtered = useMemo(() => {
    return recommendations.filter((r) => {
      if (filterProject !== 'all' && r.project_code !== filterProject) return false;
      if (strongFitOnly && !r.is_strong_fit) return false;
      if (decisionFilter !== 'all') {
        const d = decisionMap.get(`${r.project_code}|${r.opportunity_id}`);
        if (decisionFilter === 'undecided') {
          if (d) return false;
        } else {
          if (!d || d.decision !== decisionFilter) return false;
        }
      }
      return true;
    });
  }, [recommendations, filterProject, strongFitOnly, decisionFilter, decisionMap]);

  const byProject = useMemo(() => {
    const m = new Map<string, Recommendation[]>();
    for (const r of filtered) {
      if (!m.has(r.project_code)) m.set(r.project_code, []);
      m.get(r.project_code)!.push(r);
    }
    return m;
  }, [filtered]);

  async function setDecision(rec: Recommendation, decision: DecisionState) {
    const key = `${rec.project_code}|${rec.opportunity_id}`;
    setPendingKey(key);
    startTransition(async () => {
      try {
        const res = await fetch('/api/ops/grant-recommendations/decide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_code: rec.project_code,
            opportunity_id: rec.opportunity_id,
            decision,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const body = await res.json();
        setDecisionMap((prev) => {
          const next = new Map(prev);
          next.set(key, body.decision as Decision);
          return next;
        });
        if (body.tracker_synced) {
          console.info(`Synced to /tracker as ${body.decision.decision}`);
        }
      } catch (err) {
        console.error('decision failed', err);
        alert('Decision write failed — check console');
      } finally {
        setPendingKey(null);
      }
    });
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight">
            Grant Recommendations
          </h1>
          <div className="text-sm text-bauhaus-muted mt-1">
            Fit-scored opportunities × 6 ACT projects. Decisions sync to ACT Notion Opportunities pipeline.
          </div>
          {syncResult && (
            <div className="mt-2 px-3 py-1.5 text-xs font-mono bg-bauhaus-canvas border-2 border-bauhaus-black inline-block">
              {syncResult}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-xs text-bauhaus-muted font-mono">
            {recommendations.length} total · {recommendations.filter((r) => r.is_strong_fit).length} strong fits
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => syncToNotion(false)}
              disabled={syncing}
              className="px-3 py-1.5 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black bg-bauhaus-black text-white hover:bg-bauhaus-red disabled:opacity-50"
              title="Push decided rows to Notion Opportunities DB"
            >
              {syncing ? 'Syncing…' : 'Sync decided → Notion'}
            </button>
            <button
              onClick={() => syncToNotion(true)}
              disabled={syncing}
              className="px-3 py-1.5 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black bg-white text-bauhaus-black hover:bg-bauhaus-canvas disabled:opacity-50"
              title="Push all strong fits (including undecided) to Notion"
            >
              + Undecided
            </button>
          </div>
        </div>
      </div>

      {/* Project summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {summary.map((s) => (
          <button
            key={s.project_code}
            onClick={() => setFilterProject(filterProject === s.project_code ? 'all' : s.project_code)}
            className={`border-4 p-3 text-left transition-colors ${
              filterProject === s.project_code
                ? 'border-bauhaus-red bg-bauhaus-red/5'
                : 'border-bauhaus-black bg-bauhaus-canvas hover:bg-white'
            }`}
          >
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted">
              {s.project_code}
            </div>
            <div className="text-2xl font-black text-bauhaus-black tabular-nums mt-1">
              {s.strong_count}
            </div>
            <div className="text-[10px] text-bauhaus-muted uppercase tracking-wider mt-1">
              strong · {s.top_tier_count} top · max {s.max_score}
            </div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-4 mb-6 space-y-3">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs font-black uppercase tracking-widest">Project:</label>
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="border-2 border-bauhaus-black bg-white px-2 py-1 text-sm font-mono"
            >
              <option value="all">All</option>
              {summary.map((s) => (
                <option key={s.project_code} value={s.project_code}>
                  {s.project_code}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest cursor-pointer">
            <input
              type="checkbox"
              checked={strongFitOnly}
              onChange={(e) => setStrongFitOnly(e.target.checked)}
              className="w-4 h-4 border-2 border-bauhaus-black"
            />
            Strong fits only
          </label>
          <div className="ml-auto text-xs font-mono text-bauhaus-muted">
            Showing {filtered.length} of {recommendations.length}
          </div>
        </div>

        {/* Decision history filter chips */}
        <div className="flex flex-wrap gap-1.5 items-center pt-2 border-t-2 border-bauhaus-black/20">
          <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mr-2">
            Decision:
          </span>
          {DECISION_FILTERS.map((f) => {
            const count = decisionCounts[f.value] ?? 0;
            const active = decisionFilter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setDecisionFilter(f.value)}
                className={`px-2 py-1 text-[10px] font-black uppercase tracking-wider border-2 transition-colors ${
                  active
                    ? 'border-bauhaus-red bg-bauhaus-red text-white'
                    : 'border-bauhaus-black bg-white text-bauhaus-black hover:bg-bauhaus-canvas'
                }`}
              >
                {f.label} <span className="font-mono">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Project lanes */}
      {byProject.size === 0 && (
        <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-8 text-center">
          <div className="text-sm font-black uppercase tracking-widest text-bauhaus-muted">
            No recommendations match these filters.
          </div>
        </div>
      )}

      <SlidePanel
        open={previewRec !== null}
        onClose={() => setPreviewKey(null)}
        width={520}
      >
        {previewRec && (
          <>
            <SlidePanelHeader
              onClose={() => setPreviewKey(null)}
              href={previewDecision?.grant_opportunity_id ? `/grants/${previewDecision.grant_opportunity_id}` : undefined}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                  {previewRec.project_code}
                </span>
                <span
                  className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                    previewRec.fit_score >= 80
                      ? 'bg-green-600 text-white'
                      : previewRec.fit_score >= 60
                        ? 'bg-bauhaus-yellow text-bauhaus-black'
                        : 'bg-gray-200 text-bauhaus-black'
                  }`}
                >
                  Fit {previewRec.fit_score}
                </span>
                {previewDecision && (
                  <span
                    className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                      DECISION_BADGES[previewDecision.decision] ?? 'bg-gray-300 text-bauhaus-black'
                    }`}
                  >
                    {previewDecision.decision}
                  </span>
                )}
              </div>
              <h2 className="text-base font-black text-bauhaus-black leading-tight mt-1 truncate">
                {previewRec.opportunity_name}
              </h2>
            </SlidePanelHeader>
            <SlidePanelBody>
              <div className="space-y-5 text-sm">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-1">
                    Funder
                  </div>
                  <div className="font-medium">{previewRec.funder_name ?? '—'}</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-1">
                      Deadline
                    </div>
                    <div className="font-mono">{formatDeadline(previewRec.deadline)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-1">
                      Amount
                    </div>
                    <div className="font-mono">
                      {formatAmount(previewRec.min_grant_amount, previewRec.max_grant_amount)}
                    </div>
                  </div>
                </div>

                {/* Fit breakdown */}
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-2">
                    Fit breakdown · {previewRec.fit_score}/100
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Theme', value: previewRec.theme_score, max: 50 },
                      { label: 'Geo', value: previewRec.geography_score, max: 15 },
                      { label: 'Elig', value: previewRec.eligibility_score, max: 20 },
                      { label: 'Timing', value: previewRec.timing_score, max: 15 },
                    ].map((d) => (
                      <div key={d.label} className="border-2 border-bauhaus-black p-2">
                        <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">
                          {d.label}
                        </div>
                        <div className="text-lg font-black tabular-nums">
                          {d.value}
                          <span className="text-[10px] font-mono text-bauhaus-muted ml-0.5">/{d.max}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Flags */}
                {previewRec.flags && previewRec.flags.length > 0 && (
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-2">
                      Flags
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {previewRec.flags.map((f) => {
                        const lab = FLAG_LABELS[f] ?? { text: f, classes: 'bg-gray-200 text-bauhaus-black' };
                        return (
                          <span
                            key={f}
                            className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${lab.classes}`}
                          >
                            {lab.text}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Focus areas */}
                {previewRec.focus_areas && previewRec.focus_areas.length > 0 && (
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-2">
                      Focus areas
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {previewRec.focus_areas.map((fa) => (
                        <span key={fa} className="px-2 py-0.5 text-[11px] bg-bauhaus-canvas border border-bauhaus-black/30">
                          {fa}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Keywords */}
                {previewRec.keywords && previewRec.keywords.length > 0 && (
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-2">
                      Keywords
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {previewRec.keywords.map((k) => (
                        <span key={k} className="px-2 py-0.5 text-[11px] bg-bauhaus-canvas border border-bauhaus-black/30">
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Jurisdictions / eligible org types */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-1">
                      Jurisdictions
                    </div>
                    <div className="text-xs font-mono">
                      {previewRec.is_national
                        ? 'National'
                        : (previewRec.jurisdictions ?? []).join(', ') || '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-1">
                      Eligible org types
                    </div>
                    <div className="text-xs font-mono">
                      {(previewRec.eligible_org_types ?? []).join(', ') || '—'}
                    </div>
                  </div>
                </div>

                {/* Links */}
                <div className="flex gap-2 flex-wrap pt-2 border-t-2 border-bauhaus-black/20">
                  {previewRec.source_url && (
                    <a
                      href={previewRec.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black bg-white hover:bg-bauhaus-canvas"
                    >
                      Funder page ↗
                    </a>
                  )}
                  {previewRec.application_url && previewRec.application_url !== previewRec.source_url && (
                    <a
                      href={previewRec.application_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black bg-white hover:bg-bauhaus-canvas"
                    >
                      Apply form ↗
                    </a>
                  )}
                </div>

                {/* Decision history */}
                {previewDecision && (
                  <div className="pt-2 border-t-2 border-bauhaus-black/20">
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-2">
                      Decision history
                    </div>
                    <div className="text-xs space-y-1">
                      <div>
                        <span className="font-black uppercase">{previewDecision.decision}</span>
                        <span className="text-bauhaus-muted ml-2 font-mono">
                          {timeAgo(previewDecision.decided_at)}
                        </span>
                      </div>
                      {previewDecision.grant_opportunity_id && (
                        <div className="text-bauhaus-muted">
                          Synced to /tracker as a saved grant
                        </div>
                      )}
                      {previewDecision.notes && (
                        <div className="text-bauhaus-muted italic">
                          "{previewDecision.notes}"
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-1 pt-3 border-t-2 border-bauhaus-black/20">
                  <button
                    onClick={() => setDecision(previewRec, 'pursuing')}
                    disabled={isPending}
                    className="flex-1 px-3 py-2 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black bg-bauhaus-blue text-white hover:bg-bauhaus-black disabled:opacity-50"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => setDecision(previewRec, 'watching')}
                    disabled={isPending}
                    className="flex-1 px-3 py-2 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black bg-bauhaus-yellow text-bauhaus-black hover:bg-bauhaus-black hover:text-white disabled:opacity-50"
                  >
                    Watch
                  </button>
                  <button
                    onClick={() => setDecision(previewRec, 'passed')}
                    disabled={isPending}
                    className="flex-1 px-3 py-2 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black bg-white text-bauhaus-black hover:bg-bauhaus-black hover:text-white disabled:opacity-50"
                  >
                    Pass
                  </button>
                </div>
              </div>
            </SlidePanelBody>
          </>
        )}
      </SlidePanel>

      {Array.from(byProject.entries()).map(([projectCode, recs]) => {
        const s = summary.find((x) => x.project_code === projectCode);
        return (
          <section key={projectCode} className="mb-10">
            <div className="border-b-4 border-bauhaus-black pb-2 mb-4 flex items-baseline justify-between">
              <h2 className="text-lg font-black text-bauhaus-black uppercase tracking-tight">
                {projectCode}
                {s?.project_label && (
                  <span className="ml-3 text-sm text-bauhaus-muted normal-case font-medium tracking-normal">
                    {s.project_label}
                  </span>
                )}
              </h2>
              <div className="text-xs font-mono text-bauhaus-muted">
                {recs.length} shown
              </div>
            </div>

            <div className="space-y-2">
              {recs.map((rec) => {
                const key = `${rec.project_code}|${rec.opportunity_id}`;
                const decision = decisionMap.get(key);
                const isLoading = pendingKey === key && isPending;
                return (
                  <div
                    key={rec.opportunity_id}
                    className="border-4 border-bauhaus-black bg-white p-4 grid grid-cols-12 gap-4 items-center"
                  >
                    <div className="col-span-12 md:col-span-5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => setPreviewKey(key)}
                          className="font-black text-bauhaus-black hover:text-bauhaus-blue text-sm leading-tight text-left underline-offset-4 hover:underline cursor-pointer"
                          title="Open details"
                        >
                          {rec.opportunity_name}
                        </button>
                        {rec.source_url && (
                          <a
                            href={rec.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-mono text-bauhaus-muted hover:text-bauhaus-blue"
                            title="Open funder page"
                            onClick={(e) => e.stopPropagation()}
                          >
                            ↗ funder
                          </a>
                        )}
                        {decision && (
                          <>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                                DECISION_BADGES[decision.decision] ?? 'bg-gray-300 text-bauhaus-black'
                              }`}
                            >
                              {decision.decision}
                            </span>
                            <span className="text-[10px] font-mono text-bauhaus-muted">
                              {timeAgo(decision.decided_at)}
                            </span>
                            {decision.grant_opportunity_id && (
                              <a
                                href="/tracker"
                                className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 border-2 border-bauhaus-blue text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
                                title="Open in /tracker"
                              >
                                Tracker ↗
                              </a>
                            )}
                          </>
                        )}
                      </div>
                      <div className="text-xs text-bauhaus-muted mt-1">
                        {rec.funder_name ?? 'Unknown funder'}
                      </div>
                      <div className="flex gap-1 flex-wrap mt-2">
                        {(rec.flags ?? []).map((f) => {
                          const lab = FLAG_LABELS[f] ?? { text: f, classes: 'bg-gray-200 text-bauhaus-black' };
                          return (
                            <span
                              key={f}
                              className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${lab.classes}`}
                            >
                              {lab.text}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="col-span-6 md:col-span-2 text-center">
                      <div className="text-3xl font-black text-bauhaus-black tabular-nums leading-none">
                        {rec.fit_score}
                      </div>
                      <div className="text-[10px] font-mono text-bauhaus-muted mt-1">
                        t{rec.theme_score}·g{rec.geography_score}·e{rec.eligibility_score}·d{rec.timing_score}
                      </div>
                    </div>

                    <div className="col-span-6 md:col-span-2 text-xs">
                      <div className="font-mono text-bauhaus-black">
                        {formatDeadline(rec.deadline)}
                      </div>
                      <div className="text-bauhaus-muted mt-1">
                        {formatAmount(rec.min_grant_amount, rec.max_grant_amount)}
                      </div>
                    </div>

                    <div className="col-span-12 md:col-span-3 flex gap-1 justify-end">
                      <button
                        onClick={() => setDecision(rec, 'pursuing')}
                        disabled={isLoading}
                        className="px-3 py-1.5 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black bg-bauhaus-blue text-white hover:bg-bauhaus-black disabled:opacity-50"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => setDecision(rec, 'watching')}
                        disabled={isLoading}
                        className="px-3 py-1.5 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black bg-bauhaus-yellow text-bauhaus-black hover:bg-bauhaus-black hover:text-white disabled:opacity-50"
                      >
                        Watch
                      </button>
                      <button
                        onClick={() => setDecision(rec, 'passed')}
                        disabled={isLoading}
                        className="px-3 py-1.5 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black bg-white text-bauhaus-black hover:bg-bauhaus-black hover:text-white disabled:opacity-50"
                      >
                        Pass
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

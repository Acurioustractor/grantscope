'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type ReviewCase = {
  id: string;
  project_code: string;
  name: string;
  funder_name: string | null;
  source_url: string | null;
  deadline: string | null;
  rationale: string | null;
  description: string | null;
  min_grant_amount: number | null;
  max_grant_amount: number | null;
  total_pool_amount: number | null;
  eligible_org_types: string[];
  jurisdictions: string[];
  is_national: boolean;
  focus_areas: string[];
  keywords: string[];
  opportunity_type: string | null;
  verification_status: string | null;
  verification_notes: string | null;
  verified_at: string | null;
  application_url: string | null;
  project_label: string | null;
  project_notes: string | null;
  project_theme_keywords: string[];
  benchmark_lane: string;
  candidate_role: string | null;
  available_projects: Array<{ code: string; label: string }>;
  foundation_context: {
    foundation_id: string | null;
    funder_name: string;
    website: string | null;
    annual_giving: number | null;
    relationship_score: number;
    contacts_count: number;
    contacts: Array<{ name?: string; email?: string; last_contact_date?: string }>;
    most_recent_contact_at: string | null;
    email_count: number;
    email_last_date: string | null;
    xero_paid_total: number;
    notion_org_name: string | null;
    total_decisions: number;
  } | null;
};

const CHECKS = [
  ['official_source', 'Official source', 'This is the funder or administering body, not an aggregator.'],
  ['current_timing', 'Open now', 'The closing date is current, or rolling intake is clearly documented.'],
  ['applicant_eligibility', 'ACT can apply', 'The applicant type and any partner requirements are clear.'],
  ['funding_amount', 'Amount is clear', 'A range is stated, or the source explicitly says it is unpublished.'],
  ['project_fit', 'Useful for this project', 'There is a concrete use, not just a broad keyword match.'],
] as const;

type CheckKey = typeof CHECKS[number][0];
type Judgment = 'yes' | 'no' | 'unknown';
type Judgments = Record<CheckKey, Judgment>;
type ActionTiming = 'apply_now' | 'build_relationship' | 'do_not_pursue' | null;
type RelationshipKnowledge = 'known_person' | 'no_known_person' | 'needs_matching';

const money = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 0,
});

function humanise(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function timing(deadline: string | null) {
  if (!deadline) return { label: 'No current closing date', detail: 'Rolling or unconfirmed', stale: false };
  const end = new Date(deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const days = Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
  const date = end.toLocaleDateString('en-AU', { dateStyle: 'medium' });
  if (days < 0) return { label: `Closed ${Math.abs(days)} days ago`, detail: `Deadline was ${date}`, stale: true };
  if (days === 0) return { label: 'Closes today', detail: date, stale: false };
  return { label: `${days} days left`, detail: `Closes ${date}`, stale: false };
}

function amountLabel(current: ReviewCase) {
  if (current.min_grant_amount != null && current.max_grant_amount != null) {
    return `${money.format(current.min_grant_amount)} to ${money.format(current.max_grant_amount)}`;
  }
  if (current.max_grant_amount != null) return `Up to ${money.format(current.max_grant_amount)}`;
  if (current.min_grant_amount != null) return `From ${money.format(current.min_grant_amount)}`;
  if (current.total_pool_amount != null) return `${money.format(current.total_pool_amount)} total pool`;
  return 'Not recorded';
}

function initialJudgments(current: ReviewCase | null): Judgments {
  if (!current) {
    return {
      official_source: 'unknown',
      current_timing: 'unknown',
      applicant_eligibility: 'unknown',
      funding_amount: 'unknown',
      project_fit: 'unknown',
    };
  }
  const opportunityTerms = [...current.focus_areas, ...current.keywords].map((term) => term.toLowerCase());
  const hasThemeMatch = current.project_theme_keywords.some((theme) => {
    const needle = theme.toLowerCase();
    return opportunityTerms.some((term) => term.includes(needle) || needle.includes(term));
  });
  return {
    official_source: current.source_url ? 'yes' : 'no',
    current_timing: timing(current.deadline).stale ? 'no' : current.deadline ? 'yes' : 'unknown',
    applicant_eligibility: current.eligible_org_types.length ? 'yes' : 'unknown',
    funding_amount: amountLabel(current) === 'Not recorded' ? 'unknown' : 'yes',
    project_fit: hasThemeMatch ? 'yes' : 'no',
  };
}

function suggestedAction(judgments: Judgments): Exclude<ActionTiming, null> {
  if (CHECKS.some(([key]) => judgments[key] === 'no')) return 'do_not_pursue';
  if (CHECKS.every(([key]) => judgments[key] === 'yes')) return 'apply_now';
  return 'build_relationship';
}

export function BenchmarkReview({
  initialCases,
  initialConfirmed,
  total,
  reviewer,
  weeklyRemaining,
  weeklyLimit,
}: {
  initialCases: ReviewCase[];
  initialConfirmed: number;
  total: number;
  reviewer: { name: string; email: string; mode: 'authenticated' | 'local-development' } | null;
  weeklyRemaining: number;
  weeklyLimit: number;
}) {
  const [cases, setCases] = useState(initialCases);
  const [confirmed, setConfirmed] = useState(initialConfirmed);
  const [remainingThisWeek, setRemainingThisWeek] = useState(weeklyRemaining);
  const [judgments, setJudgments] = useState<Judgments>(() => initialJudgments(initialCases[0] ?? null));
  const [selectedProjectCodes, setSelectedProjectCodes] = useState<string[]>(() => initialCases[0]?.project_code ? [initialCases[0].project_code] : []);
  const [actionTiming, setActionTiming] = useState<ActionTiming>(() => suggestedAction(initialJudgments(initialCases[0] ?? null)));
  const [actionTouched, setActionTouched] = useState(false);
  const [relationshipKnowledge, setRelationshipKnowledge] = useState<RelationshipKnowledge>(() =>
    initialCases[0]?.foundation_context?.contacts_count ? 'known_person' : 'needs_matching');
  const [relationshipNote, setRelationshipNote] = useState('');
  const [comment, setComment] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = cases[0] ?? null;
  const allYes = useMemo(() => CHECKS.every(([key]) => judgments[key] === 'yes'), [judgments]);
  const hasNo = useMemo(() => CHECKS.some(([key]) => judgments[key] === 'no'), [judgments]);
  const hasUnknown = useMemo(() => CHECKS.some(([key]) => judgments[key] === 'unknown'), [judgments]);
  const currentTiming = current ? timing(current.deadline) : null;
  const matchedThemes = useMemo(() => {
    if (!current) return [];
    const opportunityTerms = [...current.focus_areas, ...current.keywords].map((term) => term.toLowerCase());
    return current.project_theme_keywords.filter((theme) => {
      const needle = theme.toLowerCase();
      return opportunityTerms.some((term) => term.includes(needle) || needle.includes(term));
    }).slice(0, 8);
  }, [current]);

  useEffect(() => {
    setJudgments(initialJudgments(current));
    setSelectedProjectCodes(current?.project_code ? [current.project_code] : []);
    setActionTiming(suggestedAction(initialJudgments(current)));
    setActionTouched(false);
    setRelationshipKnowledge(current?.foundation_context?.contacts_count ? 'known_person' : 'needs_matching');
    setRelationshipNote('');
  }, [current]);

  useEffect(() => {
    if (!actionTouched) setActionTiming(suggestedAction(judgments));
  }, [actionTouched, judgments]);

  function reset() {
    setComment('');
    setError(null);
  }

  async function submit(decision: 'relevant' | 'not_relevant' | 'unsure') {
    if (!current) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/ops/act-research/benchmark/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          case_id: current.id,
          decision,
          judgments,
          selected_project_codes: selectedProjectCodes,
          action_timing: actionTiming,
          relationship_knowledge: relationshipKnowledge,
          relationship_note: relationshipNote,
          comment,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Review failed');
      setCases((items) => items.slice(1));
      setRemainingThisWeek((value) => Math.max(0, value - 1));
      if (decision !== 'unsure') setConfirmed((value) => value + 1);
      reset();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Review failed');
    } finally {
      setPending(false);
    }
  }

  if (!current) {
    return (
      <div className="border border-[var(--ws-border)] bg-white p-6">
        <div className="text-lg font-semibold">{remainingThisWeek === 0 ? 'Weekly review complete' : 'No pending cases available'}</div>
        <p className="mt-2 text-sm text-[var(--ws-text-secondary)]">{remainingThisWeek === 0 ? `The ${weeklyLimit}-case weekly allowance has been used. The next bounded batch opens Monday.` : `${confirmed}/${total} cases are confirmed. Disputed cases remain available for a second reviewer.`}</p>
      </div>
    );
  }

  return (
    <div className="grid overflow-hidden border border-[var(--ws-border)] bg-white lg:grid-cols-2">
      <div className="border-b border-[var(--ws-border)] p-5 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-4">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-widest">{current.project_code} · {humanise(current.benchmark_lane)}</span>
          <span className="font-mono text-[10px] text-[var(--ws-text-secondary)]">{remainingThisWeek} weekly places · {confirmed}/{total} confirmed</span>
        </div>
        <h3 className="mt-4 text-xl font-semibold">{current.name}</h3>
        <p className="mt-2 text-sm text-[var(--ws-text-secondary)]">{current.funder_name || 'Funder unknown'}</p>
        {currentTiming?.stale ? (
          <div className="mt-4 border border-red-300 bg-red-50 p-3 text-red-950">
            <div className="text-sm font-semibold">{currentTiming.label}</div>
            <p className="mt-1 text-xs leading-5">
              {currentTiming.detail}. This contradicts the earlier “verified open” classification, so “Open now” is marked No unless the official source documents a new round.
            </p>
          </div>
        ) : (
          <div className="mt-4 border border-emerald-200 bg-emerald-50 p-3">
            <div className="text-sm font-semibold text-emerald-950">{currentTiming?.label}</div>
            <p className="mt-1 text-xs text-emerald-800">{currentTiming?.detail}</p>
          </div>
        )}

        <section className="mt-5">
          <h4 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--ws-text-secondary)]">What it funds</h4>
          <p className="mt-2 text-sm leading-6">{current.description || 'No program description is recorded. Check the official source before deciding.'}</p>
        </section>

        <div className="mt-5 grid grid-cols-2 border-y border-[var(--ws-border)]">
          <div className="border-r border-[var(--ws-border)] py-3 pr-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--ws-text-secondary)]">Funding</div>
            <div className="mt-1 text-sm font-semibold">{amountLabel(current)}</div>
          </div>
          <div className="py-3 pl-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--ws-text-secondary)]">Geography</div>
            <div className="mt-1 text-sm font-semibold">
              {current.is_national ? 'Australia-wide' : current.jurisdictions.length ? current.jurisdictions.join(', ') : 'Not recorded'}
            </div>
          </div>
        </div>

        <section className="mt-5">
          <h4 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--ws-text-secondary)]">Who can apply</h4>
          <p className="mt-2 text-sm leading-6">
            {current.eligible_org_types.length ? current.eligible_org_types.map(humanise).join(', ') : 'Applicant eligibility is not recorded.'}
          </p>
        </section>

        <section className="mt-5 border-l-4 border-[#183426] pl-3">
          <h4 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--ws-text-secondary)]">
            Why test against {current.project_label || current.project_code}
          </h4>
          <p className="mt-2 text-sm leading-6">{current.project_notes || 'No project purpose is recorded.'}</p>
          {matchedThemes.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {matchedThemes.map((theme) => <span key={theme} className="border border-[var(--ws-border)] px-2 py-1 text-[10px] font-semibold">{theme}</span>)}
            </div>
          ) : (
            <p className="mt-2 text-xs font-semibold text-amber-800">No explicit project-theme overlap found in the structured tags.</p>
          )}
        </section>

        <section className="mt-5 bg-[#f4f4f1] p-3">
          <h4 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--ws-text-secondary)]">Evidence quality</h4>
          <dl className="mt-2 grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-xs leading-5">
            <dt className="text-[var(--ws-text-secondary)]">Classification</dt>
            <dd>{current.opportunity_type ? humanise(current.opportunity_type) : 'Unknown'}</dd>
            <dt className="text-[var(--ws-text-secondary)]">Verification</dt>
            <dd>{current.verification_status ? humanise(current.verification_status) : 'Unknown'}</dd>
            <dt className="text-[var(--ws-text-secondary)]">Last checked</dt>
            <dd>{current.verified_at ? new Date(current.verified_at).toLocaleDateString('en-AU', { dateStyle: 'medium' }) : 'Not recorded'}</dd>
            <dt className="text-[var(--ws-text-secondary)]">Notes</dt>
            <dd>{current.verification_notes || 'No verification note recorded.'}</dd>
          </dl>
        </section>

        <section className="mt-5 border border-[var(--ws-border)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--ws-text-secondary)]">Funder relationship</h4>
              <div className="mt-2 text-sm font-semibold">{current.funder_name || 'Unknown funder'}</div>
            </div>
            <span className={`px-2 py-1 text-[10px] font-semibold ${
              current.foundation_context?.contacts_count
                ? 'bg-emerald-100 text-emerald-900'
                : current.foundation_context
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-red-100 text-red-900'
            }`}>
              {current.foundation_context?.contacts_count
                ? `${current.foundation_context.contacts_count} known contact${current.foundation_context.contacts_count === 1 ? '' : 's'}`
                : current.foundation_context
                  ? 'Foundation known · no contact'
                  : 'Foundation not linked'}
            </span>
          </div>
          {current.foundation_context ? (
            <>
              <div className="mt-3 grid grid-cols-3 gap-px bg-[var(--ws-border)]">
                <div className="bg-white p-2">
                  <div className="text-[9px] uppercase text-[var(--ws-text-secondary)]">Relationship</div>
                  <div className="mt-1 text-sm font-semibold">{current.foundation_context.relationship_score}/100</div>
                </div>
                <div className="bg-white p-2">
                  <div className="text-[9px] uppercase text-[var(--ws-text-secondary)]">Emails</div>
                  <div className="mt-1 text-sm font-semibold">{current.foundation_context.email_count}</div>
                </div>
                <div className="bg-white p-2">
                  <div className="text-[9px] uppercase text-[var(--ws-text-secondary)]">Paid history</div>
                  <div className="mt-1 text-sm font-semibold">{money.format(current.foundation_context.xero_paid_total)}</div>
                </div>
              </div>
              {current.foundation_context.contacts.length ? (
                <div className="mt-3 space-y-2">
                  {current.foundation_context.contacts.slice(0, 3).map((contact, index) => (
                    <div key={`${contact.email || contact.name || 'contact'}-${index}`} className="text-xs">
                      <span className="font-semibold">{contact.name || 'Unnamed contact'}</span>
                      {contact.email ? <span className="ml-2 text-[var(--ws-text-secondary)]">{contact.email}</span> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-[var(--ws-text-secondary)]">No person is currently connected to this foundation. Add a warm introduction or research lead before an approach.</p>
              )}
              <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
                {current.foundation_context.foundation_id ? <Link href={`/foundations/${current.foundation_context.foundation_id}`} className="text-blue-700 hover:underline">Open foundation profile</Link> : null}
                {current.foundation_context.website ? <a href={current.foundation_context.website} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">Foundation website</a> : null}
              </div>
            </>
          ) : (
            <p className="mt-3 text-xs leading-5 text-[var(--ws-text-secondary)]">
              This funder name has not matched the foundation register or relationship snapshot. Treat it as a research and entity-linking task, not proof that ACT has no relationship.
            </p>
          )}
        </section>

        <p className="mt-4 text-xs leading-5 text-[var(--ws-text-secondary)]">{current.rationale}</p>
        <div className="mt-4 flex flex-wrap gap-4">
          {current.source_url ? <a href={current.source_url} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center text-sm font-semibold text-blue-700 hover:underline">Open official source</a> : <span className="text-sm font-semibold text-red-700">Official source missing</span>}
          {current.application_url && current.application_url !== current.source_url ? <a href={current.application_url} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center text-sm font-semibold text-blue-700 hover:underline">Open application page</a> : null}
        </div>
      </div>

      <div className="p-5">
        {reviewer ? (
          <>
            <div className="mb-4 flex items-center justify-between gap-3 border border-emerald-200 bg-emerald-50 px-3 py-2">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-emerald-800">Recording as</div>
                <div className="truncate text-sm font-semibold text-emerald-950">{reviewer.name}</div>
                <div className="truncate text-xs text-emerald-800">{reviewer.email}</div>
              </div>
              <span className="shrink-0 text-xs font-semibold text-emerald-800">
                {reviewer.mode === 'authenticated' ? 'Signed in' : 'Local mode'}
              </span>
            </div>
            {reviewer.mode === 'local-development' ? (
              <p className="mb-4 text-[11px] leading-5 text-[var(--ws-text-secondary)]">
                Recorded as a local ACT review with no Supabase user ID. Production still requires an administrator login.
              </p>
            ) : null}
          </>
        ) : (
          <div className="mb-4 border border-amber-300 bg-amber-50 p-3">
            <div className="text-sm font-semibold text-amber-950">Sign in to record your judgment</div>
            <p className="mt-1 text-xs leading-5 text-amber-900">Your profile, decision, checks, comment and review time will be saved together.</p>
            <Link href="/login?next=%2Forg%2Fact%2Fresearch" className="mt-3 inline-flex min-h-10 items-center bg-[#183426] px-4 text-sm font-semibold text-white">
              Sign in and return
            </Link>
          </div>
        )}
        <div className="border-y border-[var(--ws-border)] py-4">
          <div className="text-sm font-semibold">Which ACT projects could use this?</div>
          <p className="mt-1 text-xs text-[var(--ws-text-secondary)]">Select every project with a concrete use, not only the project suggested by the search model.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {current.available_projects.map((project) => {
              const selected = selectedProjectCodes.includes(project.code);
              return (
                <button
                  key={project.code}
                  type="button"
                  disabled={!reviewer}
                  aria-pressed={selected}
                  title={project.label}
                  onClick={() => setSelectedProjectCodes((codes) => selected ? codes.filter((code) => code !== project.code) : [...codes, project.code])}
                  className={`min-h-9 border px-3 text-xs font-semibold ${selected ? 'border-[#183426] bg-[#183426] text-white' : 'border-[var(--ws-border)] bg-white'}`}
                >
                  {project.code}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-b border-[var(--ws-border)] py-4">
          <div className="text-sm font-semibold">What would ACT do?</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {([
              ['apply_now', 'Apply now'],
              ['build_relationship', 'Build relationship'],
              ['do_not_pursue', 'Do not pursue'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                disabled={!reviewer}
                aria-pressed={actionTiming === value}
                onClick={() => {
                  setActionTiming(value);
                  setActionTouched(true);
                }}
                className={`min-h-10 border px-2 text-xs font-semibold ${
                  actionTiming === value
                    ? value === 'apply_now'
                      ? 'border-emerald-700 bg-emerald-700 text-white'
                      : value === 'do_not_pursue'
                        ? 'border-red-700 bg-red-700 text-white'
                        : 'border-amber-500 bg-amber-500 text-black'
                    : 'border-[var(--ws-border)] bg-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-b border-[var(--ws-border)] py-4">
          <div className="text-sm font-semibold">Who does ACT know at the funder?</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {([
              ['known_person', 'We know someone'],
              ['no_known_person', 'Nobody known'],
              ['needs_matching', 'Find a pathway'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                disabled={!reviewer}
                aria-pressed={relationshipKnowledge === value}
                onClick={() => setRelationshipKnowledge(value)}
                className={`min-h-10 border px-2 text-xs font-semibold ${
                  relationshipKnowledge === value ? 'border-[#183426] bg-[#183426] text-white' : 'border-[var(--ws-border)] bg-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="mt-3 block">
            <span className="text-[11px] font-semibold">People, connectors or introduction ideas</span>
            <textarea
              value={relationshipNote}
              onChange={(event) => setRelationshipNote(event.target.value)}
              disabled={!reviewer}
              rows={2}
              placeholder="Name a person, mutual connection, board link, grantee, or next research step."
              className="mt-2 w-full resize-y border border-[var(--ws-border)] bg-white p-3 text-sm outline-none focus:border-[#183426]"
            />
          </label>
        </div>

        <div className="text-sm font-semibold">Check the five requirements</div>
        <p className="mt-1 text-xs leading-5 text-[var(--ws-text-secondary)]">
          The system has pre-filled what it can prove. Change any judgment after checking the source.
        </p>
        <div className="mt-4 divide-y divide-[var(--ws-border)] border-y border-[var(--ws-border)]">
          {CHECKS.map(([key, label, note]) => (
            <div key={key} className="grid gap-3 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{label}</span>
                <span className="mt-0.5 block text-xs leading-5 text-[var(--ws-text-secondary)]">{note}</span>
              </span>
              <div className="grid grid-cols-3 border border-[var(--ws-border)]" role="group" aria-label={`${label} judgment`}>
                {(['yes', 'no', 'unknown'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    disabled={!reviewer}
                    aria-pressed={judgments[key] === value}
                    onClick={() => setJudgments((currentValue) => ({ ...currentValue, [key]: value }))}
                    className={`min-h-9 border-r border-[var(--ws-border)] px-2 text-[11px] font-semibold last:border-r-0 disabled:cursor-not-allowed disabled:opacity-50 ${
                      judgments[key] === value
                        ? value === 'yes'
                          ? 'bg-emerald-700 text-white'
                          : value === 'no'
                            ? 'bg-red-700 text-white'
                            : 'bg-amber-500 text-black'
                        : 'bg-white text-[var(--ws-text-secondary)]'
                    }`}
                  >
                    {value === 'unknown' ? 'Unknown' : humanise(value)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={`mt-4 border p-3 ${hasNo ? 'border-red-300 bg-red-50' : hasUnknown ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50'}`}>
          <div className="text-sm font-semibold">
            {hasNo ? 'Result: Not relevant' : hasUnknown ? 'Result: Not enough evidence' : 'Result: Relevant'}
          </div>
          <p className="mt-1 text-xs leading-5">
            {hasNo
              ? 'At least one required condition fails. Record this as Not relevant.'
              : hasUnknown
                ? 'No condition has failed, but evidence is incomplete. Record this as Not sure or investigate further.'
                : 'All five requirements pass. This can become a recommendation.'}
          </p>
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-semibold">Optional note</span>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            disabled={!reviewer}
            rows={3}
            placeholder="What should the model learn from this case?"
            className="mt-2 w-full resize-y border border-[var(--ws-border)] bg-white p-3 text-sm outline-none focus:border-[#183426]"
          />
          <span className="mt-1 block text-[11px] text-[var(--ws-text-secondary)]">Add context only when the judgments do not tell the full story.</span>
        </label>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <button type="button" disabled={!reviewer || pending || !allYes || !actionTiming || selectedProjectCodes.length === 0} onClick={() => submit('relevant')} className="min-h-11 bg-emerald-700 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-25">{pending && allYes ? 'Saving…' : 'Record relevant'}</button>
          <button type="button" disabled={!reviewer || pending || !hasNo || !actionTiming} onClick={() => submit('not_relevant')} className="min-h-11 bg-red-700 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-25">{pending && hasNo ? 'Saving…' : 'Record not relevant'}</button>
          <button type="button" disabled={!reviewer || pending || !hasUnknown || hasNo || !actionTiming} onClick={() => submit('unsure')} className="min-h-11 border border-amber-500 bg-amber-50 px-3 text-sm font-semibold text-amber-950 disabled:cursor-not-allowed disabled:opacity-25">{pending && hasUnknown && !hasNo ? 'Saving…' : 'Record not sure'}</button>
        </div>
      </div>
    </div>
  );
}

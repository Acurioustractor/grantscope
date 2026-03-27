'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface OutcomeSubmission {
  id: string;
  org_name: string;
  org_abn: string | null;
  gs_entity_id: string | null;
  contact_email: string | null;
  program_name: string;
  reporting_period: string;
  outcomes: Array<{ metric: string; value: number; unit: string; description?: string }>;
  narrative: string | null;
  methodology: string | null;
  status: string;
  reviewer_notes: string | null;
  postcode: string | null;
  state: string | null;
  proof_bundle_id: string | null;
  created_at: string;
  reviewed_at: string | null;
}

interface Counts {
  total: number;
  draft: number;
  submitted: number;
  under_review: number;
  validated: number;
  rejected: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-bauhaus-yellow/20 text-yellow-800',
  under_review: 'bg-bauhaus-blue/20 text-bauhaus-blue',
  validated: 'bg-money-light text-green-800',
  rejected: 'bg-error-light text-bauhaus-red',
  published: 'bg-bauhaus-blue/30 text-bauhaus-blue',
};

export default function OutcomeReviewPage() {
  const [submissions, setSubmissions] = useState<OutcomeSubmission[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('submitted');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    const url = statusFilter
      ? `/api/outcomes/review?status=${statusFilter}`
      : '/api/outcomes/review';
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      setSubmissions(data.submissions || []);
      setCounts(data.counts || null);
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  async function handleReview(id: string, action: 'validate' | 'reject' | 'request_changes') {
    setActing(id);
    const res = await fetch(`/api/outcomes/${id}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reviewer_notes: reviewNotes[id] || '' }),
    });
    if (res.ok) {
      await fetchSubmissions();
      setExpanded(null);
    }
    setActing(null);
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <Link href="/" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; CivicGraph
      </Link>

      <div className="mt-4 mb-6">
        <div className="text-[10px] font-black text-bauhaus-blue uppercase tracking-[0.25em] mb-1">Governed Proof</div>
        <h1 className="text-2xl font-black text-bauhaus-black">Outcome Submissions — Review Queue</h1>
        <p className="text-sm text-bauhaus-muted mt-1">
          Review and validate outcome submissions from partner organisations. Validated outcomes become Governed Proof bundles.
        </p>
      </div>

      {/* Status filter tabs */}
      {counts && (
        <div className="flex gap-1 mb-6 flex-wrap">
          {[
            { key: '', label: 'All', count: counts.total },
            { key: 'submitted', label: 'Pending', count: counts.submitted },
            { key: 'under_review', label: 'In Review', count: counts.under_review },
            { key: 'validated', label: 'Validated', count: counts.validated },
            { key: 'rejected', label: 'Rejected', count: counts.rejected },
            { key: 'draft', label: 'Drafts', count: counts.draft },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`text-xs px-3 py-1.5 border-2 font-black uppercase tracking-widest transition-colors ${
                statusFilter === tab.key
                  ? 'border-bauhaus-black bg-bauhaus-black text-white'
                  : 'border-gray-200 text-bauhaus-muted hover:border-bauhaus-black'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-bauhaus-muted py-8 text-center">Loading submissions...</div>
      ) : submissions.length === 0 ? (
        <div className="border-4 border-gray-200 p-8 text-center">
          <p className="text-sm text-bauhaus-muted">No submissions found for this filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map(sub => (
            <div key={sub.id} className="border-4 border-bauhaus-black">
              {/* Header row */}
              <button
                onClick={() => setExpanded(expanded === sub.id ? null : sub.id)}
                className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] px-2 py-0.5 font-black uppercase tracking-widest ${STATUS_COLORS[sub.status] || 'bg-gray-100'}`}>
                        {sub.status}
                      </span>
                      {sub.gs_entity_id && (
                        <span className="text-[10px] px-2 py-0.5 bg-bauhaus-blue/10 text-bauhaus-blue font-bold">
                          Linked: {sub.gs_entity_id}
                        </span>
                      )}
                      {sub.proof_bundle_id && (
                        <span className="text-[10px] px-2 py-0.5 bg-money-light text-green-800 font-bold">
                          Proof Bundle
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-black text-bauhaus-black truncate">
                      {sub.gs_entity_id ? (
                        <Link href={`/entities/${sub.gs_entity_id}`} className="hover:text-bauhaus-red">{sub.org_name}</Link>
                      ) : sub.org_name}
                      {' — '}{sub.program_name}
                    </h3>
                    <div className="text-xs text-bauhaus-muted mt-0.5">
                      {sub.reporting_period} · {sub.outcomes.length} outcome{sub.outcomes.length !== 1 ? 's' : ''} · Submitted {new Date(sub.created_at).toLocaleDateString('en-AU')}
                    </div>
                  </div>
                  <span className="text-bauhaus-muted text-lg">{expanded === sub.id ? '\u25B2' : '\u25BC'}</span>
                </div>
              </button>

              {/* Expanded detail */}
              {expanded === sub.id && (
                <div className="border-t-4 border-bauhaus-black p-4 bg-gray-50">
                  {/* Org details */}
                  <div className="grid sm:grid-cols-3 gap-4 mb-4">
                    <div>
                      <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Organisation</div>
                      <div className="text-sm font-bold">
                        {sub.gs_entity_id ? (
                          <Link href={`/entities/${sub.gs_entity_id}`} className="hover:text-bauhaus-red">{sub.org_name}</Link>
                        ) : sub.org_name}
                      </div>
                      {sub.org_abn && <div className="text-xs text-bauhaus-muted">ABN {sub.org_abn}</div>}
                      {sub.gs_entity_id && (
                        <Link href={`/entities/${sub.gs_entity_id}#funding`}
                              className="text-[10px] font-black text-bauhaus-blue uppercase tracking-widest hover:underline mt-1 inline-block">
                          View Funding &rarr;
                        </Link>
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Contact</div>
                      <div className="text-sm">{sub.contact_email || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Location</div>
                      <div className="text-sm">{[sub.postcode, sub.state].filter(Boolean).join(', ') || '—'}</div>
                    </div>
                  </div>

                  {/* Outcomes table */}
                  <div className="mb-4">
                    <div className="text-[10px] font-black text-bauhaus-blue uppercase tracking-widest mb-2">Reported Outcomes</div>
                    <table className="w-full text-xs border-2 border-gray-200">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="text-left p-2 font-black text-bauhaus-muted uppercase tracking-widest text-[10px]">Metric</th>
                          <th className="text-right p-2 font-black text-bauhaus-muted uppercase tracking-widest text-[10px]">Value</th>
                          <th className="text-left p-2 font-black text-bauhaus-muted uppercase tracking-widest text-[10px]">Unit</th>
                          <th className="text-left p-2 font-black text-bauhaus-muted uppercase tracking-widest text-[10px]">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sub.outcomes.map((o, i) => (
                          <tr key={i} className="border-t border-gray-200">
                            <td className="p-2 font-mono">{o.metric}</td>
                            <td className="p-2 text-right font-bold">{o.value}</td>
                            <td className="p-2 text-bauhaus-muted">{o.unit}</td>
                            <td className="p-2 text-bauhaus-muted">{o.description || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Narrative + Methodology */}
                  {sub.narrative && (
                    <div className="mb-3">
                      <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Narrative</div>
                      <p className="text-sm text-bauhaus-black bg-white border-2 border-gray-200 p-3">{sub.narrative}</p>
                    </div>
                  )}
                  {sub.methodology && (
                    <div className="mb-4">
                      <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Methodology</div>
                      <p className="text-sm text-bauhaus-muted bg-white border-2 border-gray-200 p-3">{sub.methodology}</p>
                    </div>
                  )}

                  {/* Review actions */}
                  {(sub.status === 'submitted' || sub.status === 'under_review') && (
                    <div className="border-t-2 border-gray-200 pt-4 mt-4">
                      <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">Reviewer Notes</div>
                      <textarea
                        value={reviewNotes[sub.id] || ''}
                        onChange={e => setReviewNotes({ ...reviewNotes, [sub.id]: e.target.value })}
                        rows={2}
                        placeholder="Optional notes about this submission..."
                        className="w-full px-3 py-2 border-2 border-gray-200 text-sm focus:border-bauhaus-black outline-none mb-3"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReview(sub.id, 'validate')}
                          disabled={acting === sub.id}
                          className="px-4 py-2 bg-green-700 text-white text-xs font-black uppercase tracking-widest hover:bg-green-800 transition-colors disabled:opacity-50"
                        >
                          {acting === sub.id ? 'Processing...' : 'Validate & Create Proof Bundle'}
                        </button>
                        <button
                          onClick={() => handleReview(sub.id, 'request_changes')}
                          disabled={acting === sub.id}
                          className="px-4 py-2 border-2 border-bauhaus-black text-xs font-black uppercase tracking-widest hover:bg-bauhaus-yellow transition-colors disabled:opacity-50"
                        >
                          Request Changes
                        </button>
                        <button
                          onClick={() => handleReview(sub.id, 'reject')}
                          disabled={acting === sub.id}
                          className="px-4 py-2 border-2 border-bauhaus-red text-bauhaus-red text-xs font-black uppercase tracking-widest hover:bg-error-light transition-colors disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Already reviewed */}
                  {sub.reviewer_notes && sub.status !== 'submitted' && (
                    <div className="mt-3 text-xs text-bauhaus-muted">
                      <strong>Reviewer notes:</strong> {sub.reviewer_notes}
                      {sub.reviewed_at && <span> · {new Date(sub.reviewed_at).toLocaleDateString('en-AU')}</span>}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 text-center">
        <Link
          href="/outcomes/submit"
          className="text-xs font-black text-bauhaus-blue uppercase tracking-widest hover:underline"
        >
          Submit New Outcomes &rarr;
        </Link>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { GrantCardActions } from './grant-card-actions';

interface Grant {
  id: string;
  name: string;
  provider: string;
  program: string | null;
  program_type: string | null;
  amount_min: number | null;
  amount_max: number | null;
  closes_at: string | null;
  url: string | null;
  description: string | null;
  categories: string[];
  focus_areas: string[];
  target_recipients: string[];
  status: string;
  eligibility_criteria: Array<{ criterion: string; description: string; category: string }> | null;
  assessment_criteria: Array<{ name: string; description: string; weight_pct: number }> | null;
  requirements_summary: string | null;
  grant_type: string | null;
}

function formatAmount(min: number | null, max: number | null): string {
  if (min && max) return `$${min.toLocaleString()} – $${max.toLocaleString()}`;
  if (max) return `Up to $${max.toLocaleString()}`;
  if (min) return `From $${min.toLocaleString()}`;
  return 'Not specified';
}

function formatDate(date: string | null): string {
  if (!date) return 'Ongoing';
  return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysUntil(date: string | null): string | null {
  if (!date) return null;
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return 'Closed';
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

function programTypeBadge(type: string | null) {
  switch (type) {
    case 'fellowship': return { cls: 'border-bauhaus-blue bg-link-light text-bauhaus-blue', label: 'Fellowship' };
    case 'scholarship': return { cls: 'border-bauhaus-yellow bg-warning-light text-bauhaus-black', label: 'Scholarship' };
    case 'historical_award': return { cls: 'border-bauhaus-black/30 bg-bauhaus-canvas text-bauhaus-muted', label: 'Historical Award' };
    default: return null;
  }
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-5">
      <div className="h-6 bg-bauhaus-black/10 rounded w-3/4" />
      <div className="h-4 bg-bauhaus-black/10 rounded w-1/2" />
      <div className="flex gap-3 mt-6">
        <div className="h-16 bg-bauhaus-black/10 rounded flex-1" />
        <div className="h-16 bg-bauhaus-black/10 rounded flex-1" />
        <div className="h-16 bg-bauhaus-black/10 rounded flex-1" />
      </div>
      <div className="space-y-2 mt-6">
        <div className="h-3 bg-bauhaus-black/10 rounded w-full" />
        <div className="h-3 bg-bauhaus-black/10 rounded w-full" />
        <div className="h-3 bg-bauhaus-black/10 rounded w-5/6" />
        <div className="h-3 bg-bauhaus-black/10 rounded w-4/6" />
      </div>
    </div>
  );
}

export function GrantPreviewPanel({
  grantId,
  onClose,
}: {
  grantId: string | null;
  onClose: () => void;
}) {
  const [grant, setGrant] = useState<Grant | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!grantId) {
      setGrant(null);
      return;
    }
    setLoading(true);
    setError(false);
    fetch(`/api/grants/${grantId}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((data) => {
        setGrant(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [grantId]);

  // Escape key closes
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!grantId) return;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [grantId, handleKeyDown]);

  if (!grantId) return null;

  const g = grant;
  const ptBadge = g ? programTypeBadge(g.program_type) : null;
  const eligibility = g?.eligibility_criteria;
  const assessment = g?.assessment_criteria;
  const remaining = g ? daysUntil(g.closes_at) : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 z-[60] w-full max-w-xl h-full bg-white border-l-4 border-bauhaus-black flex flex-col animate-slide-in-right">
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="p-5">
            <p className="text-bauhaus-red font-bold">Failed to load grant.</p>
            <button onClick={onClose} className="mt-3 text-sm font-bold text-bauhaus-blue hover:underline">
              Close
            </button>
          </div>
        ) : g ? (
          <>
            {/* Header */}
            <div className="p-5 pb-0 flex-shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-black text-bauhaus-black leading-tight">{g.name}</h2>
                    {ptBadge && (
                      <span className={`text-[10px] font-black px-2 py-0.5 flex-shrink-0 border-2 uppercase tracking-widest ${ptBadge.cls}`}>
                        {ptBadge.label}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-bauhaus-muted font-medium mt-1">
                    {g.provider}{g.program ? ` — ${g.program}` : ''}
                  </div>
                  <div className="mt-2">
                    <GrantCardActions grantId={g.id} />
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 text-bauhaus-muted hover:text-bauhaus-black transition-colors flex-shrink-0"
                  aria-label="Close preview"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                    <path strokeLinecap="square" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-0 mt-4 border-4 border-bauhaus-black">
                <div className="bg-white p-3 border-r-4 border-bauhaus-black">
                  <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Amount</div>
                  <div className="text-sm font-black text-bauhaus-blue tabular-nums mt-0.5">{formatAmount(g.amount_min, g.amount_max)}</div>
                </div>
                <div className="bg-white p-3 border-r-4 border-bauhaus-black">
                  <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Closes</div>
                  <div className={`text-sm font-black mt-0.5 ${g.closes_at ? 'text-bauhaus-red' : 'text-bauhaus-muted'}`}>
                    {formatDate(g.closes_at)}
                  </div>
                  {remaining && remaining !== 'Closed' && (
                    <div className="text-[10px] font-bold text-bauhaus-muted mt-0.5">{remaining} left</div>
                  )}
                </div>
                <div className="bg-white p-3">
                  <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Status</div>
                  <div className="text-sm font-black text-money mt-0.5 capitalize">{g.status || 'Open'}</div>
                </div>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Description */}
              {g.description && (
                <div>
                  <div className="text-xs font-black text-bauhaus-black mb-1.5 uppercase tracking-widest">Description</div>
                  <p className="text-sm text-bauhaus-muted leading-relaxed font-medium whitespace-pre-line">{g.description}</p>
                </div>
              )}

              {/* Requirements summary */}
              {g.requirements_summary && (
                <div className="bg-money-light border-4 border-money p-3">
                  <div className="text-xs font-black text-money mb-1 uppercase tracking-widest">Requirements</div>
                  <p className="text-sm text-bauhaus-black leading-relaxed font-medium">{g.requirements_summary}</p>
                </div>
              )}

              {/* Eligibility */}
              {eligibility && eligibility.length > 0 && (
                <div>
                  <div className="text-xs font-black text-bauhaus-black mb-1.5 uppercase tracking-widest">Eligibility</div>
                  <div className="space-y-1.5">
                    {eligibility.map((e, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-money font-black mt-0.5 flex-shrink-0">&#10003;</span>
                        <div>
                          <span className="font-bold text-bauhaus-black">{e.criterion}</span>
                          {e.description && <span className="text-bauhaus-muted font-medium"> — {e.description}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Categories + Focus Areas + Target Recipients */}
              {(g.categories?.length > 0 || g.focus_areas?.length > 0 || g.target_recipients?.length > 0) && (
                <div className="space-y-3">
                  {g.categories?.length > 0 && (
                    <div>
                      <div className="text-xs font-black text-bauhaus-black mb-1 uppercase tracking-widest">Categories</div>
                      <div className="flex gap-1.5 flex-wrap">
                        {g.categories.map(c => (
                          <span key={c} className="text-[11px] px-2 py-0.5 bg-bauhaus-blue text-white font-black uppercase tracking-wider">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {g.focus_areas?.length > 0 && (
                    <div>
                      <div className="text-xs font-black text-bauhaus-muted mb-1 uppercase tracking-widest">Focus Areas</div>
                      <div className="flex gap-1.5 flex-wrap">
                        {g.focus_areas.map(f => (
                          <span key={f} className="text-[11px] px-2 py-0.5 bg-money-light text-money font-black border-2 border-money/20">{f}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {g.target_recipients?.length > 0 && (
                    <div>
                      <div className="text-xs font-black text-bauhaus-muted mb-1 uppercase tracking-widest">Target Recipients</div>
                      <div className="flex gap-1.5 flex-wrap">
                        {g.target_recipients.map(r => (
                          <span key={r} className="text-[11px] px-2 py-0.5 bg-warning-light text-bauhaus-black font-black border-2 border-bauhaus-yellow/30">{r.replace('_', ' ')}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Assessment criteria */}
              {assessment && assessment.length > 0 && (
                <div>
                  <div className="text-xs font-black text-bauhaus-black mb-1.5 uppercase tracking-widest">Assessment Criteria</div>
                  <div className="space-y-1.5">
                    {assessment.map((a, i) => (
                      <div key={i} className="flex justify-between items-start gap-2 text-sm">
                        <div>
                          <span className="font-bold text-bauhaus-black">{a.name}</span>
                          {a.description && <p className="text-bauhaus-muted font-medium text-xs mt-0.5">{a.description}</p>}
                        </div>
                        {a.weight_pct > 0 && (
                          <span className="text-[10px] font-black text-bauhaus-blue bg-link-light px-1.5 py-0.5 border-2 border-bauhaus-blue/20 flex-shrink-0 tabular-nums">
                            {a.weight_pct}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sticky footer */}
            <div className="flex-shrink-0 p-4 border-t-4 border-bauhaus-black bg-white flex items-center gap-3">
              <a
                href={`/grants/${g.id}`}
                className="flex-1 text-center px-4 py-2.5 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-blue transition-colors"
              >
                View Full Details &rarr;
              </a>
              {g.url && (
                <a
                  href={g.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-bauhaus-red text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black transition-colors"
                >
                  Apply &rarr;
                </a>
              )}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}

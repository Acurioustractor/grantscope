'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ThumbsVote } from '@/app/components/thumbs-vote';

interface MatchedGrant {
  id: string;
  name: string;
  provider: string;
  description: string;
  amount_max: number | null;
  closes_at: string | null;
  categories: string[];
  url: string | null;
  grant_type: string;
  fit_score: number;
}

interface GrantDetail {
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
  grant_type: string | null;
  eligibility_criteria: Record<string, unknown> | null;
  requirements_summary: string | null;
  funder_info: Record<string, unknown> | null;
  created_at: string;
}

function GrantSidebar({
  grantId,
  fitScore,
  onClose,
  onTrack,
  isTracked,
}: {
  grantId: string;
  fitScore: number;
  onClose: () => void;
  onTrack: (id: string) => void;
  isTracked: boolean;
}) {
  const [detail, setDetail] = useState<GrantDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/grants/${grantId}`)
      .then(r => r.json())
      .then(data => setDetail(data.grant || data))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [grantId]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  function formatAmount(min: number | null, max: number | null): string {
    if (min && max) return `$${min.toLocaleString()} – $${max.toLocaleString()}`;
    if (max) return `Up to $${max.toLocaleString()}`;
    if (min) return `From $${min.toLocaleString()}`;
    return 'Not specified';
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-xl bg-white z-50 shadow-2xl border-l-4 border-bauhaus-black overflow-y-auto animate-slide-in">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b-4 border-bauhaus-black p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 flex flex-col items-center justify-center ${fitScore >= 80 ? 'bg-bauhaus-blue' : fitScore >= 70 ? 'bg-bauhaus-yellow' : 'bg-bauhaus-muted/30'}`}>
              <span className="text-lg font-black text-white">{fitScore}</span>
              <span className="text-[8px] font-black text-white/80 uppercase">%</span>
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-bauhaus-muted">Grant Details</span>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center border-3 border-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors text-lg font-black"
          >
            &times;
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-sm font-black uppercase tracking-widest text-bauhaus-muted animate-pulse">
              Loading...
            </div>
          </div>
        ) : !detail ? (
          <div className="p-6 text-center text-sm text-bauhaus-muted">
            Could not load grant details.
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Title */}
            <div>
              <h2 className="text-lg font-black text-bauhaus-black uppercase tracking-wide leading-tight">
                {detail.name}
              </h2>
              <p className="text-sm text-bauhaus-muted mt-1">{detail.provider}</p>
              {detail.program && (
                <p className="text-xs text-bauhaus-muted mt-0.5">Program: {detail.program}</p>
              )}
            </div>

            {/* Key Facts */}
            <div className="grid grid-cols-2 gap-3">
              <div className="border-3 border-bauhaus-black p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Amount</div>
                <div className="text-sm font-black text-bauhaus-black mt-1">
                  {formatAmount(detail.amount_min, detail.amount_max)}
                </div>
              </div>
              <div className="border-3 border-bauhaus-black p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Deadline</div>
                <div className={`text-sm font-black mt-1 ${detail.closes_at ? 'text-bauhaus-red' : 'text-bauhaus-black'}`}>
                  {detail.closes_at
                    ? new Date(detail.closes_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
                    : 'Ongoing'}
                </div>
              </div>
              {detail.grant_type && (
                <div className="border-3 border-bauhaus-black p-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Type</div>
                  <div className="text-sm font-black text-bauhaus-black mt-1">{detail.grant_type}</div>
                </div>
              )}
              {detail.status && (
                <div className="border-3 border-bauhaus-black p-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Status</div>
                  <div className="text-sm font-black text-bauhaus-black mt-1 capitalize">{detail.status}</div>
                </div>
              )}
            </div>

            {/* Description */}
            {detail.description && (
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-bauhaus-black mb-2">Description</h3>
                <p className="text-sm text-bauhaus-black/80 leading-relaxed whitespace-pre-line">
                  {detail.description}
                </p>
              </div>
            )}

            {/* Requirements */}
            {detail.requirements_summary && (
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-bauhaus-black mb-2">Requirements</h3>
                <p className="text-sm text-bauhaus-black/80 leading-relaxed whitespace-pre-line">
                  {detail.requirements_summary}
                </p>
              </div>
            )}

            {/* Eligibility */}
            {detail.eligibility_criteria && Object.keys(detail.eligibility_criteria).length > 0 && (
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-bauhaus-black mb-2">Eligibility</h3>
                <div className="text-sm text-bauhaus-black/80 space-y-1">
                  {Object.entries(detail.eligibility_criteria).map(([key, val]) => (
                    <div key={key} className="flex gap-2">
                      <span className="font-bold capitalize">{key.replace(/_/g, ' ')}:</span>
                      <span>{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Categories & Focus Areas */}
            {(detail.categories?.length > 0 || detail.focus_areas?.length > 0) && (
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-bauhaus-black mb-2">Focus Areas</h3>
                <div className="flex flex-wrap gap-2">
                  {detail.categories?.map(cat => (
                    <span key={cat} className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue border border-bauhaus-blue/30 px-2 py-1">
                      {cat}
                    </span>
                  ))}
                  {detail.focus_areas?.map(area => (
                    <span key={area} className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted border border-bauhaus-black/20 px-2 py-1">
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Target Recipients */}
            {detail.target_recipients?.length > 0 && (
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-bauhaus-black mb-2">Target Recipients</h3>
                <div className="flex flex-wrap gap-2">
                  {detail.target_recipients.map(r => (
                    <span key={r} className="text-[10px] font-black uppercase tracking-widest text-bauhaus-black border border-bauhaus-black/20 px-2 py-1">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* External URL */}
            {detail.url && (
              <a
                href={detail.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:text-bauhaus-black border-3 border-bauhaus-blue px-4 py-3 text-center transition-colors"
              >
                Visit Grant Website &rarr;
              </a>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => onTrack(detail.id)}
                disabled={isTracked}
                className={`flex-1 text-xs font-black uppercase tracking-widest px-4 py-3 border-3 border-bauhaus-black transition-colors ${
                  isTracked
                    ? 'bg-bauhaus-black text-white'
                    : 'hover:bg-bauhaus-black hover:text-white'
                }`}
              >
                {isTracked ? 'Tracked' : 'Add to Tracker'}
              </button>
              <Link
                href={`/grants/${detail.id}`}
                className="flex-1 text-xs font-black uppercase tracking-widest px-4 py-3 border-3 border-bauhaus-black text-center bg-bauhaus-blue text-white hover:bg-bauhaus-black transition-colors"
              >
                Full Page Details
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export function MatchesClient() {
  const [matches, setMatches] = useState<MatchedGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [minScore, setMinScore] = useState(55);
  const [savingGrant, setSavingGrant] = useState<string | null>(null);
  const [savedGrants, setSavedGrants] = useState<Set<string>>(new Set());
  const [voteCount, setVoteCount] = useState(0);
  const [selectedGrant, setSelectedGrant] = useState<MatchedGrant | null>(null);

  useEffect(() => {
    fetch(`/api/profile/matches?threshold=${minScore / 100}&limit=100`)
      .then(r => {
        if (!r.ok) throw r;
        return r.json();
      })
      .then(data => {
        setMatches(data.matches || []);
        setVoteCount(data.feedback_count || 0);
      })
      .catch(async (r) => {
        if (r instanceof Response) {
          const data = await r.json().catch(() => ({}));
          setError(data.error || 'Failed to load matches');
        } else {
          setError('Failed to load matches');
        }
      })
      .finally(() => setLoading(false));
  }, [minScore]);

  const saveToTracker = useCallback(async (grantId: string) => {
    setSavingGrant(grantId);
    try {
      await fetch(`/api/tracker/${grantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'discovered', stars: 0, color: 'none' }),
      });
      setSavedGrants(prev => new Set(prev).add(grantId));
    } catch {
      // ignore
    } finally {
      setSavingGrant(null);
    }
  }, []);

  function fitColor(score: number) {
    if (score >= 80) return 'bg-bauhaus-blue';
    if (score >= 70) return 'bg-bauhaus-yellow';
    return 'bg-bauhaus-muted/30';
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-sm font-black uppercase tracking-widest text-bauhaus-muted animate-pulse">
          Finding matches...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-black uppercase tracking-tight text-bauhaus-black">
          Matched Grants
        </h1>
        <div className="border-4 border-bauhaus-red bg-danger-light p-6">
          <p className="text-sm font-bold text-bauhaus-red">{error}</p>
          <Link
            href="/profile"
            className="inline-block mt-3 text-xs font-black uppercase tracking-widest text-bauhaus-black hover:text-bauhaus-blue"
          >
            Go to Profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-bauhaus-black">
            Matched Grants
          </h1>
          <p className="text-sm text-bauhaus-muted mt-1">
            {matches.length} grants matched to your profile
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/profile/answers"
            className="text-xs font-black uppercase tracking-widest text-bauhaus-black hover:text-bauhaus-blue border-3 border-bauhaus-black px-4 py-2"
          >
            Answer Bank
          </Link>
          <Link
            href="/profile"
            className="text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:text-bauhaus-black border-3 border-bauhaus-black px-4 py-2"
          >
            Edit Profile
          </Link>
        </div>
      </div>

      {/* Learning progress */}
      {voteCount > 0 && (
        <div className="flex items-center gap-3 border-4 border-bauhaus-blue/30 bg-bauhaus-blue/5 p-3">
          <span className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">
            {voteCount} grant{voteCount !== 1 ? 's' : ''} rated
          </span>
          {voteCount >= 5 && (
            <span className="text-[10px] font-black uppercase tracking-widest text-white bg-bauhaus-blue px-2 py-0.5">
              Personalized
            </span>
          )}
          <span className="text-xs text-bauhaus-muted ml-auto">
            Rate grants to improve your recommendations
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 border-4 border-bauhaus-black bg-white p-4">
        <label className="text-xs font-black uppercase tracking-widest text-bauhaus-black whitespace-nowrap">
          Min Fit Score
        </label>
        <input
          type="range"
          min={50}
          max={90}
          step={5}
          value={minScore}
          onChange={e => {
            setMinScore(parseInt(e.target.value));
            setLoading(true);
          }}
          className="flex-1"
        />
        <span className="text-sm font-black text-bauhaus-black w-12 text-right">{minScore}%</span>
      </div>

      {/* Results */}
      {matches.length === 0 ? (
        <div className="border-4 border-bauhaus-black/20 p-8 text-center">
          <p className="text-sm text-bauhaus-muted">
            No grants found above {minScore}% fit. Try lowering the threshold or updating your profile.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map(grant => (
            <div
              key={grant.id}
              className={`border-4 bg-white cursor-pointer transition-colors ${
                selectedGrant?.id === grant.id
                  ? 'border-bauhaus-blue'
                  : 'border-bauhaus-black hover:border-bauhaus-blue/50'
              }`}
              onClick={() => setSelectedGrant(grant)}
            >
              <div className="flex items-stretch">
                {/* Fit score bar */}
                <div className={`w-20 flex-shrink-0 flex flex-col items-center justify-center ${fitColor(grant.fit_score)} border-r-4 ${selectedGrant?.id === grant.id ? 'border-bauhaus-blue' : 'border-bauhaus-black'}`}>
                  <span className="text-2xl font-black text-white">{grant.fit_score}</span>
                  <span className="text-[10px] font-black text-white/80 uppercase">% fit</span>
                </div>

                {/* Content */}
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <span className="text-sm font-black text-bauhaus-black uppercase tracking-wide">
                        {grant.name}
                      </span>
                      <div className="text-xs text-bauhaus-muted mt-1">{grant.provider}</div>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <ThumbsVote
                        grantId={grant.id}
                        sourceContext="matches"
                        onVote={() => setVoteCount(c => c + 1)}
                      />
                      <button
                        onClick={() => saveToTracker(grant.id)}
                        disabled={savingGrant === grant.id || savedGrants.has(grant.id)}
                        className={`text-xs font-black uppercase tracking-widest px-3 py-2 border-3 border-bauhaus-black transition-colors ${
                          savedGrants.has(grant.id)
                            ? 'bg-bauhaus-black text-white'
                            : 'hover:bg-bauhaus-black hover:text-white disabled:opacity-50'
                        }`}
                      >
                        {savedGrants.has(grant.id) ? 'Tracked' : savingGrant === grant.id ? '...' : 'Track'}
                      </button>
                    </div>
                  </div>

                  {grant.description && (
                    <p className="text-xs text-bauhaus-black/70 mt-2 line-clamp-2">{grant.description}</p>
                  )}

                  <div className="flex items-center gap-4 mt-3">
                    {grant.amount_max && (
                      <span className="text-xs font-bold text-bauhaus-black">
                        Up to ${grant.amount_max.toLocaleString()}
                      </span>
                    )}
                    {grant.closes_at && (
                      <span className="text-xs text-bauhaus-red font-bold">
                        Closes {new Date(grant.closes_at).toLocaleDateString('en-AU')}
                      </span>
                    )}
                    {grant.grant_type && (
                      <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted border border-bauhaus-black/20 px-2 py-0.5">
                        {grant.grant_type}
                      </span>
                    )}
                    {grant.categories?.slice(0, 3).map(cat => (
                      <span key={cat} className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sidebar panel */}
      {selectedGrant && (
        <GrantSidebar
          grantId={selectedGrant.id}
          fitScore={selectedGrant.fit_score}
          onClose={() => setSelectedGrant(null)}
          onTrack={saveToTracker}
          isTracked={savedGrants.has(selectedGrant.id)}
        />
      )}

      {/* Animation styles */}
      <style jsx global>{`
        @keyframes slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slide-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}

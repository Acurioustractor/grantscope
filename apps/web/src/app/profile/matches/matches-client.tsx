'use client';

import { useEffect, useState } from 'react';
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

export function MatchesClient() {
  const [matches, setMatches] = useState<MatchedGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [minScore, setMinScore] = useState(60);
  const [savingGrant, setSavingGrant] = useState<string | null>(null);
  const [savedGrants, setSavedGrants] = useState<Set<string>>(new Set());
  const [voteCount, setVoteCount] = useState(0);

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

  async function saveToTracker(grantId: string) {
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
  }

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
            <div key={grant.id} className="border-4 border-bauhaus-black bg-white">
              <div className="flex items-stretch">
                {/* Fit score bar */}
                <div className={`w-20 flex-shrink-0 flex flex-col items-center justify-center ${fitColor(grant.fit_score)} border-r-4 border-bauhaus-black`}>
                  <span className="text-2xl font-black text-white">{grant.fit_score}</span>
                  <span className="text-[10px] font-black text-white/80 uppercase">% fit</span>
                </div>

                {/* Content */}
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Link
                        href={`/grants/${grant.id}`}
                        className="text-sm font-black text-bauhaus-black hover:text-bauhaus-blue uppercase tracking-wide"
                      >
                        {grant.name}
                      </Link>
                      <div className="text-xs text-bauhaus-muted mt-1">{grant.provider}</div>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
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
    </div>
  );
}

'use client';

import { useState } from 'react';

interface WatchButtonProps {
  gsId: string;
  entityName: string;
}

export function WatchButton({ gsId, entityName }: WatchButtonProps) {
  const [watching, setWatching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleWatch() {
    setLoading(true);
    setError(null);
    try {
      if (watching) {
        // For now, just toggle visual state — full unwatch requires watch ID
        setWatching(false);
      } else {
        const res = await fetch('/api/watches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gs_id: gsId }),
        });
        if (res.ok) {
          setWatching(true);
        } else if (res.status === 401) {
          setError('Sign in to watch');
        } else {
          setError('Failed');
        }
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggleWatch}
      disabled={loading}
      title={watching ? `Watching ${entityName}` : `Watch ${entityName} for changes`}
      className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 transition-colors disabled:opacity-50 ${
        watching
          ? 'border-bauhaus-blue bg-link-light text-bauhaus-blue hover:bg-white'
          : 'border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-yellow'
      }`}
    >
      {loading ? '...' : watching ? 'Watching' : 'Watch'}
      {error && <span className="ml-1 text-bauhaus-red normal-case">{error}</span>}
    </button>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

/**
 * Auto-claims a founder intake when ?claim=<intakeId> is in the URL.
 * Fires once on mount, shows a brief success toast, then cleans the URL.
 */
export function IntakeClaimer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  const claimId = searchParams.get('claim');

  useEffect(() => {
    if (!claimId) return;

    let cancelled = false;

    async function claim() {
      try {
        const res = await fetch(`/api/start/${claimId}/claim`, { method: 'POST' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        const parts: string[] = [];
        if (data.grants_imported > 0) parts.push(`${data.grants_imported} grants`);
        if (data.foundations_imported > 0) parts.push(`${data.foundations_imported} foundations`);

        setMessage(
          parts.length > 0
            ? `Brief saved! Imported ${parts.join(' and ')} to your tracker.`
            : 'Brief saved to your account!'
        );

        // Clean URL
        const url = new URL(window.location.href);
        url.searchParams.delete('claim');
        router.replace(url.pathname + url.search);

        // Auto-dismiss after 6s
        setTimeout(() => { if (!cancelled) setMessage(null); }, 6000);
      } catch {
        // Silent fail — non-critical
      }
    }

    claim();
    return () => { cancelled = true; };
  }, [claimId, router]);

  if (!message) return null;

  return (
    <div className="mb-4 px-4 py-3 border-2 border-green-600 bg-green-50 text-sm font-bold text-green-800 rounded">
      {message}
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { trackFoundationTarget } from './actions';

/**
 * One-click "Track" — drops a foundation target into the warmth registry.
 * On success the server revalidates /foundations (the view now excludes this
 * foundation) so the row disappears on the next render; we show a transient
 * "Tracked" state in the meantime.
 */
export function TrackButton(props: {
  slug: string;
  gsEntityId: string | null;
  name: string;
  themeHits: number;
  connector: string | null;
  bridgedOrg: string | null;
}) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!props.gsEntityId) return null; // can't track without an entity to dedupe on

  if (done) {
    return <span className="border-2 border-bauhaus-blue bg-bauhaus-blue px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white">Tracked ✓</span>;
  }

  function track() {
    setErr(null);
    start(async () => {
      const res = await trackFoundationTarget({
        slug: props.slug,
        gsEntityId: props.gsEntityId as string,
        name: props.name,
        themeHits: props.themeHits,
        connector: props.connector,
        bridgedOrg: props.bridgedOrg,
      });
      if (!res.ok) { setErr(res.error ?? 'Track failed'); return; }
      setDone(true);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={track}
        disabled={pending}
        title="Add to the warmth registry as a net-new funder"
        className="border-2 border-bauhaus-black bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-black hover:text-white disabled:opacity-50"
      >
        {pending ? 'Tracking…' : '+ Track'}
      </button>
      {err && <span className="max-w-[160px] text-right text-[10px] font-bold text-bauhaus-red">{err}</span>}
    </div>
  );
}

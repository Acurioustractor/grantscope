'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { OrgMarker } from '@/app/api/place/central-australia/organisations/route';

/**
 * Organisations of Central Australia, mapped and filterable.
 *
 * Markers sit on postcode centroids, so everything in a postcode shares a
 * point. Postcode 0872 covers most of the remote centre, so those markers are
 * scattered slightly to stay clickable — the scatter is presentational and the
 * page says so, because a dot that looks like an address would be a lie about
 * where an organisation is.
 */

type Channel = 'total' | 'contracts' | 'grants' | 'delivered';

const CHANNELS: Array<{ key: Channel; label: string; get: (o: OrgMarker) => number; note: string }> = [
  { key: 'total', label: 'All traceable money', get: o => o.totalTraceable, note: 'Contracts plus grants held plus other government grants.' },
  { key: 'contracts', label: 'Contracts', get: o => o.contractValue, note: 'Procurement, by the supplier’s registered address. AusTender publishes no delivery location.' },
  { key: 'grants', label: 'Grants held', get: o => o.grantsReceived, note: 'GrantConnect awards where this organisation is the recipient, wherever the work happens.' },
  { key: 'delivered', label: 'Grants delivered here', get: o => o.grantsDeliveredHere, note: 'Awards delivered into this postcode by anyone. The gap against grants held is money spent here but banked elsewhere.' },
];

function money(value: number): string {
  if (!value) return '$0';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toLocaleString('en-AU', { maximumFractionDigits: 1 })}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
}

/** Deterministic offset so a postcode's organisations do not stack on one pixel. */
function scatter(index: number): [number, number] {
  const golden = 2.399963;
  const r = 0.06 * Math.sqrt(index + 1);
  return [r * Math.cos(index * golden), r * Math.sin(index * golden)];
}

// ssr:false is legal here because this module is itself a client component.
const MapCanvas = dynamic(() => import('./map-canvas').then(m => m.MapCanvas), {
  ssr: false,
  loading: () => <p className="p-4 font-mono text-xs">Loading map…</p>,
});

export function OrganisationsMap() {
  // Leaflet reaches for window at render, so the map waits for mount. Done
  // here rather than with next/dynamic, which cannot take ssr:false inside a
  // Server Component in Next 15.
  const [mounted, setMounted] = useState(false);
  const [orgs, setOrgs] = useState<OrgMarker[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState<Channel>('total');
  const [ccOnly, setCcOnly] = useState(false);
  const [hideZero, setHideZero] = useState(false);
  const [area, setArea] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    fetch('/api/place/central-australia/organisations')
      .then(r => r.json())
      .then(d => (d.error ? setError(d.error) : setOrgs(d.organisations)))
      .catch(e => setError(String(e)));
  }, []);

  const active = CHANNELS.find(c => c.key === channel)!;

  const areas = useMemo(() => {
    const set = new Set<string>();
    for (const o of orgs || []) set.add(o.lga || 'No council recorded');
    return [...set].sort();
  }, [orgs]);

  const filtered = useMemo(() => {
    if (!orgs) return [];
    const q = query.trim().toLowerCase();
    return orgs.filter(o => {
      if (ccOnly && !o.communityControlled) return false;
      if (hideZero && active.get(o) <= 0) return false;
      if (area !== 'all' && (o.lga || 'No council recorded') !== area) return false;
      if (q && !o.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [orgs, ccOnly, hideZero, area, query, active]);

  const max = useMemo(() => Math.max(1, ...filtered.map(active.get)), [filtered, active]);
  const totalShown = useMemo(() => filtered.reduce((sum, o) => sum + active.get(o), 0), [filtered, active]);

  const positions = useMemo(() => {
    const seen = new Map<string, number>();
    return filtered.map(o => {
      const key = `${o.lat},${o.lng}`;
      const n = seen.get(key) || 0;
      seen.set(key, n + 1);
      const [dy, dx] = scatter(n);
      return { org: o, lat: o.lat + dy, lng: o.lng + dx };
    });
  }, [filtered]);

  if (error) return <p className="border-4 border-bauhaus-red bg-white p-4 text-sm">Could not load organisations: {error}</p>;
  if (!orgs) return <p className="border-4 border-bauhaus-black bg-white p-4 font-mono text-xs">Loading organisations…</p>;

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 border-4 border-bauhaus-black bg-white p-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-black uppercase tracking-widest">
          Money channel
          <select value={channel} onChange={e => setChannel(e.target.value as Channel)}
            className="mt-1 min-h-11 w-full border-4 border-bauhaus-black bg-white px-2 text-sm font-bold">
            {CHANNELS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-black uppercase tracking-widest">
          Council
          <select value={area} onChange={e => setArea(e.target.value)}
            className="mt-1 min-h-11 w-full border-4 border-bauhaus-black bg-white px-2 text-sm font-bold">
            <option value="all">All ({orgs.length})</option>
            {areas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="text-xs font-black uppercase tracking-widest">
          Search
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Organisation name"
            className="mt-1 min-h-11 w-full border-4 border-bauhaus-black bg-white px-2 text-sm" />
        </label>
        <div className="grid gap-2 text-xs font-bold">
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={ccOnly} onChange={e => setCcOnly(e.target.checked)} className="h-5 w-5" />
            Community-controlled only
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={hideZero} onChange={e => setHideZero(e.target.checked)} className="h-5 w-5" />
            Hide organisations with no money in this channel
          </label>
        </div>
        <p className="md:col-span-2 lg:col-span-4 border-t-4 border-bauhaus-black pt-3 text-sm leading-6">
          <strong>{filtered.length.toLocaleString('en-AU')}</strong> organisations · <strong>{money(totalShown)}</strong> in
          view. {active.note}
        </p>
      </div>

      <div className="border-4 border-bauhaus-black" style={{ height: 520 }}>
        {mounted ? (
          <MapCanvas positions={positions} valueOf={active.get} max={max} money={money} />
        ) : <p className="p-4 font-mono text-xs">Loading map…</p>}
      </div>

      <p className="font-mono text-[11px] leading-5">
        Red = community-controlled. Blue = other. Circle size is the selected channel. Markers sit on postcode
        centroids and are scattered slightly so they stay clickable — a dot is a postcode, not an address. Postcode
        0872 covers most of the remote centre, so those markers mean &ldquo;somewhere in the homelands&rdquo;.
        A hollow marker has no money in this channel, which may mean it cannot be matched rather than that it
        receives nothing.
      </p>

      <div className="overflow-x-auto border-4 border-bauhaus-black bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-bauhaus-black text-white">
            <tr>
              {['Organisation', 'Council', 'Contracts', 'Grants held', 'Delivered here', 'Other govt'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-mono text-[10px] font-black uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map(o => (
              <tr key={o.id} className="border-b border-bauhaus-black/15">
                <td className="px-3 py-2">
                  {o.communityControlled ? <span className="mr-2 inline-block h-2 w-2 bg-bauhaus-red" aria-hidden="true" /> : null}
                  {o.name}
                </td>
                <td className="px-3 py-2 font-mono text-[11px]">{o.lga || '—'}</td>
                <td className="px-3 py-2 text-right font-mono">{money(o.contractValue)}</td>
                <td className="px-3 py-2 text-right font-mono">{money(o.grantsReceived)}</td>
                <td className="px-3 py-2 text-right font-mono">{money(o.grantsDeliveredHere)}</td>
                <td className="px-3 py-2 text-right font-mono">{money(o.otherGovtGrants)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 200 ? (
          <p className="border-t-4 border-bauhaus-black p-3 font-mono text-[11px]">
            Showing the 200 largest of {filtered.length.toLocaleString('en-AU')}. Narrow the filters to see more.
          </p>
        ) : null}
      </div>
    </div>
  );
}

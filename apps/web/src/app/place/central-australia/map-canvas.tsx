'use client';

import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { OrgMarker } from '@/app/api/place/central-australia/organisations/route';

/**
 * The Leaflet canvas, kept in its own module.
 *
 * react-leaflet reaches for window when the module is evaluated, not when it
 * renders, so gating the render on mount does not help — the import itself
 * throws during SSR. Isolating it here lets the parent client component pull it
 * in with next/dynamic and ssr:false, which is allowed in a client component
 * but not in the Server Component page.
 *
 * One marker per postcode, not per organisation. An earlier version scattered
 * every organisation around its postcode centroid, which drew 1,199 markers
 * across five points as dense spiral discs. They read as geographic spread and
 * were nothing of the kind: we do not know where these organisations sit beyond
 * their postcode, and 0872 alone is larger than most European countries.
 * Aggregating is both more readable and more honest — the circle marks the only
 * location we actually hold.
 */

export interface Positioned { org: OrgMarker; lat: number; lng: number }

interface Cluster {
  key: string;
  lat: number;
  lng: number;
  postcode: string | null;
  lga: string | null;
  orgs: OrgMarker[];
  value: number;
  communityControlled: number;
  ccValue: number;
}

export function MapCanvas({
  positions, valueOf, money,
}: {
  positions: Positioned[];
  valueOf: (o: OrgMarker) => number;
  max: number;
  money: (v: number) => string;
}) {
  const byPostcode = new Map<string, Cluster>();
  for (const { org, lat, lng } of positions) {
    const key = org.postcode || `${lat},${lng}`;
    let cluster = byPostcode.get(key);
    if (!cluster) {
      cluster = {
        key, lat, lng, postcode: org.postcode, lga: org.lga,
        orgs: [], value: 0, communityControlled: 0, ccValue: 0,
      };
      byPostcode.set(key, cluster);
    }
    const v = valueOf(org);
    cluster.orgs.push(org);
    cluster.value += v;
    if (org.communityControlled) {
      cluster.communityControlled += 1;
      cluster.ccValue += v;
    }
  }

  const clusters = [...byPostcode.values()].sort((a, b) => b.value - a.value);
  const biggest = Math.max(1, ...clusters.map(c => c.value));

  return (
    <MapContainer center={[-23.4, 133.5]} zoom={6} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {clusters.map(cluster => {
        // Radius on a square root so area, not radius, tracks the money.
        const radius = cluster.value > 0 ? 10 + 32 * Math.sqrt(cluster.value / biggest) : 8;
        const ccShare = cluster.value > 0 ? cluster.ccValue / cluster.value : 0;
        const top = [...cluster.orgs].sort((a, b) => valueOf(b) - valueOf(a)).slice(0, 6);
        return (
          <CircleMarker
            key={cluster.key}
            center={[cluster.lat, cluster.lng]}
            radius={radius}
            pathOptions={{
              color: '#121212',
              weight: 2,
              // Red where community-controlled organisations hold most of the
              // money at this postcode, blue where they do not.
              fillColor: ccShare >= 0.5 ? '#D02020' : '#1040C0',
              fillOpacity: cluster.value > 0 ? 0.55 : 0.2,
            }}
          >
            <Tooltip direction="top" offset={[0, -4]} opacity={1}>
              <span style={{ fontFamily: 'monospace', fontSize: 11 }}>
                {cluster.postcode || 'no postcode'} · {cluster.orgs.length} orgs · {money(cluster.value)}
              </span>
            </Tooltip>
            <Popup maxWidth={340}>
              <div style={{ fontSize: 13 }}>
                <strong>{cluster.lga || 'No council recorded'} · {cluster.postcode || 'no postcode'}</strong>
                <div style={{ fontFamily: 'monospace', fontSize: 11, marginTop: 4 }}>
                  {cluster.orgs.length} organisations · {cluster.communityControlled} community-controlled
                  <br />
                  {money(cluster.value)} in this channel · {Math.round(ccShare * 100)}% to community-controlled
                </div>
                {cluster.postcode === '0872' ? (
                  <p style={{ fontSize: 11, marginTop: 8 }}>
                    Postcode 0872 covers most of the remote centre across three states. This circle marks the
                    postcode, not a place.
                  </p>
                ) : null}
                <table style={{ marginTop: 8, width: '100%', fontSize: 12 }}>
                  <tbody>
                    {top.map(o => (
                      <tr key={o.id}>
                        <td style={{ paddingRight: 10, verticalAlign: 'top' }}>
                          {o.communityControlled ? <span style={{ color: '#D02020' }}>● </span> : ''}
                          {o.name.length > 34 ? `${o.name.slice(0, 34)}…` : o.name}
                        </td>
                        <td style={{ textAlign: 'right', verticalAlign: 'top', fontFamily: 'monospace' }}>
                          {money(valueOf(o))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {cluster.orgs.length > top.length ? (
                  <p style={{ fontFamily: 'monospace', fontSize: 11, marginTop: 4 }}>
                    and {cluster.orgs.length - top.length} more — see the table below.
                  </p>
                ) : null}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

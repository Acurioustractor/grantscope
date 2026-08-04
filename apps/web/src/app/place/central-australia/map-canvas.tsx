'use client';

import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
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
 */

export interface Positioned { org: OrgMarker; lat: number; lng: number }

export function MapCanvas({
  positions, valueOf, max, money,
}: {
  positions: Positioned[];
  valueOf: (o: OrgMarker) => number;
  max: number;
  money: (v: number) => string;
}) {
  return (

        <MapContainer center={[-23.7, 133.9]} zoom={6} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {positions.map(({ org, lat, lng }) => {
            const value = valueOf(org);
            const radius = value > 0 ? 5 + 22 * Math.sqrt(value / max) : 4;
            return (
              <CircleMarker
                key={org.id}
                center={[lat, lng]}
                radius={radius}
                pathOptions={{
                  color: '#121212',
                  weight: 1,
                  fillColor: org.communityControlled ? '#D02020' : '#1040C0',
                  fillOpacity: value > 0 ? 0.75 : 0.25,
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <strong>{org.name}</strong>
                    <div className="mt-1 font-mono text-[11px]">
                      {org.lga || 'No council recorded'} · {org.postcode || 'no postcode'}
                      {org.communityControlled ? ' · community-controlled' : ''}
                      {org.oricStatus ? ` · ORIC ${org.oricStatus}` : ''}
                    </div>
                    {org.oricSector ? <div className="mt-1 text-[12px]">{org.oricSector}</div> : null}
                    <table className="mt-2 text-[12px]">
                      <tbody>
                        <tr><td className="pr-3">Contracts</td><td>{money(org.contractValue)}</td></tr>
                        <tr><td className="pr-3">Grants held</td><td>{money(org.grantsReceived)}</td></tr>
                        <tr><td className="pr-3">Delivered here</td><td>{money(org.grantsDeliveredHere)}</td></tr>
                        <tr><td className="pr-3">Other govt</td><td>{money(org.otherGovtGrants)}</td></tr>
                      </tbody>
                    </table>
                    {org.totalTraceable === 0 && org.incomeBand ? (
                      <p className="mt-2 max-w-[240px] text-[11px]">
                        No traceable funding, but ORIC records income of {org.incomeBand}
                        {org.employeeBand ? ` and ${org.employeeBand} staff` : ''}. This organisation is active;
                        we simply cannot match it to funding records.
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

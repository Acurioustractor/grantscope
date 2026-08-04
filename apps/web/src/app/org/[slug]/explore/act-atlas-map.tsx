'use client';

import { useEffect } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import type { ActAtlasRecord } from '@/lib/services/act-atlas';
import 'leaflet/dist/leaflet.css';

function FitRecords({ records, selectedId }: { records: ActAtlasRecord[]; selectedId: string | null }) {
  const map = useMap();

  useEffect(() => {
    const selected = records.find((record) => record.id === selectedId);
    if (selected?.latitude !== null && selected?.latitude !== undefined && selected.longitude !== null) {
      map.flyTo([selected.latitude, selected.longitude], Math.max(map.getZoom(), 7), { duration: 0.5 });
      return;
    }
    if (records.length === 1) {
      map.setView([records[0].latitude!, records[0].longitude!], 7);
      return;
    }
    if (records.length > 1) {
      const bounds = records.map((record) => [record.latitude!, record.longitude!]) as LatLngBoundsExpression;
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 7 });
    }
  }, [map, records, selectedId]);

  return null;
}

export function ActAtlasMap({
  records,
  selectedId,
  onSelect,
}: {
  records: ActAtlasRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const located = records.filter((record) => record.latitude !== null && record.longitude !== null);

  if (located.length === 0) {
    return (
      <div className="grid min-h-[520px] place-items-center border border-[var(--ws-border)] bg-[var(--ws-surface-2)] px-6 text-center">
        <div>
          <div className="text-base font-semibold">No mapped records in this view</div>
          <p className="mt-2 text-sm text-[var(--ws-text-secondary)]">Communities appear here when latitude and longitude are recorded.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[520px] overflow-hidden rounded-md border border-[var(--ws-border)] bg-[#e7ebe7]" data-testid="atlas-map">
      <MapContainer center={[-26.5, 134]} zoom={4} scrollWheelZoom className="h-[520px] w-full" style={{ background: '#e7ebe7' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <FitRecords records={located} selectedId={selectedId} />
        {located.map((record) => {
          const selected = record.id === selectedId;
          return (
            <CircleMarker
              key={`${record.type}-${record.id}`}
              center={[record.latitude!, record.longitude!]}
              radius={selected ? 10 : 7}
              pathOptions={{
                color: '#183426',
                fillColor: selected ? '#e7ef65' : '#2f6b4a',
                fillOpacity: 0.9,
                weight: selected ? 3 : 2,
              }}
              eventHandlers={{ click: () => onSelect(record.id) }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <div className="text-xs">
                  <div className="font-semibold">{record.name}</div>
                  <div>{record.subtitle}</div>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded bg-[#183426] px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-widest text-white">
        {located.length} mapped {located.length === 1 ? 'record' : 'records'}
      </div>
    </div>
  );
}

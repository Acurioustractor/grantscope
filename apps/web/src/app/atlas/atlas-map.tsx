'use client';

import { useMemo, useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import type { FeatureCollection, Feature, Geometry } from 'geojson';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  atlasStyleFor,
  ATLAS_NO_DATA_STYLE,
  type AtlasFeature,
  type AtlasLiveLayer,
  type AtlasPoint,
  type AtlasPointLayer,
} from '@/lib/atlas/layers';

interface AtlasMapProps {
  features: AtlasFeature[];
  layer: AtlasLiveLayer;
  selected: AtlasFeature | null;
  onSelect: (f: AtlasFeature) => void;
  /** A point-grain layer drawn over the choropleth. Its data arrives from
   * the surface that is allowed to hold it; this component just draws. */
  pointLayer?: AtlasPointLayer | null;
  points?: AtlasPoint[];
}

const STATE_ABBREV: Record<string, string> = {
  'New South Wales': 'NSW',
  'Victoria': 'VIC',
  'Queensland': 'QLD',
  'South Australia': 'SA',
  'Western Australia': 'WA',
  'Tasmania': 'TAS',
  'Northern Territory': 'NT',
  'Australian Capital Territory': 'ACT',
  'Other Territories': 'OT',
};

// Fit bounds when the visible set changes
function FitBounds({ features }: { features: AtlasFeature[] }) {
  const map = useMap();
  useEffect(() => {
    if (features.length === 0) return;
    const located = features.filter(f => f.lat != null && f.lng != null);
    const lats = located.map(f => Number(f.lat)).filter(v => !isNaN(v));
    const lngs = located.map(f => Number(f.lng)).filter(v => !isNaN(v));
    if (lats.length === 0) return;
    const bounds = L.latLngBounds(
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)]
    );
    map.fitBounds(bounds, { padding: [20, 20] });
  }, [features, map]);
  return null;
}

export default function AtlasMap({ features, layer, selected, onSelect, pointLayer, points }: AtlasMapProps) {
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null);
  const [geoLoading, setGeoLoading] = useState(true);

  // Load GeoJSON boundaries — the same 16MB file /map already served
  useEffect(() => {
    fetch('/data/lga-boundaries.geojson')
      .then(r => r.json())
      .then((data: FeatureCollection) => {
        setGeoData(data);
        setGeoLoading(false);
      })
      .catch(() => setGeoLoading(false));
  }, []);

  // Lookup from lga_name+state → feature; coordless councils still resolve
  // here, painted wherever a boundary name matches
  const featureLookup = useMemo(() => {
    const map = new Map<string, AtlasFeature>();
    for (const f of features) {
      map.set(`${f.lga_name}|${f.state}`, f);
      if (!map.has(f.lga_name)) {
        map.set(f.lga_name, f);
      }
    }
    return map;
  }, [features]);

  const tooltipHtml = useMemo(() => {
    return (data: AtlasFeature): string => {
      const value = layer.value(data);
      const line = value === null
        ? layer.noDataLabel
        : `${layer.name}: <strong>${layer.format(value)}</strong>`;
      // Uncertainty travels with every number: unless the unplaced layer is
      // the one being read, say how much of this place we cannot place.
      const share = data.unplaced_share === null ? '' : ` (${Number(data.unplaced_share).toFixed(0)}%)`;
      const uncertainty = layer.key === 'unplaced-orgs'
        ? ''
        : `<br/>Cannot place: <strong>${data.unplaced_count}</strong>${share}`;
      return `<div class="text-xs">
        <strong>${data.lga_name}</strong> (${data.state})<br/>
        ${line}${uncertainty}
      </div>`;
    };
  }, [layer]);

  // Style function for GeoJSON polygons
  const style = useMemo(() => {
    return (feature: Feature<Geometry, { lga_name: string; state: string }> | undefined) => {
      if (!feature?.properties) return { fillColor: '#ccc', fillOpacity: 0.1, weight: 0.5, color: '#999' };
      const { lga_name, state } = feature.properties;
      const stateAbbrev = STATE_ABBREV[state] || state;
      const data = featureLookup.get(`${lga_name}|${stateAbbrev}`) || featureLookup.get(lga_name);
      const isSelected = selected?.lga_name === data?.lga_name && selected?.state === data?.state;

      const value = data ? layer.value(data) : null;

      if (!data || value === null) {
        return {
          fillColor: ATLAS_NO_DATA_STYLE.color,
          fillOpacity: ATLAS_NO_DATA_STYLE.fillOpacity,
          weight: 0.3,
          color: '#d1d5db',
          opacity: 0.5,
        };
      }

      const paint = atlasStyleFor(layer, value);
      return {
        fillColor: paint.color,
        fillOpacity: isSelected ? 0.85 : paint.fillOpacity,
        weight: isSelected ? 3 : 0.8,
        color: isSelected ? '#121212' : '#666',
        opacity: isSelected ? 1 : 0.4,
      };
    };
  }, [featureLookup, selected, layer]);

  // Click handler for GeoJSON features
  const onEachFeature = useMemo(() => {
    return (feature: Feature<Geometry, { lga_name: string; state: string }>, mapLayer: L.Layer) => {
      const { lga_name, state } = feature.properties;
      const stateAbbrev = STATE_ABBREV[state] || state;
      const data = featureLookup.get(`${lga_name}|${stateAbbrev}`) || featureLookup.get(lga_name);

      if (data) {
        (mapLayer as L.Path).bindTooltip(tooltipHtml(data), { sticky: true });
        mapLayer.on('click', () => onSelect(data));
      } else {
        (mapLayer as L.Path).bindTooltip(
          `<div class="text-xs"><strong>${lga_name}</strong> (${stateAbbrev})<br/>No data held</div>`,
          { sticky: true }
        );
      }
    };
  }, [featureLookup, onSelect, tooltipHtml]);

  // Compute center from features
  const center = useMemo<[number, number]>(() => {
    if (features.length === 0) return [-25.5, 134.0];
    const located = features.filter(f => f.lat != null && f.lng != null);
    const lats = located.map(f => Number(f.lat)).filter(v => !isNaN(v));
    const lngs = located.map(f => Number(f.lng)).filter(v => !isNaN(v));
    if (lats.length === 0) return [-25.5, 134.0];
    return [
      (Math.min(...lats) + Math.max(...lats)) / 2,
      (Math.min(...lngs) + Math.max(...lngs)) / 2,
    ];
  }, [features]);

  // Key to force GeoJSON re-render when style changes
  const geoKey = useMemo(
    () => `${selected?.lga_name}-${selected?.state}-${features.length}-${layer.key}`,
    [selected, features, layer]
  );

  return (
    <MapContainer
      center={center}
      zoom={5}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={true}
      zoomControl={false}
    >
      {/* Default zoom control sits top-left, which the Atlas overlays occupy */}
      <ZoomControl position="bottomright" />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
      />

      {/* GeoJSON choropleth layer */}
      {geoData && !geoLoading && (
        <GeoJSON
          key={geoKey}
          data={geoData}
          style={style}
          onEachFeature={onEachFeature}
        />
      )}

      {/* Labels tile layer on top of polygons */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
        pane="tooltipPane"
      />

      {/* Fallback: CircleMarkers when no GeoJSON loaded */}
      {features.filter(() => !geoData).map((f, i) => {
        if (f.lat == null || f.lng == null) return null;
        const lat = Number(f.lat);
        const lng = Number(f.lng);
        if (isNaN(lat) || isNaN(lng)) return null;
        const value = layer.value(f);
        if (value === null) return null;
        const paint = atlasStyleFor(layer, value);
        return (
          <CircleMarker
            key={`circle-${f.lga_name}-${f.state}-${i}`}
            center={[lat, lng]}
            radius={Math.max(3, Math.min(Math.sqrt(value) * 1.2, 20))}
            pathOptions={{
              fillColor: paint.color,
              fillOpacity: 0.7,
              color: paint.color,
              weight: 1,
            }}
            eventHandlers={{ click: () => onSelect(f) }}
          >
            <Tooltip>
              <div className="text-xs">
                <strong>{f.lga_name}</strong> ({f.state})<br />
                {layer.name}: <strong>{layer.format(value)}</strong>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}

      {/* Point-grain layer over the choropleth (e.g. Goods in community,
          org-side). Radius follows the square root so a big place does not
          drown a small one. */}
      {pointLayer && points?.map(p => {
        const paint = atlasStyleFor(pointLayer, p.value);
        return (
          <CircleMarker
            key={`point-${p.name}`}
            center={[p.lat, p.lng]}
            radius={Math.max(6, Math.min(6 + Math.sqrt(p.value) * 1.6, 26))}
            pathOptions={{
              fillColor: paint.color,
              fillOpacity: paint.fillOpacity,
              color: '#121212',
              weight: 2,
            }}
          >
            <Tooltip>
              <div className="text-xs">
                <strong>{p.name}</strong>
                <br />
                {pointLayer.name}: <strong>{pointLayer.format(p.value)}</strong>
                {p.detail?.map(d => (
                  <span key={d.label}>
                    <br />
                    {d.label}: {d.value}
                  </span>
                ))}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}

      <FitBounds features={features} />
    </MapContainer>
  );
}

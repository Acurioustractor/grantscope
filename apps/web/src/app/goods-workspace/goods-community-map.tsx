'use client';

import { useEffect } from 'react';
import L from 'leaflet';
import { CircleMarker, Popup, TileLayer, useMap } from 'react-leaflet';
import { AustraliaMap } from '@/app/components/australia-map';
import { MapLegend } from '@/app/components/map-legend';
import 'leaflet/dist/leaflet.css';

export type GoodsMapLayer = 'need' | 'beds' | 'washers' | 'fridges' | 'buyer-gaps' | 'partners';

export interface GoodsMapPoint {
  id: string;
  name: string;
  state: string | null;
  lat: number;
  lng: number;
  needScore: number;
  needReason: string;
  demandBeds: number;
  demandWashers: number;
  demandFridges: number;
  buyerCount: number;
  partnerCount: number;
  goodsBuyerGap: boolean;
  crosswalkBuyerGap: boolean;
  postcodeGap: boolean;
  remoteness: string | null;
  proofLine: string | null;
}

interface GoodsCommunityMapProps {
  points: GoodsMapPoint[];
  selectedPoint: GoodsMapPoint | null;
  selectedLayer: GoodsMapLayer;
  onSelect: (id: string) => void;
  onOpenDossier: () => void;
  expanded?: boolean;
  ntOnly?: boolean;
}

function layerLabel(layer: GoodsMapLayer): string {
  switch (layer) {
    case 'beds':
      return 'Beds demand';
    case 'washers':
      return 'Washer demand';
    case 'fridges':
      return 'Fridge demand';
    case 'buyer-gaps':
      return 'Buyer + enrichment gaps';
    case 'partners':
      return 'Partner presence';
    case 'need':
    default:
      return 'Need score';
  }
}

function needColor(score: number): string {
  if (score >= 3000) return '#D02020';
  if (score >= 1800) return '#EA580C';
  if (score >= 900) return '#F0C020';
  if (score > 0) return '#1040C0';
  return '#9CA3AF';
}

function demandColor(value: number): string {
  if (value >= 400) return '#D02020';
  if (value >= 160) return '#EA580C';
  if (value >= 40) return '#F0C020';
  if (value > 0) return '#1040C0';
  return '#9CA3AF';
}

function partnerColor(value: number): string {
  if (value >= 8) return '#059669';
  if (value >= 4) return '#1040C0';
  if (value >= 1) return '#F0C020';
  return '#9CA3AF';
}

function gapColor(point: GoodsMapPoint): string {
  if (point.goodsBuyerGap) return '#D02020';
  if (point.crosswalkBuyerGap) return '#EA580C';
  if (point.postcodeGap) return '#F0C020';
  return '#059669';
}

function layerColor(point: GoodsMapPoint, layer: GoodsMapLayer): string {
  switch (layer) {
    case 'beds':
      return demandColor(point.demandBeds);
    case 'washers':
      return demandColor(point.demandWashers);
    case 'fridges':
      return demandColor(point.demandFridges);
    case 'buyer-gaps':
      return gapColor(point);
    case 'partners':
      return partnerColor(point.partnerCount);
    case 'need':
    default:
      return needColor(point.needScore);
  }
}

function layerValue(point: GoodsMapPoint, layer: GoodsMapLayer): number {
  switch (layer) {
    case 'beds':
      return point.demandBeds;
    case 'washers':
      return point.demandWashers;
    case 'fridges':
      return point.demandFridges;
    case 'buyer-gaps':
      return point.goodsBuyerGap ? 3 : point.crosswalkBuyerGap ? 2 : point.postcodeGap ? 1 : 0;
    case 'partners':
      return point.partnerCount;
    case 'need':
    default:
      return point.needScore;
  }
}

function markerRadius(point: GoodsMapPoint, layer: GoodsMapLayer, selected: boolean): number {
  const value = layerValue(point, layer);
  let radius = 4;
  switch (layer) {
    case 'beds':
    case 'washers':
    case 'fridges':
      radius = Math.max(4, Math.min(14, Math.sqrt(value) * 0.45));
      break;
    case 'buyer-gaps':
      radius = value > 0 ? 8 : 4;
      break;
    case 'partners':
      radius = Math.max(4, Math.min(13, 4 + value * 0.8));
      break;
    case 'need':
    default:
      radius = Math.max(4, Math.min(15, Math.sqrt(value) * 0.18));
      break;
  }
  return selected ? radius + 3 : radius;
}

function layerValueText(point: GoodsMapPoint, layer: GoodsMapLayer): string {
  switch (layer) {
    case 'beds':
      return `${point.demandBeds} beds requested`;
    case 'washers':
      return `${point.demandWashers} washers requested`;
    case 'fridges':
      return `${point.demandFridges} fridges requested`;
    case 'buyer-gaps':
      if (point.goodsBuyerGap) return 'No Goods buyer lead yet';
      if (point.crosswalkBuyerGap) return 'Crosswalk buyer gap';
      if (point.postcodeGap) return 'Postcode / enrichment gap';
      return 'Goods buyer lead present';
    case 'partners':
      return `${point.partnerCount} community-controlled partners`;
    case 'need':
    default:
      return `Need score ${point.needScore}`;
  }
}

function selectedPriorityCallout(point: GoodsMapPoint, layer: GoodsMapLayer): string {
  if (layer === 'buyer-gaps') {
    if (point.goodsBuyerGap) return 'No Goods buyer lead is linked yet, so buyer discovery needs to happen before outreach.';
    if (point.crosswalkBuyerGap) return 'The Goods layer has a lead, but the stricter civic graph crosswalk is still missing for this community.';
    if (point.postcodeGap) return 'This community still needs postcode or enrichment cleanup before the record is fully reliable.';
    return 'This community currently has at least one Goods buyer lead and no known enrichment blocker.';
  }
  if (layer === 'partners') {
    return point.partnerCount > 0
      ? `There are ${point.partnerCount} community-controlled partner signals here that could support production, assembly, or aftercare.`
      : 'Partner visibility is thin here, so local relationship discovery is still needed.';
  }
  if (layer === 'beds' || layer === 'washers' || layer === 'fridges') {
    return `${layerValueText(point, layer)}. ${point.needReason}`;
  }
  return point.needReason;
}

function legendItemsForLayer(layer: GoodsMapLayer) {
  switch (layer) {
    case 'beds':
    case 'washers':
    case 'fridges':
      return [
        { color: '#D02020', label: 'High demand' },
        { color: '#EA580C', label: 'Strong demand' },
        { color: '#F0C020', label: 'Moderate demand' },
        { color: '#1040C0', label: 'Low demand' },
      ];
    case 'buyer-gaps':
      return [
        { color: '#D02020', label: 'No Goods buyer lead' },
        { color: '#EA580C', label: 'Crosswalk gap' },
        { color: '#F0C020', label: 'Postcode gap' },
        { color: '#059669', label: 'Buyer lead present' },
      ];
    case 'partners':
      return [
        { color: '#059669', label: 'Strong partner presence' },
        { color: '#1040C0', label: 'Some partners' },
        { color: '#F0C020', label: 'Thin partner signal' },
        { color: '#9CA3AF', label: 'No known partners' },
      ];
    case 'need':
    default:
      return [
        { color: '#D02020', label: 'Critical pressure' },
        { color: '#EA580C', label: 'High pressure' },
        { color: '#F0C020', label: 'Moderate pressure' },
        { color: '#1040C0', label: 'Lower pressure' },
      ];
  }
}

function FitToGoodsPoints({
  points,
  selectedPoint,
  expanded,
}: {
  points: GoodsMapPoint[];
  selectedPoint: GoodsMapPoint | null;
  expanded: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedPoint) {
      map.flyTo([selectedPoint.lat, selectedPoint.lng], expanded ? 7 : 6, {
        duration: 0.8,
      });
      return;
    }
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lng] as [number, number]));
    map.fitBounds(bounds, { padding: expanded ? [80, 80] : [40, 40] });
  }, [expanded, map, points, selectedPoint]);

  return null;
}

export function GoodsCommunityMap({
  points,
  selectedPoint,
  selectedLayer,
  onSelect,
  onOpenDossier,
  expanded = false,
  ntOnly = true,
}: GoodsCommunityMapProps) {
  if (points.length === 0) {
    return (
      <div className="border-4 border-bauhaus-black bg-white p-6">
        <p className="text-sm text-bauhaus-muted">No mapped communities match the current filters.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <AustraliaMap height={expanded ? 760 : 440}>
        <TileLayer
          attribution='&copy; <a href="https://carto.com">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
          pane="tooltipPane"
        />
        {points.map((point) => {
          const selected = selectedPoint?.id === point.id;
          return (
            <CircleMarker
              key={point.id}
              center={[point.lat, point.lng]}
              radius={markerRadius(point, selectedLayer, selected)}
              pathOptions={{
                color: '#111111',
                fillColor: layerColor(point, selectedLayer),
                fillOpacity: point.goodsBuyerGap || point.crosswalkBuyerGap ? 0.9 : 0.72,
                weight: selected ? 3 : 1,
              }}
              eventHandlers={{
                click: () => onSelect(point.id),
              }}
            >
              <Popup>
                <div className="text-xs max-w-[220px]">
                  <div className="font-black text-sm">{point.name}{point.state ? ` (${point.state})` : ''}</div>
                  <div className="mt-1 text-bauhaus-muted">{point.remoteness || 'Remoteness unknown'}</div>
                  <div className="mt-2 font-semibold">{layerValueText(point, selectedLayer)}</div>
                  <div className="mt-1 text-bauhaus-muted">{selectedPriorityCallout(point, selectedLayer)}</div>
                  <button
                    type="button"
                    onClick={onOpenDossier}
                    className="mt-3 border-2 border-bauhaus-black px-2 py-1 text-[10px] font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white"
                  >
                    Open dossier
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
        <FitToGoodsPoints points={points} selectedPoint={selectedPoint} expanded={expanded} />
      </AustraliaMap>

      <MapLegend title={layerLabel(selectedLayer)} items={legendItemsForLayer(selectedLayer)} />

      <div className="absolute top-4 left-4 z-[1000] bg-white border-2 border-bauhaus-black px-3 py-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
          {ntOnly ? 'NT-first map view' : 'NT + QLD map view'}
        </p>
        <p className="mt-1 text-sm font-black">{points.length} visible communities</p>
      </div>

      <div className="absolute top-4 right-4 z-[1000] max-w-[340px] bg-white border-4 border-bauhaus-black p-4 shadow-[8px_8px_0_0_rgba(0,0,0,0.1)]">
        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">On-map priority callout</p>
        {selectedPoint ? (
          <>
            <h3 className="mt-1 text-lg font-black">
              {selectedPoint.name}
              {selectedPoint.state ? ` (${selectedPoint.state})` : ''}
            </h3>
            <p className="mt-1 text-sm text-bauhaus-muted">{layerValueText(selectedPoint, selectedLayer)}</p>
            <p className="mt-2 text-sm text-bauhaus-black">{selectedPriorityCallout(selectedPoint, selectedLayer)}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="border border-bauhaus-black px-2 py-1">
                <p className="uppercase tracking-widest text-bauhaus-muted">Beds</p>
                <p className="font-black">{selectedPoint.demandBeds}</p>
              </div>
              <div className="border border-bauhaus-black px-2 py-1">
                <p className="uppercase tracking-widest text-bauhaus-muted">Washers</p>
                <p className="font-black">{selectedPoint.demandWashers}</p>
              </div>
              <div className="border border-bauhaus-black px-2 py-1">
                <p className="uppercase tracking-widest text-bauhaus-muted">Fridges</p>
                <p className="font-black">{selectedPoint.demandFridges}</p>
              </div>
              <div className="border border-bauhaus-black px-2 py-1">
                <p className="uppercase tracking-widest text-bauhaus-muted">Partners</p>
                <p className="font-black">{selectedPoint.partnerCount}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenDossier}
              className="mt-3 w-full border-2 border-bauhaus-black px-3 py-2 text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white"
            >
              Open community dossier
            </button>
          </>
        ) : (
          <p className="mt-2 text-sm text-bauhaus-muted">
            Select a community marker to see why it is high priority and jump into its dossier.
          </p>
        )}
      </div>
    </div>
  );
}

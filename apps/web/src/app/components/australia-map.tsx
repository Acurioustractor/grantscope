'use client';

import { ReactNode } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface AustraliaMapProps {
  children: ReactNode;
  height?: number;
}

export function AustraliaMap({ children, height = 550 }: AustraliaMapProps) {
  return (
    <div className="border-4 border-bauhaus-black relative" style={{ height }}>
      <MapContainer
        center={[-28, 134]}
        zoom={4}
        style={{ height: '100%', width: '100%', background: '#F0F0F0' }}
        scrollWheelZoom={true}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
        />
        {children}
      </MapContainer>
    </div>
  );
}

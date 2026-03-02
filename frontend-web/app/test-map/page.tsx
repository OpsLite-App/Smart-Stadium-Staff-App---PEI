'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export default function TestMap() {
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      if (!mapContainer.current || mapRef.current) return;
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;
      if (!isMounted || !mapContainer.current) return;

      // Fix para ícones
      delete (
        (L.Icon.Default as unknown as { prototype: { _getIconUrl?: unknown } }).prototype
      )._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapContainer.current).setView([41.161758, -8.583933], 18);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map);

      L.marker([41.161758, -8.583933])
        .bindPopup('Estádio do Dragão')
        .addTo(map);

      mapRef.current = map;
    };

    initMap();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="h-screen w-full">
      <div ref={mapContainer} className="h-full w-full" />
    </div>
  );
}

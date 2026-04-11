'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { MapBusiness } from './types';
import { MIDDLETOWN_CENTER, DEFAULT_ZOOM } from './types';

interface BaamMapProps {
  businesses: MapBusiness[];
  selectedId?: string | null;
  onSelectBusiness?: (biz: MapBusiness | null) => void;
  userLocation?: { lat: number; lng: number } | null;
  height?: string;
  className?: string;
}

/**
 * BaamMap — Leaflet-based interactive map with custom business pins.
 * Dynamically imports Leaflet to avoid SSR issues.
 */
export default function BaamMap({ businesses, selectedId, onSelectBusiness, userLocation, height = '500px', className = '' }: BaamMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map());
  const [ready, setReady] = useState(false);

  // Load Leaflet CSS
  useEffect(() => {
    if (document.querySelector('link[href*="leaflet"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;

      if (cancelled || !mapRef.current) return;

      const map = L.map(mapRef.current, {
        center: MIDDLETOWN_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: false,
      });

      // Add zoom control to top-right
      L.control.zoom({ position: 'topright' }).addTo(map);

      // Tile layer — Stadia OSM Bright (high detail, Google Maps-like)
      L.tileLayer('https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 20,
      }).addTo(map);

      mapInstanceRef.current = map;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Create custom pin icon
  const createPinIcon = useCallback(async (rank: number, isTop: boolean, isActive: boolean) => {
    const L = (await import('leaflet')).default;
    const size = isActive ? 30 : 24;
    const fontSize = isActive ? 12 : 10;
    const bg = isTop ? '#DC2626' : '#F97316';
    const border = isActive ? '2.5px solid #F97316' : '2px solid white';
    const shadow = isActive ? '0 2px 8px rgba(249,115,22,0.4)' : '0 1px 4px rgba(0,0,0,0.2)';

    return L.divIcon({
      className: 'baam-pin',
      html: `<div style="
        width: ${size}px; height: ${size}px;
        background: ${bg}; border: ${border};
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        box-shadow: ${shadow}; cursor: pointer;
      "><span style="color: white; font-size: ${fontSize}px; font-weight: 800;">${rank}</span></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -(size / 2 + 4)],
    });
  }, []);

  // Render markers when businesses change
  useEffect(() => {
    if (!ready || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    if (businesses.length === 0) return;

    (async () => {
      const L = (await import('leaflet')).default;
      const bounds = L.latLngBounds([]);

      for (let i = 0; i < businesses.length; i++) {
        const biz = businesses[i];
        if (!biz.latitude || !biz.longitude) continue;

        const isActive = biz.id === selectedId;
        const icon = await createPinIcon(i + 1, i < 3, isActive);
        const marker = L.marker([biz.latitude, biz.longitude], { icon }).addTo(map);

        // Popup
        const popupContent = `
          <div style="min-width: 220px; font-family: -apple-system, sans-serif;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <strong style="font-size: 14px;">${biz.display_name}</strong>
              <span style="font-size: 11px; color: white; background: ${i < 3 ? '#DC2626' : '#F97316'}; padding: 2px 8px; border-radius: 6px; font-weight: 700;">#${i + 1}</span>
            </div>
            ${biz.avg_rating ? `<div style="font-size: 13px; color: #6B7280; margin-bottom: 6px;">⭐ ${biz.avg_rating} (${biz.review_count || 0} reviews)</div>` : ''}
            ${biz.short_desc_en ? `<p style="font-size: 12px; color: #6B7280; margin: 0 0 8px; line-height: 1.5;">${biz.short_desc_en.slice(0, 100)}${biz.short_desc_en.length > 100 ? '...' : ''}</p>` : ''}
            ${biz.address_full ? `<div style="font-size: 12px; color: #6B7280; margin-bottom: 4px;">📍 ${biz.address_full.split(',').slice(0, 2).join(',')}</div>` : ''}
            ${biz.phone ? `<div style="font-size: 12px; color: #6B7280; margin-bottom: 8px;">📞 <a href="tel:${biz.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '+1$1')}" style="color: #374151;">${biz.phone}</a></div>` : ''}
            <div style="display: flex; gap: 6px;">
              ${biz.phone ? `<a href="tel:${biz.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '+1$1')}" style="flex: 1; text-align: center; padding: 6px; background: #F97316; color: white; border-radius: 8px; font-size: 12px; font-weight: 600; text-decoration: none;">📞 Call</a>` : ''}
              <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(biz.address_full || '')}" target="_blank" rel="noopener" style="flex: 1; text-align: center; padding: 6px; background: #EFF6FF; color: #2563EB; border-radius: 8px; font-size: 12px; font-weight: 600; text-decoration: none;">🧭 Directions</a>
              <a href="/en/businesses/${biz.slug}" style="flex: 1; text-align: center; padding: 6px; background: #F3F4F6; color: #374151; border-radius: 8px; font-size: 12px; font-weight: 600; text-decoration: none;">📄 Profile</a>
            </div>
          </div>
        `;
        marker.bindPopup(popupContent, { maxWidth: 300, className: 'baam-popup' });

        marker.on('click', () => {
          onSelectBusiness?.(biz);
        });

        markersRef.current.set(biz.id, marker);
        bounds.extend([biz.latitude, biz.longitude]);
      }

      // Fit map to show all pins
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    })();
  }, [businesses, selectedId, ready, createPinIcon, onSelectBusiness]);

  // When selectedId changes, open that marker's popup
  useEffect(() => {
    if (!selectedId || !ready) return;
    const marker = markersRef.current.get(selectedId);
    if (marker) {
      marker.openPopup();
      mapInstanceRef.current?.panTo(marker.getLatLng(), { animate: true });
    }
  }, [selectedId, ready]);

  // Show user location marker
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMarkerRef = useRef<any>(null);
  useEffect(() => {
    if (!userLocation || !ready || !mapInstanceRef.current) return;

    (async () => {
      const L = (await import('leaflet')).default;

      // Remove old marker
      if (userMarkerRef.current) { userMarkerRef.current.remove(); }

      // Blue pulsing dot for user location
      const icon = L.divIcon({
        className: 'baam-pin',
        html: `<div style="width: 18px; height: 18px; background: #3B82F6; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 0 6px rgba(59,130,246,0.25), 0 2px 6px rgba(0,0,0,0.2);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon, zIndexOffset: 1000 })
        .addTo(mapInstanceRef.current)
        .bindPopup('<div style="font-size: 13px; font-weight: 600;">📍 You are here</div>', { className: 'baam-popup' });

      // Pan to user location
      mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 14, { animate: true });
    })();
  }, [userLocation, ready]);

  return (
    <>
      <style>{`
        .baam-pin { background: transparent !important; border: none !important; }
        .baam-popup .leaflet-popup-content-wrapper { border-radius: 14px; padding: 4px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); }
        .baam-popup .leaflet-popup-tip { background: white; }
        .baam-popup .leaflet-popup-content { margin: 10px 14px; }
        .leaflet-control-zoom a { width: 34px !important; height: 34px !important; line-height: 34px !important; font-size: 18px !important; border-radius: 8px !important; }
        .leaflet-control-zoom { border-radius: 10px !important; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08) !important; }
      `}</style>
      <div ref={mapRef} style={{ height, width: '100%' }} className={`rounded-xl overflow-hidden ${className}`} />
    </>
  );
}

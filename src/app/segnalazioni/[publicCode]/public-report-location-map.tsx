"use client";

import { useEffect, useRef, useState } from "react";
import type { LngLatLike, Map as MapLibreMap, Marker } from "maplibre-gl";
import type { PublicMapConfig } from "@/shared/config/map";
import { createSharedMapMarkerElement } from "@/shared/map-marker";

type PublicReportLocationMapProps = {
  address?: string | null;
  config: PublicMapConfig;
  latitude: number;
  longitude: number;
  publicCode: string;
};

export function PublicReportLocationMap({ address, config, latitude, longitude, publicCode }: PublicReportLocationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;

    async function initializeMap() {
      if (!containerRef.current || mapRef.current) {
        return;
      }

      try {
        const maplibregl = await import("maplibre-gl");

        if (cancelled || !containerRef.current) {
          return;
        }

        const center: LngLatLike = [longitude, latitude];
        const map = new maplibregl.Map({
          attributionControl: false,
          center,
          container: containerRef.current,
          interactive: false,
          style: config.style,
          zoom: Math.max(config.initialZoom, 15)
        });

        map.addControl(new maplibregl.AttributionControl({ customAttribution: config.attribution }), "bottom-right");
        mapRef.current = map;

        const markerElement = createSharedMapMarkerElement({
          ariaLabel: `Posizione segnalazione ${publicCode}`,
          testId: `report-detail-marker-${publicCode}`
        });

        markerRef.current = new maplibregl.Marker({ anchor: "bottom", element: markerElement })
          .setLngLat(center)
          .addTo(map);

        resizeObserver = new ResizeObserver(() => map.resize());
        resizeObserver.observe(containerRef.current);
        map.once("load", () => map.resize());
        requestAnimationFrame(() => map.resize());
        setTimeout(() => map.resize(), 0);
      } catch {
        if (!cancelled) {
          setMapError("Non siamo riusciti a caricare la mappa della posizione.");
        }
      }
    }

    void initializeMap();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [address, config.attribution, config.initialZoom, config.style, latitude, longitude, publicCode]);

  if (mapError) {
    return (
      <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground" role="status">
        {mapError}
      </div>
    );
  }

  return (
    <div
      aria-label={address ? `Mappa della posizione: ${address}` : "Mappa della posizione della segnalazione"}
      className="h-64 min-h-64 w-full overflow-hidden rounded-xl border border-border bg-background shadow-sm sm:h-72 sm:min-h-72"
      ref={containerRef}
      role="region"
    />
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LngLatLike, Map as MapLibreMap, Marker } from "maplibre-gl";
import type { PublicMapConfig } from "@/shared/config/map";
import type { PublicReportMapView } from "@/modules/reports/application/public-map";
import { PUBLIC_REPORT_STATUS_LABELS, type PublicReportStatus } from "@/modules/reports/domain";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Select } from "@/shared/ui";

type PublicReportsMapProps = {
  reports: PublicReportMapView[];
  config: PublicMapConfig;
};

const allStatusesOption = "all";
const allCategoriesOption = "all";

const statusMarkerTokens: Record<PublicReportStatus, string> = {
  reported: "--primary",
  communicated: "--chart-2",
  resolved: "--chart-5"
};

export function PublicReportsMap({ reports, config }: PublicReportsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>(allStatusesOption);
  const [selectedCategory, setSelectedCategory] = useState<string>(allCategoriesOption);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const categories = useMemo(() => {
    return Array.from(new Set(reports.map((report) => report.categoryName))).sort((a, b) =>
      a.localeCompare(b, "it")
    );
  }, [reports]);

  const visibleReports = useMemo(() => {
    return reports.filter((report) => {
      const matchesStatus =
        selectedStatus === allStatusesOption || report.publicStatus === selectedStatus;
      const matchesCategory =
        selectedCategory === allCategoriesOption || report.categoryName === selectedCategory;

      return matchesStatus && matchesCategory;
    });
  }, [reports, selectedCategory, selectedStatus]);

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

        const map = new maplibregl.Map({
          container: containerRef.current,
          style: config.style,
          center: [config.initialCenter.longitude, config.initialCenter.latitude] as LngLatLike,
          zoom: config.initialZoom,
          attributionControl: false
        });

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        map.addControl(new maplibregl.AttributionControl({ customAttribution: config.attribution }), "bottom-right");
        mapRef.current = map;

        resizeObserver = new ResizeObserver(() => map.resize());
        resizeObserver.observe(containerRef.current);
        map.once("load", () => map.resize());
        requestAnimationFrame(() => map.resize());
        setTimeout(() => map.resize(), 0);

        setMapReady(true);
      } catch {
        if (!cancelled) {
          setMapError("Non siamo riusciti a caricare la mappa. Puoi usare la lista delle segnalazioni qui sotto.");
        }
      }
    }

    void initializeMap();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [config.attribution, config.initialCenter.latitude, config.initialCenter.longitude, config.initialZoom, config.style]);

  useEffect(() => {
    let cancelled = false;

    async function renderMarkers() {
      const map = mapRef.current;

      if (!mapReady || !map) {
        return;
      }

      const maplibregl = await import("maplibre-gl");

      if (cancelled) {
        return;
      }

      map.resize();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = visibleReports.map((report) => {
        const popup = new maplibregl.Popup({ offset: 24, closeButton: true }).setDOMContent(
          createPopupContent(report)
        );
        const marker = new maplibregl.Marker({ color: getMarkerColor(report.publicStatus) })
          .setLngLat([report.longitude, report.latitude])
          .setPopup(popup)
          .addTo(map);

        marker.getElement().setAttribute("aria-label", `Apri ${report.title}`);
        marker.getElement().setAttribute("data-testid", `map-marker-${report.publicCode}`);
        marker.getElement().tabIndex = 0;

        return marker;
      });

      if (visibleReports.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        visibleReports.forEach((report) => bounds.extend([report.longitude, report.latitude]));
        map.fitBounds(bounds, { padding: 64, maxZoom: 15, duration: 0 });
      } else {
        map.setCenter([config.initialCenter.longitude, config.initialCenter.latitude]);
        map.setZoom(config.initialZoom);
      }
    }

    void renderMarkers();

    return () => {
      cancelled = true;
    };
  }, [config.initialCenter.latitude, config.initialCenter.longitude, config.initialZoom, mapReady, visibleReports]);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="grid gap-2">
              <CardTitle>Mappa pubblica</CardTitle>
              <CardDescription>
                Mostra solo segnalazioni verificate e pubblicate da Visione Comune.
              </CardDescription>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[26rem]">
              <label className="grid gap-1 text-sm font-medium">
                Stato
                <Select
                  aria-label="Filtra per stato"
                  value={selectedStatus}
                  onChange={(event) => setSelectedStatus(event.target.value)}
                >
                  <option value={allStatusesOption}>Tutti gli stati</option>
                  {Object.entries(PUBLIC_REPORT_STATUS_LABELS).map(([status, label]) => (
                    <option key={status} value={status}>
                      {label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Categoria
                <Select
                  aria-label="Filtra per categoria"
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                >
                  <option value={allCategoriesOption}>Tutte le categorie</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div
            ref={containerRef}
            aria-label="Mappa delle segnalazioni pubbliche"
            className="h-[70vh] min-h-[26rem] w-full overflow-hidden rounded-xl border border-border bg-muted shadow-sm sm:h-[36rem]"
            data-testid="public-reports-map"
            role="region"
          />
          {mapError ? (
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              {mapError}
            </p>
          ) : null}
          {visibleReports.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              Non ci sono ancora segnalazioni pubblicate per i filtri selezionati.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <section aria-labelledby="public-map-list-title" className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="public-map-list-title" className="font-serif text-2xl font-semibold">
              Segnalazioni visibili
            </h2>
            <p className="text-sm text-muted-foreground">
              Lista accessibile degli stessi report mostrati sulla mappa.
            </p>
          </div>
          <Badge variant="secondary">{visibleReports.length} visibili</Badge>
        </div>

        {visibleReports.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              Non ci sono ancora segnalazioni pubblicate.
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {visibleReports.map((report) => (
              <li key={report.publicCode}>
                <Card>
                  <CardContent className="grid gap-3 py-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{report.publicStatusLabel}</Badge>
                      <span className="text-sm text-muted-foreground">{report.categoryName}</span>
                    </div>
                    <div className="grid gap-1">
                      <h3 className="font-semibold">{report.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {report.address ?? "Indirizzo non indicato"}
                      </p>
                    </div>
                    <Link
                      className="text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      href={`/segnalazioni/${report.publicCode}`}
                    >
                      Vedi segnalazione
                    </Link>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function createPopupContent(report: PublicReportMapView): HTMLElement {
  const wrapper = document.createElement("article");
  wrapper.className = "grid max-w-64 gap-2 p-1 text-sm";

  const title = document.createElement("h3");
  title.className = "font-semibold";
  title.textContent = report.title;
  wrapper.append(title);

  const meta = document.createElement("p");
  meta.className = "text-muted-foreground";
  meta.textContent = `${report.categoryName} · ${report.publicStatusLabel}`;
  wrapper.append(meta);

  if (report.address) {
    const address = document.createElement("p");
    address.textContent = report.address;
    wrapper.append(address);
  }

  const link = document.createElement("a");
  link.href = `/segnalazioni/${encodeURIComponent(report.publicCode)}`;
  link.textContent = "Vedi segnalazione";
  link.className = "font-semibold text-primary underline";
  wrapper.append(link);

  return wrapper;
}

function getMarkerColor(status: PublicReportStatus): string {
  if (typeof window === "undefined") {
    return "#1a6b3a";
  }

  const token = statusMarkerTokens[status];
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();

  return value || "#1a6b3a";
}

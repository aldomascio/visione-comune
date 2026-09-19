"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LngLatLike, Map as MapLibreMap, Marker } from "maplibre-gl";
import type { PublicMapConfig } from "@/shared/config/map";
import { createSharedMapMarkerElement } from "@/shared/map-marker";
import type { PublicReportMapView } from "@/modules/reports/application/public-map";
import { PUBLIC_REPORT_STATUS_LABELS } from "@/modules/reports/domain";
import { Badge, Card, CardContent, Select, cn } from "@/shared/ui";
import { getMapCategoryStyle, getMapStatusBadgeStyle } from "./map-status-style";

type PublicReportsMapProps = {
  reports: PublicReportMapView[];
  config: PublicMapConfig;
};

const defaultStatusesOption = "active";
const allStatusesOption = "all";
const allCategoriesOption = "all";

export function PublicReportsMap({ reports, config }: PublicReportsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>(defaultStatusesOption);
  const [selectedCategory, setSelectedCategory] = useState<string>(allCategoriesOption);
  const [selectedPublicCode, setSelectedPublicCode] = useState<string | null>(null);
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
        selectedStatus === defaultStatusesOption
          ? report.publicStatus !== "resolved"
          : selectedStatus === allStatusesOption || report.publicStatus === selectedStatus;
      const matchesCategory =
        selectedCategory === allCategoriesOption || report.categoryName === selectedCategory;

      return matchesStatus && matchesCategory;
    });
  }, [reports, selectedCategory, selectedStatus]);

  const hasActiveFilters = selectedStatus !== defaultStatusesOption || selectedCategory !== allCategoriesOption;

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
        const popup = new maplibregl.Popup({
          offset: 22,
          closeButton: true,
          className: "public-map-popup"
        }).setDOMContent(createPopupContent(report));
        const element = createMarkerElement(report, categories, () => {
          setSelectedPublicCode(report.publicCode);
        });
        const marker = new maplibregl.Marker({ element, anchor: "bottom" })
          .setLngLat([report.longitude, report.latitude])
          .setPopup(popup)
          .addTo(map);

        popup.on("close", () => {
          setSelectedPublicCode((current) => (current === report.publicCode ? null : current));
        });

        return marker;
      });

      if (visibleReports.length === 1) {
        const [report] = visibleReports;
        if (report) {
          map.jumpTo({ center: [report.longitude, report.latitude], zoom: Math.max(config.initialZoom, 15) });
        }
      } else if (visibleReports.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        visibleReports.forEach((report) => bounds.extend([report.longitude, report.latitude]));
        map.fitBounds(bounds, { padding: window.innerWidth < 640 ? 44 : 76, maxZoom: 15.5, duration: 0 });
      } else {
        map.setCenter([config.initialCenter.longitude, config.initialCenter.latitude]);
        map.setZoom(config.initialZoom);
      }
    }

    void renderMarkers();

    return () => {
      cancelled = true;
    };
  }, [categories, config.initialCenter.latitude, config.initialCenter.longitude, config.initialZoom, mapReady, visibleReports]);

  function resetFilters() {
    setSelectedStatus(defaultStatusesOption);
    setSelectedCategory(allCategoriesOption);
    setSelectedPublicCode(null);
  }

  return (
    <div className="grid gap-6">
      <section aria-labelledby="public-map-title" className="grid gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="grid gap-2">
            <h2 id="public-map-title" className="font-serif text-2xl font-semibold">
              Mappa pubblica
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Mostra solo segnalazioni verificate e pubblicate da Visione Comune. Usa i filtri per leggere meglio stato e categoria.
            </p>
          </div>
          <div className="grid gap-3 lg:min-w-[30rem]">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium">
                Stato
                <Select
                  aria-label="Filtra per stato"
                  value={selectedStatus}
                  onChange={(event) => setSelectedStatus(event.target.value)}
                >
                  <option value={defaultStatusesOption}>Segnalate e comunicate</option>
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
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>{visibleReports.length} di {reports.length} segnalazioni visibili</span>
              <button
                className="rounded-md px-2 py-1 font-semibold text-primary hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={!hasActiveFilters}
                onClick={resetFilters}
                type="button"
              >
                Azzera filtri
              </button>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-border bg-muted shadow-sm">
          <div
            ref={containerRef}
            aria-label="Mappa delle segnalazioni pubbliche"
            className="h-[72vh] min-h-[28rem] w-full sm:h-[38rem]"
            data-testid="public-reports-map"
            role="region"
          />
        </div>

        {mapError ? (
          <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            {mapError}
          </p>
        ) : null}
        {visibleReports.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            Non ci sono segnalazioni pubblicate per i filtri selezionati.
          </p>
        ) : null}
      </section>

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
              Non ci sono segnalazioni pubblicate per i filtri selezionati.
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {visibleReports.map((report) => {
              const categoryStyle = getMapCategoryStyle(report.categoryName, categories);
              const statusStyle = getMapStatusBadgeStyle(report.publicStatus);
              return (
                <li key={report.publicCode}>
                  <article
                    className={cn(
                      "grid min-h-full gap-3 rounded-xl border border-l-4 bg-card p-5 shadow-sm transition-colors",
                      selectedPublicCode === report.publicCode ? "border-primary bg-accent/40" : "border-border",
                      categoryStyle.listAccentClassName
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold leading-none", statusStyle.badgeClassName)}>
                        {report.publicStatusLabel}
                      </span>
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
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function createMarkerElement(
  report: PublicReportMapView,
  categories: string[],
  onSelect: () => void
): HTMLButtonElement {
  const categoryStyle = getMapCategoryStyle(report.categoryName, categories);

  return createSharedMapMarkerElement({
    ariaLabel: `${report.categoryName}: ${report.title}. Stato ${report.publicStatusLabel}. Apri il popup sulla mappa.`,
    className: categoryStyle.markerClassName.replace("public-map-marker ", ""),
    onClick: onSelect,
    testId: `map-marker-${report.publicCode}`,
    type: "button"
  }) as HTMLButtonElement;
}

function createPopupContent(report: PublicReportMapView): HTMLElement {
  const wrapper = document.createElement("article");
  wrapper.className = "grid max-w-72 gap-3 p-1 text-sm text-foreground";

  const title = document.createElement("h3");
  title.className = "font-semibold leading-snug";
  title.textContent = report.title;
  wrapper.append(title);

  const meta = document.createElement("div");
  meta.className = "flex flex-wrap items-center gap-2";

  const statusStyle = getMapStatusBadgeStyle(report.publicStatus);
  const state = document.createElement("span");
  state.className = `inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold leading-none ${statusStyle.badgeClassName}`;
  state.textContent = report.publicStatusLabel;
  meta.append(state);

  const category = document.createElement("span");
  category.className = "text-xs text-muted-foreground";
  category.textContent = report.categoryName;
  meta.append(category);
  wrapper.append(meta);

  const address = document.createElement("p");
  address.className = "text-sm leading-5 text-muted-foreground";
  address.textContent = report.address ?? "Indirizzo non indicato";
  wrapper.append(address);

  const link = document.createElement("a");
  link.href = `/segnalazioni/${encodeURIComponent(report.publicCode)}`;
  link.textContent = "Vedi segnalazione";
  link.className = "inline-flex min-h-9 items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  wrapper.append(link);

  return wrapper;
}

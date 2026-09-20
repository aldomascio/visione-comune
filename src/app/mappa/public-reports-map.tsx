"use client";

import { MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LngLatLike, Map as MapLibreMap, Marker } from "maplibre-gl";
import type { PublicMapConfig } from "@/shared/config/map";
import { createSharedMapMarkerElement } from "@/shared/map-marker";
import { configureMapLibreWorker, loadVisioneComuneMapStyle } from "@/shared/map-style";
import { formatStreetAddress } from "@/shared/format/address";
import type { PublicReportMapView } from "@/modules/reports/application/public-map";
import { PUBLIC_REPORT_STATUS_LABELS } from "@/modules/reports/domain";
import { Select, cn } from "@/shared/ui";
import { getMapStatusBadgeStyle } from "./map-status-style";

type PublicReportsMapProps = {
  reports: PublicReportMapView[];
  config: PublicMapConfig;
  compact?: boolean;
};

const defaultStatusesOption = "active";
const allStatusesOption = "all";
const allCategoriesOption = "all";

const statusFilters = [
  { value: defaultStatusesOption, label: "Tutti" },
  ...Object.entries(PUBLIC_REPORT_STATUS_LABELS).map(([value, label]) => ({ value, label }))
];

export function PublicReportsMap({ reports, config, compact = false }: PublicReportsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>(defaultStatusesOption);
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
        configureMapLibreWorker(maplibregl);

        if (cancelled || !containerRef.current) {
          return;
        }

        const style = await loadVisioneComuneMapStyle(config.style);

        if (cancelled || !containerRef.current) {
          return;
        }

        const map = new maplibregl.Map({
          container: containerRef.current,
          style,
          center: [config.initialCenter.longitude, config.initialCenter.latitude] as LngLatLike,
          zoom: config.initialZoom,
          maxPitch: 0,
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

      const renderVisibleMarkers = () => {
        markersRef.current.forEach((marker) => marker.remove());
        markersRef.current = groupNearbyReports(map, visibleReports).map((group) => {
          if (group.length > 1) {
            const longitude = group.reduce((sum, report) => sum + report.longitude, 0) / group.length;
            const latitude = group.reduce((sum, report) => sum + report.latitude, 0) / group.length;
            const element = createClusterElement(group.length, () => {
              map.easeTo({
                center: [longitude, latitude],
                duration: 450,
                zoom: Math.min(map.getZoom() + 2, 18)
              });
            });

            return new maplibregl.Marker({ element })
              .setLngLat([longitude, latitude])
              .addTo(map);
          }

          const report = group[0];
          const popup = new maplibregl.Popup({
            closeButton: true,
            className: "public-map-popup",
            focusAfterOpen: false,
            maxWidth: "22rem",
            offset: 24
          }).setDOMContent(createPopupContent(report));
          const element = createMarkerElement(report);
          const marker = new maplibregl.Marker({ element, anchor: "bottom" })
            .setLngLat([report.longitude, report.latitude])
            .setPopup(popup)
            .addTo(map);

          return marker;
        });
      };

      map.resize();
      renderVisibleMarkers();
      map.on("moveend", renderVisibleMarkers);

      if (visibleReports.length === 1) {
        const [report] = visibleReports;
        if (report) {
          map.jumpTo({ center: [report.longitude, report.latitude], zoom: Math.max(config.initialZoom, 15) });
        }
      } else if (visibleReports.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        visibleReports.forEach((report) => bounds.extend([report.longitude, report.latitude]));
        map.fitBounds(bounds, { padding: window.innerWidth < 640 ? 44 : 76, maxZoom: 15.5 });
      } else {
        map.setCenter([config.initialCenter.longitude, config.initialCenter.latitude]);
        map.setZoom(config.initialZoom);
      }

      return () => map.off("moveend", renderVisibleMarkers);
    }

    let removeMapListener: (() => void) | undefined;
    void renderMarkers().then((cleanup) => {
      if (cancelled) {
        cleanup?.();
      } else {
        removeMapListener = cleanup;
      }
    });

    return () => {
      cancelled = true;
      removeMapListener?.();
    };
  }, [categories, config.initialCenter.latitude, config.initialCenter.longitude, config.initialZoom, mapReady, visibleReports]);

  function resetFilters() {
    setSelectedStatus(defaultStatusesOption);
    setSelectedCategory(allCategoriesOption);
  }

  return (
    <div className="grid gap-8">
      <section aria-labelledby="public-map-title" className="grid gap-4">
        {compact ? null : <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-2">
            <h2 id="public-map-title" className="sr-only">Mappa pubblica</h2>
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
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-muted-foreground">Stato</span>
            {statusFilters.map((filter) => {
              const selected = selectedStatus === filter.value;
              return (
                <button
                  aria-pressed={selected}
                  className={cn(
                    "rounded-full px-3 py-1 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                  key={filter.value}
                  onClick={() => setSelectedStatus(filter.value)}
                  type="button"
                >
                  {filter.label}
                </button>
              );
            })}
            {hasActiveFilters ? (
              <button
                className="rounded-full px-3 py-1 text-sm font-semibold text-primary transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                onClick={resetFilters}
                type="button"
              >
                Azzera
              </button>
            ) : null}
          </div>
        </div>}

        <div className="vc-map-surface relative">
          <div
            ref={containerRef}
            aria-label="Mappa delle segnalazioni pubbliche"
            className={compact ? "h-72 w-full sm:h-80" : "h-[62vh] min-h-[24rem] w-full sm:h-[34rem]"}
            data-testid="public-reports-map"
            role="region"
          />
        </div>


        {mapError ? (
          <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            {mapError}
          </p>
        ) : null}
      </section>

      {compact ? null : <section aria-labelledby="public-map-list-title" className="grid gap-4">
        <h2 id="public-map-list-title" className="font-serif text-3xl font-semibold tracking-normal">
          Elenco delle segnalazioni nell&apos;area
        </h2>

        {visibleReports.length === 0 ? (
          <p className="border-y border-border py-6 text-sm text-muted-foreground">
            Non ci sono segnalazioni pubblicate per i filtri selezionati.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visibleReports.map((report) => {
              const statusStyle = getMapStatusBadgeStyle(report.publicStatus);
              return (
                <li key={report.publicCode}>
                  <article
                    className="grid gap-3 py-5 sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div className="grid gap-1.5">
                      <h3 className="font-semibold text-foreground">
                        <Link
                          className="transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          href={`/segnalazioni/${report.publicCode}`}
                        >
                          {report.title}
                        </Link>
                      </h3>
                      {report.address ? (
                        <p className="inline-flex items-center gap-1 text-sm font-normal text-muted-foreground">
                          <MapPin aria-hidden="true" className="size-4 shrink-0" />
                          <span>{formatStreetAddress(report.address)}</span>
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold leading-none", statusStyle.badgeClassName)}>
                        {report.publicStatusLabel}
                      </span>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>}
    </div>
  );
}

function groupNearbyReports(
  map: MapLibreMap,
  reports: PublicReportMapView[],
  radius = 42
): PublicReportMapView[][] {
  const groups: PublicReportMapView[][] = [];

  reports.forEach((report) => {
    const point = map.project([report.longitude, report.latitude]);
    const nearbyGroup = groups.find((group) => {
      const reference = group[0];
      const referencePoint = map.project([reference.longitude, reference.latitude]);
      return Math.hypot(point.x - referencePoint.x, point.y - referencePoint.y) < radius;
    });

    if (nearbyGroup) {
      nearbyGroup.push(report);
    } else {
      groups.push([report]);
    }
  });

  return groups;
}

function createClusterElement(count: number, onClick: () => void): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "public-map-cluster";
  element.setAttribute("aria-label", `${count} segnalazioni vicine. Ingrandisci la mappa.`);
  element.textContent = String(count);
  element.addEventListener("click", onClick);
  return element;
}

function createMarkerElement(report: PublicReportMapView): HTMLButtonElement {
  return createSharedMapMarkerElement({
    ariaLabel: `${report.categoryName}: ${report.title}. Stato ${report.publicStatusLabel}. Apri il popup sulla mappa.`,
    onClick: () => undefined,
    testId: `map-marker-${report.publicCode}`,
    type: "button"
  }) as HTMLButtonElement;
}

function createPopupContent(report: PublicReportMapView): HTMLElement {
  const wrapper = document.createElement("article");
  wrapper.className = "flex h-28 max-w-80 text-sm text-foreground";

  if (report.reportPhotoUrl) {
    const image = document.createElement("img");
    image.alt = `Foto della segnalazione ${report.title}`;
    image.className = "h-28 w-24 shrink-0 object-cover";
    image.loading = "lazy";
    image.src = report.reportPhotoUrl;
    wrapper.append(image);
  }

  const content = document.createElement("div");
  content.className = "grid min-w-0 flex-1 content-center gap-2 p-3 pr-8";

  const title = document.createElement("h3");
  title.className = "font-semibold leading-snug";
  const link = document.createElement("a");
  link.href = `/segnalazioni/${encodeURIComponent(report.publicCode)}`;
  link.textContent = report.title;
  link.className = "line-clamp-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:underline";
  title.append(link);
  content.append(title);

  const address = document.createElement("p");
  address.className = "flex items-start gap-1 text-sm leading-5 text-muted-foreground";

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("class", "mt-0.5 size-4 shrink-0");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "2");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0");
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", "12");
  circle.setAttribute("cy", "10");
  circle.setAttribute("r", "3");
  icon.append(path, circle);

  const addressText = document.createElement("span");
  addressText.textContent = formatStreetAddress(report.address);
  address.append(icon, addressText);
  content.append(address);

  wrapper.append(content);

  return wrapper;
}

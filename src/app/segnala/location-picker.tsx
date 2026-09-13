"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { LngLatLike, Map as MapLibreMap, Marker } from "maplibre-gl";
import type { PublicMapConfig } from "@/shared/config/map";
import { Button, Input } from "@/shared/ui";

type GeocodingResult = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

type LocationPickerProps = {
  mapConfig: PublicMapConfig;
  disabled?: boolean;
  fieldErrors: {
    address?: string;
    latitude?: string;
    longitude?: string;
  };
  initialAddress?: string;
  initialLatitude?: string;
  initialLongitude?: string;
};

type LocationStatus =
  | { type: "idle" }
  | { type: "info"; message: string }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

const minSearchLength = 3;
const debounceMs = 400;
const maxResults = 5;

export function LocationPicker({
  mapConfig,
  disabled = false,
  fieldErrors,
  initialAddress = "",
  initialLatitude = "",
  initialLongitude = ""
}: LocationPickerProps) {
  const listboxId = useId();
  const statusId = useId();
  const mapDescriptionId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [address, setAddress] = useState(initialAddress);
  const [latitude, setLatitude] = useState(initialLatitude);
  const [longitude, setLongitude] = useState(initialLongitude);
  const [locationConfirmed, setLocationConfirmed] = useState(
    isCoordinateString(initialLatitude, initialLongitude)
  );
  const [query, setQuery] = useState(initialAddress);
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [status, setStatus] = useState<LocationStatus>({ type: "idle" });
  const [mapReady, setMapReady] = useState(false);
  const selectedPosition = useMemo(() => {
    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);

    return isValidCoordinate(parsedLatitude, parsedLongitude)
      ? { latitude: parsedLatitude, longitude: parsedLongitude }
      : null;
  }, [latitude, longitude]);

  const updateFromCoordinates = useCallback(async (input: {
    latitude: number;
    longitude: number;
    statusMessage: string;
  }) => {
    const nextLatitude = formatCoordinate(input.latitude);
    const nextLongitude = formatCoordinate(input.longitude);
    setLatitude(nextLatitude);
    setLongitude(nextLongitude);
    setLocationConfirmed(true);
    setStatus({ type: "info", message: input.statusMessage });

    try {
      const response = await fetch(`/api/geocoding/reverse?lat=${nextLatitude}&lon=${nextLongitude}`);

      if (!response.ok) {
        throw new Error("Reverse geocoding failed.");
      }

      const payload = (await response.json()) as { result?: GeocodingResult | null };

      if (payload.result?.label) {
        setAddress(payload.result.label);
        setQuery(payload.result.label);
        setStatus({ type: "success", message: "Posizione confermata." });
      } else {
        setStatus({
          type: "success",
          message: "Posizione confermata. Non abbiamo trovato un indirizzo leggibile, ma puoi continuare."
        });
      }
    } catch {
      setStatus({
        type: "success",
        message: "Posizione confermata. Non siamo riusciti a ricavare l'indirizzo, ma puoi continuare."
      });
    }
  }, []);

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
          style: mapConfig.style,
          center: [mapConfig.initialCenter.longitude, mapConfig.initialCenter.latitude] as LngLatLike,
          zoom: mapConfig.initialZoom,
          attributionControl: false
        });

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        map.addControl(new maplibregl.AttributionControl({ customAttribution: mapConfig.attribution }), "bottom-right");
        map.on("click", (event) => {
          void updateFromCoordinates({
            latitude: event.lngLat.lat,
            longitude: event.lngLat.lng,
            statusMessage: "Punto selezionato sulla mappa. Provo a ricavare l'indirizzo."
          });
        });
        mapRef.current = map;

        resizeObserver = new ResizeObserver(() => map.resize());
        resizeObserver.observe(containerRef.current);
        map.once("load", () => map.resize());
        requestAnimationFrame(() => map.resize());
        setTimeout(() => map.resize(), 0);
        setMapReady(true);
      } catch {
        if (!cancelled) {
          setStatus({
            type: "error",
            message: "Non siamo riusciti a caricare la mappa. Puoi usare ricerca indirizzo o geolocalizzazione."
          });
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
      setMapReady(false);
    };
  }, [mapConfig.attribution, mapConfig.initialCenter.latitude, mapConfig.initialCenter.longitude, mapConfig.initialZoom, mapConfig.style, updateFromCoordinates]);

  useEffect(() => {
    let cancelled = false;

    async function syncMarker() {
      const map = mapRef.current;

      if (!mapReady || !map || !selectedPosition) {
        markerRef.current?.remove();
        markerRef.current = null;
        return;
      }

      const maplibregl = await import("maplibre-gl");

      if (cancelled) {
        return;
      }

      const lngLat: [number, number] = [selectedPosition.longitude, selectedPosition.latitude];

      if (!markerRef.current) {
        markerRef.current = new maplibregl.Marker({ color: getMarkerColor(), draggable: true })
          .setLngLat(lngLat)
          .addTo(map);
        markerRef.current.getElement().setAttribute("aria-label", "Posizione selezionata");
        markerRef.current.getElement().setAttribute("data-testid", "report-location-marker");
        markerRef.current.on("dragend", () => {
          const markerPosition = markerRef.current?.getLngLat();

          if (markerPosition) {
            void updateFromCoordinates({
              latitude: markerPosition.lat,
              longitude: markerPosition.lng,
                statusMessage: "Punto aggiornato sulla mappa. Provo a ricavare l'indirizzo."
            });
          }
        });
      } else {
        markerRef.current.setLngLat(lngLat);
      }

      map.resize();
      map.flyTo({ center: lngLat, zoom: Math.max(map.getZoom(), 15), duration: 0 });
    }

    void syncMarker();

    return () => {
      cancelled = true;
    };
  }, [mapReady, selectedPosition, updateFromCoordinates]);

  useEffect(() => {
    const normalizedQuery = query.trim();

    if (normalizedQuery.length < minSearchLength) {
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setSearching(true);

      try {
        const response = await fetch(
          `/api/geocoding/search?q=${encodeURIComponent(normalizedQuery)}&limit=${maxResults}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("Geocoding search failed.");
        }

        const payload = (await response.json()) as { results?: GeocodingResult[] };
        setResults(payload.results ?? []);
        setActiveIndex(-1);

        if ((payload.results ?? []).length === 0) {
          setStatus({
            type: "info",
            message: "Nessun indirizzo trovato. Puoi selezionare il punto direttamente sulla mappa."
          });
        }
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setStatus({
            type: "error",
            message: "Non siamo riusciti a trovare l'indirizzo. Puoi selezionare il punto direttamente sulla mappa."
          });
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      }
    }, debounceMs);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  function handleAddressChange(nextAddress: string) {
    setAddress(nextAddress);
    setQuery(nextAddress);

    if (nextAddress.trim().length < minSearchLength) {
      setResults([]);
      setSearching(false);
    }

    if (locationConfirmed) {
      setLatitude("");
      setLongitude("");
      setLocationConfirmed(false);
      setStatus({
        type: "info",
        message: "Hai modificato l'indirizzo: seleziona un suggerimento o scegli il punto sulla mappa per confermare la posizione."
      });
    }
  }

  async function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setStatus({
        type: "error",
        message: "Il browser non supporta la geolocalizzazione. Puoi cercare un indirizzo o selezionare il punto sulla mappa."
      });
      return;
    }

    setStatus({ type: "info", message: "Sto rilevando la posizione del browser..." });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void updateFromCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          statusMessage: "Posizione rilevata. Provo a ricavare l'indirizzo."
        });
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? "Permesso negato. Puoi cercare un indirizzo o selezionare il punto sulla mappa."
            : error.code === error.TIMEOUT
              ? "Rilevamento scaduto. Puoi cercare un indirizzo o selezionare il punto sulla mappa."
              : "Non siamo riusciti a rilevare la posizione. Puoi cercare un indirizzo o selezionare il punto sulla mappa.";

        setStatus({ type: "error", message });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 }
    );
  }

  function selectResult(result: GeocodingResult) {
    setAddress(result.label);
    setQuery(result.label);
    setLatitude(formatCoordinate(result.latitude));
    setLongitude(formatCoordinate(result.longitude));
    setLocationConfirmed(true);
    setResults([]);
    setActiveIndex(-1);
    setStatus({ type: "success", message: "Indirizzo selezionato e posizione confermata." });
  }

  function handleAddressKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? results.length - 1 : current - 1));
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const result = results[activeIndex];

      if (result) {
        selectResult(result);
      }
    }

    if (event.key === "Escape") {
      setResults([]);
      setActiveIndex(-1);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <label className="text-sm font-medium text-foreground" htmlFor="address">
          Inserisci indirizzo
        </label>
        <div className="relative">
          <Input
            aria-autocomplete="list"
            aria-controls={results.length > 0 ? listboxId : undefined}
            aria-describedby={[fieldErrors.address ? "address-error" : undefined, statusId]
              .filter(Boolean)
              .join(" ") || undefined}
            aria-expanded={results.length > 0}
            aria-invalid={Boolean(fieldErrors.address)}
            autoComplete="off"
            disabled={disabled}
            id="address"
            name="address"
            onChange={(event) => handleAddressChange(event.currentTarget.value)}
            onKeyDown={handleAddressKeyDown}
            placeholder="Es. Via Colonia Giulia, Venafro"
            role="combobox"
            value={address}
          />
          {results.length > 0 ? (
            <ul
              className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-sm shadow-lg"
              id={listboxId}
              role="listbox"
            >
              {results.map((result, index) => (
                <li key={result.id} role="presentation">
                  <button
                    className={
                      index === activeIndex
                        ? "w-full rounded-sm bg-accent px-3 py-2 text-left text-accent-foreground"
                        : "w-full rounded-sm px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    }
                    aria-selected={index === activeIndex}
                    onClick={() => selectResult(result)}
                    role="option"
                    type="button"
                  >
                    {result.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {searching ? <p className="text-sm text-muted-foreground">Cerco indirizzi...</p> : null}
        <FieldError id="address-error" message={fieldErrors.address} />
        <p className="text-sm leading-6 text-muted-foreground">
          Scrivi almeno {minSearchLength} caratteri e scegli un suggerimento. Se non trovi l&apos;indirizzo, puoi cliccare direttamente sulla mappa.
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-muted/40 p-4">
        <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Posizione del problema</p>
            <p className="text-sm leading-6 text-muted-foreground" id={mapDescriptionId}>
              Usa la ricerca, la tua posizione o clicca sulla mappa per scegliere il punto preciso.
            </p>
          </div>
          <Button disabled={disabled} onClick={handleUseCurrentLocation} type="button" variant="secondary">
            Usa la mia posizione
          </Button>
        </div>

        <div
          aria-describedby={mapDescriptionId}
          aria-label="Mappa per selezionare la posizione della segnalazione"
          className="h-80 min-h-80 w-full overflow-hidden rounded-xl border border-border bg-background shadow-sm"
          data-testid="report-location-map"
          ref={containerRef}
          role="region"
        />

        <div className="sr-only" aria-live="polite">
          {selectedPosition ? `Posizione selezionata: ${selectedPosition.latitude}, ${selectedPosition.longitude}` : "Nessuna posizione selezionata"}
        </div>

        <input name="latitude" type="hidden" value={locationConfirmed ? latitude : ""} />
        <input name="longitude" type="hidden" value={locationConfirmed ? longitude : ""} />

        {fieldErrors.latitude || fieldErrors.longitude ? (
          <div className="text-sm font-medium text-destructive" role="alert">
            {fieldErrors.latitude ?? fieldErrors.longitude}
          </div>
        ) : null}

        {status.type !== "idle" ? (
          <p
            className={
              status.type === "error"
                ? "text-sm font-medium text-destructive"
                : status.type === "success"
                  ? "text-sm font-medium text-primary"
                  : "text-sm text-muted-foreground"
            }
            id={statusId}
            role="status"
          >
            {status.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p className="text-sm font-medium text-destructive" id={id}>
      {message}
    </p>
  );
}

function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

function isCoordinateString(latitude: string, longitude: string): boolean {
  return isValidCoordinate(Number(latitude), Number(longitude));
}

function isValidCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function getMarkerColor(): string {
  if (typeof window === "undefined") {
    return "#1a6b3a";
  }

  return getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || "#1a6b3a";
}

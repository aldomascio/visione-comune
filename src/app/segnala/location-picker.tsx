"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { LngLatLike, Map as MapLibreMap, Marker } from "maplibre-gl";
import { LocateFixed } from "lucide-react";
import type { PublicMapConfig } from "@/shared/config/map";
import { createSharedMapMarkerElement } from "@/shared/map-marker";
import { configureMapLibreWorker, loadVisioneComuneMapStyle } from "@/shared/map-style";
import { Button, Input } from "@/shared/ui";

type GeocodingResult = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

type LocationPickerProps = {
  mapConfig: PublicMapConfig;
  onLocationChange?: (location: { address: string; latitude: string; longitude: string }) => void;
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
  initialLongitude = "",
  onLocationChange
}: LocationPickerProps) {
  const listboxId = useId();
  const statusId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [address, setAddress] = useState(initialAddress);
  const [latitude, setLatitude] = useState(initialLatitude);
  const [longitude, setLongitude] = useState(initialLongitude);
  const [locationConfirmed, setLocationConfirmed] = useState(
    Boolean(initialAddress.trim()) && isCoordinateString(initialLatitude, initialLongitude)
  );
  const [query, setQuery] = useState(initialAddress);
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [status, setStatus] = useState<LocationStatus>({ type: "idle" });
  const [mapReady, setMapReady] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const selectedQueryRef = useRef(initialAddress);
  const locationOperationRef = useRef(0);
  const reverseGeocodingControllerRef = useRef<AbortController | null>(null);
  const onLocationChangeRef = useRef(onLocationChange);

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  useEffect(() => {
    return () => {
      locationOperationRef.current += 1;
      reverseGeocodingControllerRef.current?.abort();
    };
  }, []);

  const selectedPosition = useMemo(() => {
    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);

    return locationConfirmed && isValidCoordinate(parsedLatitude, parsedLongitude)
      ? { latitude: parsedLatitude, longitude: parsedLongitude }
      : null;
  }, [latitude, locationConfirmed, longitude]);

  const beginLocationOperation = useCallback(() => {
    reverseGeocodingControllerRef.current?.abort();
    reverseGeocodingControllerRef.current = null;
    locationOperationRef.current += 1;
    return locationOperationRef.current;
  }, []);

  const updateFromCoordinates = useCallback(async (input: {
    latitude: number;
    longitude: number;
  }, operationId: number) => {
    if (operationId !== locationOperationRef.current) {
      return;
    }

    const nextLatitude = formatCoordinate(input.latitude);
    const nextLongitude = formatCoordinate(input.longitude);
    selectedQueryRef.current = "";
    setAddress("");
    setQuery("");
    setResults([]);
    setActiveIndex(-1);
    setLatitude(nextLatitude);
    setLongitude(nextLongitude);
    setLocationConfirmed(true);
    setShowMap(true);
    onLocationChangeRef.current?.({ address: "", latitude: nextLatitude, longitude: nextLongitude });

    const controller = new AbortController();
    reverseGeocodingControllerRef.current = controller;

    try {
      const response = await fetch(
        `/api/geocoding/reverse?lat=${nextLatitude}&lon=${nextLongitude}`,
        { signal: controller.signal }
      );

      if (!response.ok) {
        throw new Error("Reverse geocoding failed.");
      }

      const payload = (await response.json()) as { result?: GeocodingResult | null };

      if (controller.signal.aborted || operationId !== locationOperationRef.current) {
        return;
      }

      if (payload.result?.label) {
        selectedQueryRef.current = payload.result.label;
        setAddress(payload.result.label);
        setQuery(payload.result.label);
        setResults([]);
        setActiveIndex(-1);
        onLocationChangeRef.current?.({ address: payload.result.label, latitude: nextLatitude, longitude: nextLongitude });
        setStatus({ type: "idle" });
      } else {
        onLocationChangeRef.current?.({ address: "", latitude: nextLatitude, longitude: nextLongitude });
        setStatus({ type: "idle" });
      }
    } catch {
      if (controller.signal.aborted || operationId !== locationOperationRef.current) {
        return;
      }

      onLocationChangeRef.current?.({ address: "", latitude: nextLatitude, longitude: nextLongitude });
      setStatus({ type: "idle" });
    } finally {
      if (reverseGeocodingControllerRef.current === controller) {
        reverseGeocodingControllerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;

    if (!showMap) {
      return undefined;
    }

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

        const style = await loadVisioneComuneMapStyle(mapConfig.style);

        if (cancelled || !containerRef.current) {
          return;
        }

        const map = new maplibregl.Map({
          container: containerRef.current,
          style,
          center: [mapConfig.initialCenter.longitude, mapConfig.initialCenter.latitude] as LngLatLike,
          zoom: mapConfig.initialZoom,
          maxPitch: 0,
          attributionControl: false
        });

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        map.addControl(new maplibregl.AttributionControl({ customAttribution: mapConfig.attribution }), "bottom-right");
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
  }, [mapConfig.attribution, mapConfig.initialCenter.latitude, mapConfig.initialCenter.longitude, mapConfig.initialZoom, mapConfig.style, showMap, updateFromCoordinates]);

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
        const markerElement = createSharedMapMarkerElement({
          ariaLabel: "Posizione selezionata",
          testId: "report-location-marker"
        });
        markerRef.current = new maplibregl.Marker({ anchor: "bottom", draggable: false, element: markerElement })
          .setLngLat(lngLat)
          .addTo(map);
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

    if (normalizedQuery === selectedQueryRef.current) {
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
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

      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setStatus({
            type: "error",
            message: "Non siamo riusciti a trovare l'indirizzo. Puoi provare un indirizzo diverso o usare il pulsante posizione."
          });
        }
      } finally {
        // Request lifecycle intentionally has no visible loading state.
      }
    }, debounceMs);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  function handleAddressChange(nextAddress: string) {
    beginLocationOperation();
    setAddress(nextAddress);
    setQuery(nextAddress);
    selectedQueryRef.current = "";

    if (nextAddress.trim().length < minSearchLength) {
      setResults([]);
    }

    onLocationChangeRef.current?.({ address: nextAddress, latitude: "", longitude: "" });
    setLatitude("");
    setLongitude("");
    setLocationConfirmed(false);
    setShowMap(true);
    setStatus({ type: "idle" });
  }

  async function handleUseCurrentLocation() {
    const operationId = beginLocationOperation();
    setResults([]);
    setActiveIndex(-1);

    if (!navigator.geolocation) {
      setStatus({
        type: "error",
        message: "Il browser non supporta la geolocalizzazione. Puoi cercare e selezionare un indirizzo."
      });
      return;
    }

    const onSuccess: PositionCallback = (position) => {
      if (operationId !== locationOperationRef.current) {
        return;
      }

      void updateFromCoordinates({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      }, operationId);
    };

    const onFinalError: PositionErrorCallback = (error) => {
      if (operationId !== locationOperationRef.current) {
        return;
      }

      const message =
        error.code === error.PERMISSION_DENIED
          ? "Permesso negato. Puoi cercare e selezionare un indirizzo."
          : error.code === error.TIMEOUT
            ? "Rilevamento scaduto. Puoi cercare e selezionare un indirizzo."
            : "Non siamo riusciti a rilevare la posizione. Puoi cercare e selezionare un indirizzo.";

      setShowMap(true);
      setStatus({ type: "error", message });
    };

    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          onFinalError(error);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          onSuccess,
          onFinalError,
          { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 }
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 }
    );
  }

  function selectResult(result: GeocodingResult) {
    beginLocationOperation();
    selectedQueryRef.current = result.label;
    setAddress(result.label);
    setQuery(result.label);
    setLatitude(formatCoordinate(result.latitude));
    setLongitude(formatCoordinate(result.longitude));
    setLocationConfirmed(true);
    setShowMap(true);
    setResults([]);
    setActiveIndex(-1);
    onLocationChangeRef.current?.({ address: result.label, latitude: formatCoordinate(result.latitude), longitude: formatCoordinate(result.longitude) });
    setStatus({ type: "idle" });
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

  const coordinateError = fieldErrors.latitude ?? fieldErrors.longitude;

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <label className="text-sm font-medium text-muted-foreground" htmlFor="address">
          Inserisci indirizzo
        </label>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
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
          <Button
            aria-label="Usa la mia posizione"
            className="h-10 min-h-10 w-10 !p-2.5"
            disabled={disabled}
            onClick={handleUseCurrentLocation}
            title="Usa la mia posizione"
            type="button"
            variant="secondary"
          >
            <LocateFixed aria-hidden="true" size={20} strokeWidth={2.5} />
          </Button>
        </div>
        <FieldError id="address-error" message={fieldErrors.address} />
        {status.type !== "idle" ? <LocationStatusMessage status={status} statusId={statusId} /> : null}
      </div>

      <div className="grid gap-3">
        <div
          aria-label="Mappa della posizione selezionata"
          className="vc-map-surface h-60 min-h-60 w-full sm:h-64 sm:min-h-64"
          data-testid="report-location-map"
          ref={containerRef}
          role="region"
        />

        <div className="sr-only" aria-live="polite">
          {locationConfirmed ? `Posizione selezionata${address ? `: ${address}` : ""}` : "Nessuna posizione selezionata"}
        </div>

        <input name="latitude" type="hidden" value={locationConfirmed ? latitude : ""} />
        <input name="longitude" type="hidden" value={locationConfirmed ? longitude : ""} />

        {coordinateError ? (
          <div className="text-sm font-medium text-destructive" role="alert">
            {coordinateError}
          </div>
        ) : null}

      </div>
    </div>
  );
}

function LocationStatusMessage({ status, statusId }: { status: Exclude<LocationStatus, { type: "idle" }>; statusId: string }) {
  return (
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

export const GEOCODING_MIN_QUERY_LENGTH = 3;
export const GEOCODING_MAX_RESULTS = 5;

export type GeocodingResult = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  city?: string;
  street?: string;
};

export type GeocodingProvider = {
  searchAddress(input: { query: string; limit?: number; bias?: GeocodingBias }): Promise<GeocodingResult[]>;
  reverseGeocode(input: { latitude: number; longitude: number }): Promise<GeocodingResult | null>;
};

export type GeocodingBias = {
  latitude: number;
  longitude: number;
};

export class GeocodingProviderError extends Error {
  constructor(message = "Geocoding provider unavailable.") {
    super(message);
    this.name = "GeocodingProviderError";
  }
}

export function normalizeGeocodingQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

export function validateSearchQuery(query: string): string | null {
  const normalizedQuery = normalizeGeocodingQuery(query);

  return normalizedQuery.length >= GEOCODING_MIN_QUERY_LENGTH ? normalizedQuery : null;
}

export function normalizeGeocodingLimit(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) {
    return GEOCODING_MAX_RESULTS;
  }

  return Math.max(1, Math.min(GEOCODING_MAX_RESULTS, Math.floor(value)));
}

export function isValidCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

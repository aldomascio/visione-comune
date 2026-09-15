import {
  GeocodingProviderError,
  isValidCoordinate,
  normalizeGeocodingLimit,
  normalizeGeocodingQuery,
  type GeocodingProvider,
  type GeocodingResult
} from "../application/geocoding-provider";

const DEFAULT_PHOTON_BASE_URL = "https://photon.komoot.io";
const REQUEST_TIMEOUT_MS = 8_000;

type PhotonFeature = {
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    osm_id?: number | string;
    osm_type?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    country?: string;
  };
};

type PhotonResponse = {
  features?: PhotonFeature[];
};

export class PhotonGeocodingProvider implements GeocodingProvider {
  private readonly baseUrl: string;

  constructor(input: { baseUrl?: string; fetchImpl?: typeof fetch } = {}) {
    this.baseUrl = (input.baseUrl ?? process.env.PHOTON_GEOCODING_BASE_URL ?? DEFAULT_PHOTON_BASE_URL).replace(/\/$/, "");
    this.fetchImpl = input.fetchImpl ?? fetch;
  }

  private readonly fetchImpl: typeof fetch;

  async searchAddress(input: Parameters<GeocodingProvider["searchAddress"]>[0]): Promise<GeocodingResult[]> {
    const query = normalizeGeocodingQuery(input.query);
    const url = new URL(`${this.baseUrl}/api/`);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(normalizeGeocodingLimit(input.limit)));
    if (input.bias) {
      url.searchParams.set("lat", String(input.bias.latitude));
      url.searchParams.set("lon", String(input.bias.longitude));
    }

    const payload = await this.fetchJson(url);
    return mapPhotonResponse(payload);
  }

  async reverseGeocode(input: Parameters<GeocodingProvider["reverseGeocode"]>[0]): Promise<GeocodingResult | null> {
    if (!isValidCoordinate(input.latitude, input.longitude)) {
      return null;
    }

    const url = new URL(`${this.baseUrl}/reverse`);
    url.searchParams.set("lat", String(input.latitude));
    url.searchParams.set("lon", String(input.longitude));
    const payload = await this.fetchJson(url);
    return mapPhotonResponse(payload)[0] ?? null;
  }

  private async fetchJson(url: URL): Promise<PhotonResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await this.fetchImpl(url, {
        headers: { accept: "application/json" },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new GeocodingProviderError(`Photon geocoding failed with status ${response.status}.`);
      }

      return (await response.json()) as PhotonResponse;
    } catch (error) {
      if (error instanceof GeocodingProviderError) {
        throw error;
      }

      throw new GeocodingProviderError();
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function mapPhotonResponse(payload: PhotonResponse): GeocodingResult[] {
  return (payload.features ?? []).flatMap((feature, index) => {
    const coordinates = feature.geometry?.coordinates;
    const longitude = coordinates?.[0];
    const latitude = coordinates?.[1];

    if (typeof latitude !== "number" || typeof longitude !== "number" || !isValidCoordinate(latitude, longitude)) {
      return [];
    }

    const properties = feature.properties ?? {};
    const label = buildPhotonLabel(properties);

    if (!label) {
      return [];
    }

    return [
      {
        id: `${properties.osm_type ?? "photon"}-${properties.osm_id ?? index}-${latitude}-${longitude}`,
        label,
        latitude,
        longitude,
        ...(properties.city ?? properties.town ?? properties.village ? { city: properties.city ?? properties.town ?? properties.village } : {}),
        ...(properties.street ? { street: properties.street } : {})
      }
    ];
  });
}

function buildPhotonLabel(properties: NonNullable<PhotonFeature["properties"]>): string {
  const streetLine = [properties.street ?? properties.name, properties.housenumber].filter(Boolean).join(" ");
  const locality = properties.city ?? properties.town ?? properties.village ?? properties.county;
  const parts = [streetLine, locality, properties.state, properties.country]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  return Array.from(new Set(parts)).join(", ");
}

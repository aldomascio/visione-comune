export type PublicMapConfig = {
  styleUrl: string;
  attribution?: string;
  initialCenter: {
    latitude: number;
    longitude: number;
  };
  initialZoom: number;
};

type EnvSource = Record<string, string | undefined>;

export const VENAFRO_MAP_CENTER = {
  latitude: 41.4821,
  longitude: 14.0474
} as const;

export const VENAFRO_MAP_ZOOM = 13;

export const MAPLIBRE_DEMO_STYLE_URL = "https://demotiles.maplibre.org/style.json";

export function readPublicMapConfig(source: EnvSource = process.env): PublicMapConfig {
  const attribution = readOptionalEnv(source, "NEXT_PUBLIC_MAP_ATTRIBUTION");

  return {
    styleUrl: readOptionalEnv(source, "NEXT_PUBLIC_MAP_STYLE_URL") ?? MAPLIBRE_DEMO_STYLE_URL,
    ...(attribution ? { attribution } : {}),
    initialCenter: VENAFRO_MAP_CENTER,
    initialZoom: VENAFRO_MAP_ZOOM
  };
}

function readOptionalEnv(source: EnvSource, key: string): string | undefined {
  const value = source[key]?.trim();

  return value && value.length > 0 ? value : undefined;
}

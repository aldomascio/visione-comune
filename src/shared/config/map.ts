export type RasterMapStyle = {
  version: 8;
  sources: Record<
    string,
    {
      type: "raster";
      tiles: string[];
      tileSize: number;
      attribution: string;
    }
  >;
  layers: Array<{
    id: string;
    type: "raster";
    source: string;
  }>;
};

export type PublicMapConfig = {
  style: string | RasterMapStyle;
  styleUrl?: string;
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

export const OPENSTREETMAP_RASTER_ATTRIBUTION = "© OpenStreetMap contributors";

export const OPENSTREETMAP_RASTER_STYLE: RasterMapStyle = {
  version: 8,
  sources: {
    openstreetmap: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: OPENSTREETMAP_RASTER_ATTRIBUTION
    }
  },
  layers: [
    {
      id: "openstreetmap",
      type: "raster",
      source: "openstreetmap"
    }
  ]
};

export function readPublicMapConfig(source: EnvSource = process.env): PublicMapConfig {
  const styleUrl = readOptionalEnv(source, "NEXT_PUBLIC_MAP_STYLE_URL");
  const attribution = readOptionalEnv(source, "NEXT_PUBLIC_MAP_ATTRIBUTION");

  return {
    style: styleUrl ?? OPENSTREETMAP_RASTER_STYLE,
    ...(styleUrl ? { styleUrl } : {}),
    attribution: attribution ?? (styleUrl ? undefined : OPENSTREETMAP_RASTER_ATTRIBUTION),
    initialCenter: VENAFRO_MAP_CENTER,
    initialZoom: VENAFRO_MAP_ZOOM
  };
}

function readOptionalEnv(source: EnvSource, key: string): string | undefined {
  const value = source[key]?.trim();

  return value && value.length > 0 ? value : undefined;
}

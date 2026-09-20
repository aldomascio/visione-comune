import type { StyleSpecification, TransformStyleFunction } from "maplibre-gl";

export const MAPLIBRE_WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

export function configureMapLibreWorker(mapLibre: typeof import("maplibre-gl")): void {
  mapLibre.setWorkerUrl(MAPLIBRE_WORKER_URL);
}

export const VISIONE_COMUNE_MAP_COLORS = {
  background: "#F3F3F1",
  residential: "#EAEAE7",
  buildings: "#D5D5D1",
  primaryRoads: "#FFFFFF",
  secondaryRoads: "#E2E2DE",
  vegetation: "#DCE8DF",
  water: "#DCE8EC",
  primaryText: "#111111",
  secondaryText: "#606060",
  boundaries: "#CBCBC6",
  accent: "#1A6B3A"
} as const;

export const applyVisioneComuneMapStyle: TransformStyleFunction = (_previousStyle, nextStyle) => ({
  ...nextStyle,
  terrain: undefined,
  layers: nextStyle.layers
    .filter((layer) => layer.type !== "hillshade")
    .map((layer) => styleLayer(flattenThreeDimensionalLayer(layer))) as StyleSpecification["layers"]
});

export async function loadVisioneComuneMapStyle(
  style: string | StyleSpecification
): Promise<string | StyleSpecification> {
  try {
    const styleDocument = typeof style === "string"
      ? await fetchJson<StyleSpecification>(style)
      : structuredClone(style);
    const vectorSources = Object.entries(styleDocument.sources).filter(
      ([, source]) => source.type === "vector"
    );

    if (vectorSources.length === 0) {
      return styleDocument;
    }

    await Promise.all(vectorSources.map(async ([sourceId, source]) => {
      if (!("url" in source) || typeof source.url !== "string") {
        return;
      }

      const tileJson = await fetchJson<VectorTileJson>(source.url);
      styleDocument.sources[sourceId] = {
        type: "vector",
        tiles: tileJson.tiles,
        ...(tileJson.minzoom === undefined ? {} : { minzoom: tileJson.minzoom }),
        ...(tileJson.maxzoom === undefined ? {} : { maxzoom: tileJson.maxzoom }),
        ...(tileJson.bounds === undefined ? {} : { bounds: tileJson.bounds }),
        ...(tileJson.attribution === undefined ? {} : { attribution: tileJson.attribution })
      };
    }));

    return applyVisioneComuneMapStyle(undefined, styleDocument);
  } catch {
    return style;
  }
}

type VectorTileJson = {
  tiles: string[];
  minzoom?: number;
  maxzoom?: number;
  bounds?: [number, number, number, number];
  attribution?: string;
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Unable to load map style resource: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function styleLayer<T extends StyleSpecification["layers"][number]>(layer: T): T {
  const sourceLayer = "source-layer" in layer ? layer["source-layer"] : undefined;
  const id = layer.id.toLowerCase();
  const paint = { ...(layer.paint ?? {}) } as Record<string, unknown>;

  if (layer.type === "background") {
    paint["background-color"] = VISIONE_COMUNE_MAP_COLORS.background;
  } else if (layer.type === "raster") {
    paint["raster-opacity"] = 0;
  } else if (sourceLayer === "water" || sourceLayer === "waterway" || sourceLayer === "water_name") {
    setGeometryColor(layer.type, paint, VISIONE_COMUNE_MAP_COLORS.water);
    setLabelColor(layer.type, paint, VISIONE_COMUNE_MAP_COLORS.secondaryText);
  } else if (sourceLayer === "park" || isVegetationLayer(id, sourceLayer)) {
    setGeometryColor(layer.type, paint, VISIONE_COMUNE_MAP_COLORS.vegetation);
  } else if (sourceLayer === "building") {
    setGeometryColor(layer.type, paint, VISIONE_COMUNE_MAP_COLORS.buildings);

    if (layer.type === "fill") {
      paint["fill-outline-color"] = VISIONE_COMUNE_MAP_COLORS.boundaries;
    }
  } else if (sourceLayer === "transportation") {
    const isCasing = id.includes("casing") || id.includes("rail") || id.includes("hatching");
    const isPrimary = /motorway|trunk|primary/.test(id);
    setGeometryColor(
      layer.type,
      paint,
      isCasing
        ? VISIONE_COMUNE_MAP_COLORS.boundaries
        : isPrimary
          ? VISIONE_COMUNE_MAP_COLORS.primaryRoads
          : VISIONE_COMUNE_MAP_COLORS.secondaryRoads
    );
  } else if (sourceLayer === "boundary") {
    setGeometryColor(layer.type, paint, VISIONE_COMUNE_MAP_COLORS.boundaries);
  } else if (sourceLayer === "landuse" && id.includes("residential")) {
    setGeometryColor(layer.type, paint, VISIONE_COMUNE_MAP_COLORS.residential);
  } else if (layer.type === "symbol") {
    const isPrimaryLabel = /label_(city|town|village|country)|highway-name-major/.test(id);
    setLabelColor(
      layer.type,
      paint,
      isPrimaryLabel ? VISIONE_COMUNE_MAP_COLORS.primaryText : VISIONE_COMUNE_MAP_COLORS.secondaryText
    );
  } else if (layer.type === "fill") {
    paint["fill-color"] = VISIONE_COMUNE_MAP_COLORS.background;
    paint["fill-outline-color"] = VISIONE_COMUNE_MAP_COLORS.boundaries;
  } else if (layer.type === "line") {
    paint["line-color"] = VISIONE_COMUNE_MAP_COLORS.boundaries;
  }

  if (layer.type === "symbol") {
    paint["text-halo-color"] = VISIONE_COMUNE_MAP_COLORS.background;
  }

  return { ...layer, paint } as T;
}

function flattenThreeDimensionalLayer(
  layer: StyleSpecification["layers"][number]
): StyleSpecification["layers"][number] {
  if (layer.type !== "fill-extrusion") {
    return layer;
  }

  return {
    ...layer,
    type: "fill",
    paint: {}
  } as StyleSpecification["layers"][number];
}

function isVegetationLayer(id: string, sourceLayer?: string): boolean {
  if (sourceLayer !== "landcover" && sourceLayer !== "landuse") {
    return false;
  }

  return /wood|grass|park|pitch|cemetery|wetland/.test(id);
}

function setGeometryColor(type: string, paint: Record<string, unknown>, color: string): void {
  if (type === "fill") {
    paint["fill-color"] = color;
  } else if (type === "line") {
    paint["line-color"] = color;
  }
}

function setLabelColor(type: string, paint: Record<string, unknown>, color: string): void {
  if (type === "symbol") {
    paint["text-color"] = color;
  }
}

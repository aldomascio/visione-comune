import { describe, expect, it } from "vitest";
import type { StyleSpecification } from "maplibre-gl";
import { applyVisioneComuneMapStyle, VISIONE_COMUNE_MAP_COLORS } from "./map-style";

describe("Visione Comune map style", () => {
  it("keeps buildings visible as flat layers and removes terrain shading", () => {
    const style: StyleSpecification = {
      version: 8,
      sources: {
        map: { type: "vector", tiles: ["https://example.test/{z}/{x}/{y}.pbf"] }
      },
      layers: [
        {
          id: "building",
          type: "fill",
          source: "map",
          "source-layer": "building"
        },
        {
          id: "building-3d",
          type: "fill-extrusion",
          source: "map",
          "source-layer": "building"
        },
        {
          id: "terrain-shading",
          type: "hillshade",
          source: "map"
        }
      ]
    };

    const transformed = applyVisioneComuneMapStyle(undefined, style);
    const building = transformed.layers.find((layer) => layer.id === "building");
    const building3d = transformed.layers.find((layer) => layer.id === "building-3d");

    expect(building?.paint).toMatchObject({
      "fill-color": VISIONE_COMUNE_MAP_COLORS.buildings,
      "fill-outline-color": VISIONE_COMUNE_MAP_COLORS.boundaries
    });
    expect(building3d?.type).toBe("fill");
    expect(building3d?.paint).toMatchObject({
      "fill-color": VISIONE_COMUNE_MAP_COLORS.buildings,
      "fill-outline-color": VISIONE_COMUNE_MAP_COLORS.boundaries
    });
    expect(transformed.layers.find((layer) => layer.id === "terrain-shading")).toBeUndefined();
    expect(transformed.terrain).toBeUndefined();
  });
});

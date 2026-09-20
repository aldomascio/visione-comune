import { describe, expect, it } from "vitest";
import { getMapStatusBadgeStyle, MAP_STATUS_BADGE_STYLES } from "./map-status-style";

describe("map status styles", () => {
  it("keeps public status available as a badge instead of the main marker style", () => {
    expect(Object.keys(MAP_STATUS_BADGE_STYLES).sort()).toEqual(["communicated", "reported", "resolved"]);
    expect(getMapStatusBadgeStyle("reported")).toMatchObject({ label: "Segnalata" });
    expect(getMapStatusBadgeStyle("communicated")).toMatchObject({ label: "Comunicata" });
    expect(getMapStatusBadgeStyle("resolved")).toMatchObject({ label: "Risolta" });
  });

  it("uses theme token class names instead of raw color values", () => {
    const payload = JSON.stringify(MAP_STATUS_BADGE_STYLES);
    expect(payload).not.toMatch(/#[0-9a-f]{3,8}|rgb\(|oklch\(/i);
  });
});

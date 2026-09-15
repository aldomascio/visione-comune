import { describe, expect, it } from "vitest";
import { buildHomePublicMetricCards, formatResolutionRate } from "./public-platform-home-metrics";

describe("home public metrics", () => {
  it("maps public platform metrics into reader-facing cards", () => {
    expect(
      buildHomePublicMetricCards({
        published: 12,
        communicated: 7,
        resolved: 3,
        totalConfirmations: 24,
        resolutionRatePercentage: 25
      })
    ).toEqual([
      expect.objectContaining({ key: "published", label: "Segnalazioni pubblicate", value: "12" }),
      expect.objectContaining({ key: "communicated", label: "Comunicate agli enti", value: "7" }),
      expect.objectContaining({ key: "resolved", label: "Problemi risolti", value: "3" }),
      expect.objectContaining({ key: "totalConfirmations", label: "Conferme ricevute", value: "24" }),
      expect.objectContaining({ key: "resolutionRate", label: "Tasso di risoluzione", value: "25%" })
    ]);
  });

  it("handles an empty public dataset without NaN", () => {
    const cards = buildHomePublicMetricCards({
      published: 0,
      communicated: 0,
      resolved: 0,
      totalConfirmations: 0,
      resolutionRatePercentage: null
    });

    expect(cards.map((card) => card.value)).toEqual(["0", "0", "0", "0", "—"]);
  });

  it("formats decimal percentages with Italian number formatting", () => {
    expect(formatResolutionRate(33.3)).toBe("33,3%");
    expect(formatResolutionRate(null)).toBe("—");
  });
});

import { describe, expect, it } from "vitest";
import {
  buildLastMonthKeys,
  buildOperationalMetricsSnapshot,
  calculateMedian,
  calculateResolutionRatePercentage,
  GetPublicPlatformMetricsUseCase,
  type OperationalMetricCounts
} from "./operational-metrics";

const emptyCounts: OperationalMetricCounts = {
  totalReceived: 0,
  pendingReview: 0,
  published: 0,
  communicated: 0,
  resolved: 0,
  rejected: 0,
  totalConfirmations: 0
};

describe("operational metrics", () => {
  it("handles an empty dataset without NaN or division by zero", () => {
    const snapshot = buildOperationalMetricsSnapshot({
      counts: emptyCounts,
      medianResolutionTimeMs: null,
      medianCommunicationTimeMs: null,
      categories: [],
      monthlyTrend: [],
      months: ["2026-04", "2026-05"]
    });

    expect(snapshot.resolutionRate.percentage).toBeNull();
    expect(snapshot.medianResolutionTimeMs).toBeNull();
    expect(snapshot.medianCommunicationTimeMs).toBeNull();
    expect(snapshot.monthlyTrend).toEqual([
      { month: "2026-04", receivedCount: 0, resolvedCount: 0 },
      { month: "2026-05", receivedCount: 0, resolvedCount: 0 }
    ]);
  });

  it("calculates the resolution rate from resolved over published reports", () => {
    expect(calculateResolutionRatePercentage({ published: 8, resolved: 3 })).toBe(37.5);
    expect(calculateResolutionRatePercentage({ published: 0, resolved: 0 })).toBeNull();
  });

  it("calculates medians for odd and even datasets", () => {
    expect(calculateMedian([3, 1, 5])).toBe(3);
    expect(calculateMedian([10, 2, 6, 4])).toBe(5);
    expect(calculateMedian([])).toBeNull();
  });

  it("fills missing monthly trend buckets in a stable order", () => {
    const snapshot = buildOperationalMetricsSnapshot({
      counts: { ...emptyCounts, published: 2, resolved: 1 },
      medianResolutionTimeMs: 86_400_000,
      medianCommunicationTimeMs: 43_200_000,
      categories: [
        { categoryId: "roads", categoryName: "Strade", publishedCount: 2, resolvedCount: 1 }
      ],
      monthlyTrend: [{ month: "2026-03", receivedCount: 4, resolvedCount: 1 }],
      months: ["2026-02", "2026-03", "2026-04"]
    });

    expect(snapshot.monthlyTrend).toEqual([
      { month: "2026-02", receivedCount: 0, resolvedCount: 0 },
      { month: "2026-03", receivedCount: 4, resolvedCount: 1 },
      { month: "2026-04", receivedCount: 0, resolvedCount: 0 }
    ]);
    expect(snapshot.categories).toEqual([
      { categoryId: "roads", categoryName: "Strade", publishedCount: 2, resolvedCount: 1 }
    ]);
  });

  it("builds the last six UTC month keys", () => {
    expect(buildLastMonthKeys(new Date("2026-09-13T12:00:00.000Z"), 6)).toEqual({
      months: ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"],
      from: new Date("2026-04-01T00:00:00.000Z")
    });
  });

  it("exposes only public-safe aggregate fields", async () => {
    const useCase = new GetPublicPlatformMetricsUseCase({
      metricsRepository: {
        async getCounts() {
          return {
            totalReceived: 10,
            pendingReview: 2,
            published: 6,
            communicated: 3,
            resolved: 2,
            rejected: 2,
            totalConfirmations: 7
          };
        }
      }
    });

    await expect(useCase.execute()).resolves.toEqual({
      published: 6,
      communicated: 3,
      resolved: 2,
      totalConfirmations: 7,
      resolutionRatePercentage: 33.3
    });
  });
});

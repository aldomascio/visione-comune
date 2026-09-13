import { describe, expect, it } from "vitest";
import { ListPublicReportsForMapUseCase, getPublicStatusLabel } from "./public-map";
import type { PublicReportMapItem, ReportRepository } from "./report-repository";

const publishedAt = new Date("2026-01-04T10:00:00.000Z");

describe("ListPublicReportsForMapUseCase", () => {
  it("returns the public map payload with readable status labels", async () => {
    const repository = createRepository([
      {
        publicCode: "VC-PUBLIC01",
        title: "Buche in strada",
        categoryName: "Strade",
        latitude: 41.4821,
        longitude: 14.0474,
        address: "Via Roma, Venafro",
        publicStatus: "reported",
        publishedAt
      }
    ]);

    const result = await new ListPublicReportsForMapUseCase({ reportRepository: repository }).execute();

    expect(result).toEqual([
      {
        publicCode: "VC-PUBLIC01",
        title: "Buche in strada",
        categoryName: "Strade",
        latitude: 41.4821,
        longitude: 14.0474,
        address: "Via Roma, Venafro",
        publicStatus: "reported",
        publicStatusLabel: "Segnalata",
        publishedAt
      }
    ]);
  });

  it("does not add internal moderation fields to the map payload", async () => {
    const repository = createRepository([
      {
        publicCode: "VC-PUBLIC01",
        title: "Buche in strada",
        categoryName: "Strade",
        latitude: 41.4821,
        longitude: 14.0474,
        publicStatus: "reported",
        publishedAt
      }
    ]);

    const [result] = await new ListPublicReportsForMapUseCase({ reportRepository: repository }).execute();

    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("moderationStatus");
    expect(result).not.toHaveProperty("description");
    expect(result).not.toHaveProperty("metadata");
  });

  it("maps all public statuses to citizen-facing labels", () => {
    expect(getPublicStatusLabel("reported")).toBe("Segnalata");
    expect(getPublicStatusLabel("communicated")).toBe("Comunicata");
    expect(getPublicStatusLabel("resolved")).toBe("Risolta");
  });
});

function createRepository(reports: PublicReportMapItem[]): ReportRepository {
  return {
    save: async () => undefined,
    findByPublicCode: async () => null,
    listForModeration: async () => [],
    countByModerationStatus: async () => 0,
    findPublicByPublicCode: async () => null,
    listPublicForMap: async () => reports,
    listPublicEventsByPublicCode: async () => []
  };
}

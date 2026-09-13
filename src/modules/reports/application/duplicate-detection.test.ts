import { describe, expect, it } from "vitest";
import type {
  PotentialDuplicateReportQuery,
  PotentialDuplicateReportRecord,
  ReportRepository
} from "./report-repository";
import { FindPotentialDuplicateReportsUseCase } from "./duplicate-detection";

const now = new Date("2026-01-10T10:00:00.000Z");

const baseCandidate: PotentialDuplicateReportRecord = {
  publicCode: "VC-DUP00001",
  title: "Strade: Via Roma",
  categoryName: "Strade",
  latitude: 41.48215,
  longitude: 14.04745,
  address: "Via Roma",
  publicStatus: "reported",
  publishedAt: new Date("2026-01-05T10:00:00.000Z")
};

describe("FindPotentialDuplicateReportsUseCase", () => {
  it("returns a nearby public report in the same category", async () => {
    const repository = new DuplicateRepository([baseCandidate]);
    const useCase = createUseCase(repository);

    await expect(useCase.execute(validInput())).resolves.toMatchObject([
      {
        publicCode: "VC-DUP00001",
        categoryName: "Strade",
        distanceMeters: 7,
        publicStatusLabel: "Segnalata"
      }
    ]);
    expect(repository.lastQuery).toMatchObject({ categoryId: "roads", limit: 50 });
    expect(repository.lastQuery?.publishedAfter).toEqual(new Date("2025-10-12T10:00:00.000Z"));
  });

  it("excludes a different category at repository-query level", async () => {
    const repository = new DuplicateRepository([baseCandidate]);
    const useCase = createUseCase(repository);

    await useCase.execute({ ...validInput(), categoryId: "lighting" });

    expect(repository.lastQuery?.categoryId).toBe("lighting");
  });

  it("excludes candidates farther than the configured distance", async () => {
    const repository = new DuplicateRepository([
      { ...baseCandidate, latitude: 41.484, longitude: 14.04745 }
    ]);
    const useCase = createUseCase(repository);

    await expect(useCase.execute(validInput())).resolves.toEqual([]);
  });

  it("uses the lookback window for old reports", async () => {
    const repository = new DuplicateRepository([]);
    const useCase = createUseCase(repository, { lookbackDays: 30 });

    await useCase.execute(validInput());

    expect(repository.lastQuery?.publishedAfter).toEqual(new Date("2025-12-11T10:00:00.000Z"));
  });

  it("returns no candidates when the repository has none", async () => {
    const useCase = createUseCase(new DuplicateRepository([]));

    await expect(useCase.execute(validInput())).resolves.toEqual([]);
  });

  it("orders candidates by distance and then recency", async () => {
    const repository = new DuplicateRepository([
      {
        ...baseCandidate,
        publicCode: "VC-FAR00001",
        latitude: 41.4829,
        publishedAt: new Date("2026-01-09T10:00:00.000Z")
      },
      {
        ...baseCandidate,
        publicCode: "VC-NEAROLD1",
        publishedAt: new Date("2026-01-02T10:00:00.000Z")
      },
      {
        ...baseCandidate,
        publicCode: "VC-NEARNEW1",
        publishedAt: new Date("2026-01-08T10:00:00.000Z")
      }
    ]);
    const useCase = createUseCase(repository);

    const result = await useCase.execute(validInput());

    expect(result.map((candidate) => candidate.publicCode)).toEqual([
      "VC-NEARNEW1",
      "VC-NEAROLD1",
      "VC-FAR00001"
    ]);
  });

  it("limits the number of returned candidates", async () => {
    const repository = new DuplicateRepository(
      Array.from({ length: 4 }, (_, index) => ({
        ...baseCandidate,
        publicCode: `VC-LIMIT00${index + 1}`,
        longitude: baseCandidate.longitude + index * 0.00001
      }))
    );
    const useCase = createUseCase(repository, { maxCandidates: 2 });

    await expect(useCase.execute(validInput())).resolves.toHaveLength(2);
  });
});

function validInput() {
  return {
    categoryId: "roads",
    latitude: 41.4821,
    longitude: 14.0474,
    description: "Una buca profonda rende difficile il passaggio pedonale vicino alla scuola."
  };
}

function createUseCase(
  repository: DuplicateRepository,
  config: Partial<{ maxCandidates: number; lookbackDays: number }> = {}
) {
  return new FindPotentialDuplicateReportsUseCase({
    reportRepository: repository as unknown as ReportRepository,
    now: () => now,
    config
  });
}

class DuplicateRepository implements Pick<ReportRepository, "findPotentialDuplicates"> {
  lastQuery?: PotentialDuplicateReportQuery;

  constructor(private readonly candidates: PotentialDuplicateReportRecord[]) {}

  async findPotentialDuplicates(input: PotentialDuplicateReportQuery): Promise<PotentialDuplicateReportRecord[]> {
    this.lastQuery = input;
    return this.candidates.filter(
      (candidate) =>
        candidate.latitude >= input.minLatitude &&
        candidate.latitude <= input.maxLatitude &&
        candidate.longitude >= input.minLongitude &&
        candidate.longitude <= input.maxLongitude &&
        candidate.publishedAt >= input.publishedAfter
    );
  }
}

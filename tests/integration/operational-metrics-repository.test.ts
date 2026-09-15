import { inArray, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GetAdminOperationalMetricsUseCase, GetPublicPlatformMetricsUseCase } from "@/modules/analytics/application/operational-metrics";
import { DrizzleOperationalMetricsRepository } from "@/modules/analytics/infrastructure/drizzle-operational-metrics-repository";
import { createDatabaseConnection, type DatabaseConnection } from "@/shared/db/client";
import { categories, reportConfirmations, reportEvents, reports } from "@/shared/db/schema";

const maybeDescribe = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const categoryIds = ["test-metrics-roads", "test-metrics-lighting"];
const reportIds = [
  "test-metrics-pending",
  "test-metrics-rejected",
  "test-metrics-reported",
  "test-metrics-communicated",
  "test-metrics-resolved-a",
  "test-metrics-resolved-b",
  "test-metrics-duplicate-resolved"
];

maybeDescribe("DrizzleOperationalMetricsRepository", () => {
  let connection: DatabaseConnection;
  let repository: DrizzleOperationalMetricsRepository;

  beforeAll(async () => {
    connection = createDatabaseConnection(process.env.TEST_DATABASE_URL);
    await migrate(connection.db, { migrationsFolder: "drizzle" });
    repository = new DrizzleOperationalMetricsRepository(connection.db);
  });

  beforeEach(async () => {
    await cleanupTestData(connection);
  });

  afterAll(async () => {
    if (connection) {
      await cleanupTestData(connection);
      await connection.close();
    }
  });

  it("returns zero-safe metrics for an empty dataset", async () => {
    const snapshot = await new GetAdminOperationalMetricsUseCase({
      metricsRepository: repository,
      now: () => new Date("2026-09-13T12:00:00.000Z")
    }).execute();

    expect(snapshot.counts).toEqual({
      totalReceived: 0,
      pendingReview: 0,
      published: 0,
      communicated: 0,
      resolved: 0,
      rejected: 0,
      totalConfirmations: 0
    });
    expect(snapshot.resolutionRate.percentage).toBeNull();
    expect(snapshot.medianResolutionTimeMs).toBeNull();
    expect(snapshot.medianCommunicationTimeMs).toBeNull();
    expect(snapshot.categories).toEqual([]);
    expect(snapshot.monthlyTrend).toHaveLength(6);
    expect(snapshot.monthlyTrend.every((month) => month.receivedCount === 0 && month.resolvedCount === 0)).toBe(true);
  });

  it("aggregates counts, rates, medians, categories and monthly trend", async () => {
    await seedMetricsDataset(connection);

    const snapshot = await new GetAdminOperationalMetricsUseCase({
      metricsRepository: repository,
      now: () => new Date("2026-09-13T12:00:00.000Z")
    }).execute();

    expect(snapshot.counts).toEqual({
      totalReceived: 7,
      pendingReview: 1,
      published: 4,
      communicated: 3,
      resolved: 2,
      rejected: 1,
      totalConfirmations: 3
    });
    expect(snapshot.resolutionRate).toEqual({ resolved: 2, published: 4, percentage: 50 });
    expect(snapshot.medianResolutionTimeMs).toBe(15 * 86_400_000);
    expect(snapshot.medianCommunicationTimeMs).toBe(2 * 86_400_000);
    expect(snapshot.categories).toEqual([
      { categoryId: "test-metrics-roads", categoryName: "Strade test metriche", publishedCount: 3, resolvedCount: 1 },
      { categoryId: "test-metrics-lighting", categoryName: "Illuminazione test metriche", publishedCount: 1, resolvedCount: 1 }
    ]);
    expect(snapshot.monthlyTrend).toEqual([
      { month: "2026-04", receivedCount: 3, resolvedCount: 1 },
      { month: "2026-05", receivedCount: 3, resolvedCount: 0 },
      { month: "2026-06", receivedCount: 1, resolvedCount: 1 },
      { month: "2026-07", receivedCount: 0, resolvedCount: 0 },
      { month: "2026-08", receivedCount: 0, resolvedCount: 0 },
      { month: "2026-09", receivedCount: 0, resolvedCount: 0 }
    ]);
  });

  it("returns only public-safe aggregate metrics", async () => {
    await seedMetricsDataset(connection);

    await expect(new GetPublicPlatformMetricsUseCase({ metricsRepository: repository }).execute()).resolves.toEqual({
      published: 4,
      communicated: 3,
      resolved: 2,
      totalConfirmations: 3,
      resolutionRatePercentage: 50
    });
  });
});

async function seedMetricsDataset(connection: DatabaseConnection): Promise<void> {
  await connection.db.insert(categories).values([
    {
      id: "test-metrics-roads",
      name: "Strade test metriche",
      slug: "test-metrics-roads"
    },
    {
      id: "test-metrics-lighting",
      name: "Illuminazione test metriche",
      slug: "test-metrics-lighting"
    }
  ]);

  await connection.db.insert(reports).values([
    createReportRow({
      id: "test-metrics-pending",
      publicCode: "VC-METPEND1",
      title: "Report pending metriche",
      categoryId: "test-metrics-roads",
      moderationStatus: "pending_review",
      createdAt: new Date("2026-04-03T10:00:00.000Z")
    }),
    createReportRow({
      id: "test-metrics-rejected",
      publicCode: "VC-METREJ01",
      title: "Report rifiutato metriche",
      categoryId: "test-metrics-roads",
      moderationStatus: "rejected",
      createdAt: new Date("2026-04-04T10:00:00.000Z")
    }),
    createReportRow({
      id: "test-metrics-reported",
      publicCode: "VC-METREP01",
      title: "Report pubblicato metriche",
      categoryId: "test-metrics-roads",
      moderationStatus: "approved",
      publicStatus: "reported",
      createdAt: new Date("2026-05-01T10:00:00.000Z"),
      publishedAt: new Date("2026-05-10T10:00:00.000Z")
    }),
    createReportRow({
      id: "test-metrics-communicated",
      publicCode: "VC-METCOM01",
      title: "Report comunicato metriche",
      categoryId: "test-metrics-roads",
      moderationStatus: "approved",
      publicStatus: "communicated",
      createdAt: new Date("2026-05-02T10:00:00.000Z"),
      publishedAt: new Date("2026-05-05T10:00:00.000Z"),
      communicatedAt: new Date("2026-05-07T10:00:00.000Z")
    }),
    createReportRow({
      id: "test-metrics-resolved-a",
      publicCode: "VC-METRES01",
      title: "Report risolto A metriche",
      categoryId: "test-metrics-roads",
      moderationStatus: "approved",
      publicStatus: "resolved",
      createdAt: new Date("2026-04-01T10:00:00.000Z"),
      publishedAt: new Date("2026-04-01T10:00:00.000Z"),
      communicatedAt: new Date("2026-04-02T10:00:00.000Z"),
      resolvedAt: new Date("2026-04-11T10:00:00.000Z")
    }),

    createReportRow({
      id: "test-metrics-duplicate-resolved",
      publicCode: "VC-METDUP01",
      title: "Report duplicato risolto metriche",
      categoryId: "test-metrics-roads",
      moderationStatus: "approved",
      publicStatus: "resolved",
      createdAt: new Date("2026-05-03T10:00:00.000Z"),
      publishedAt: new Date("2026-05-03T10:00:00.000Z"),
      communicatedAt: new Date("2026-05-04T10:00:00.000Z"),
      resolvedAt: new Date("2026-05-20T10:00:00.000Z"),
      duplicateOfReportId: "test-metrics-reported"
    }),
    createReportRow({
      id: "test-metrics-resolved-b",
      publicCode: "VC-METRES02",
      title: "Report risolto B metriche",
      categoryId: "test-metrics-lighting",
      moderationStatus: "approved",
      publicStatus: "resolved",
      createdAt: new Date("2026-06-01T10:00:00.000Z"),
      publishedAt: new Date("2026-06-01T10:00:00.000Z"),
      communicatedAt: new Date("2026-06-05T10:00:00.000Z"),
      resolvedAt: new Date("2026-06-21T10:00:00.000Z")
    })
  ]);

  await connection.db.insert(reportConfirmations).values([
    { id: "test-metrics-confirmation-1", reportId: "test-metrics-reported", antiAbuseKey: "metrics-a" },
    { id: "test-metrics-confirmation-2", reportId: "test-metrics-communicated", antiAbuseKey: "metrics-b" },
    { id: "test-metrics-confirmation-3", reportId: "test-metrics-resolved-a", antiAbuseKey: "metrics-c" }
  ]);
}

function createReportRow(input: {
  id: string;
  publicCode: string;
  title: string;
  categoryId: string;
  moderationStatus: "pending_review" | "approved" | "rejected";
  publicStatus?: "reported" | "communicated" | "resolved";
  createdAt: Date;
  publishedAt?: Date;
  communicatedAt?: Date;
  resolvedAt?: Date;
  duplicateOfReportId?: string;
}) {
  return {
    id: input.id,
    publicCode: input.publicCode,
    title: input.title,
    description: "Descrizione test per metriche operative con testo sufficiente.",
    categoryId: input.categoryId,
    latitude: 41.482,
    longitude: 14.043,
    address: "Venafro",
    moderationStatus: input.moderationStatus,
    publicStatus: input.publicStatus,
    createdAt: input.createdAt,
    publishedAt: input.publishedAt,
    communicatedAt: input.communicatedAt,
    resolvedAt: input.resolvedAt,
    duplicateOfReportId: input.duplicateOfReportId
  };
}

async function cleanupTestData(connection: DatabaseConnection): Promise<void> {
  await connection.db.delete(reportConfirmations).where(inArray(reportConfirmations.reportId, reportIds));
  await connection.db.delete(reportEvents).where(inArray(reportEvents.reportId, reportIds));
  await connection.db.delete(reports).where(inArray(reports.id, reportIds));
  await connection.db.delete(categories).where(inArray(categories.id, categoryIds));
  await connection.db.delete(categories).where(sql`${categories.slug} in ('test-metrics-roads', 'test-metrics-lighting')`);
}

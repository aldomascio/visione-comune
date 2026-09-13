import { inArray, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseConnection, type DatabaseConnection } from "@/shared/db/client";
import { categories, reportEvents, reports } from "@/shared/db/schema";
import { DrizzleReportRepository } from "@/modules/reports/infrastructure/drizzle-report-repository";
import { DuplicatePublicCodePersistenceError } from "@/modules/reports/application/report-repository";
import { Location, PublicCode, Report } from "@/modules/reports/domain";

const maybeDescribe = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const testCategoryId = "test-roads";
const testReportIds = ["test-report-1", "test-report-2", "test-report-missing-category"];

maybeDescribe("DrizzleReportRepository", () => {
  let connection: DatabaseConnection;
  let repository: DrizzleReportRepository;

  beforeAll(async () => {
    connection = createDatabaseConnection(process.env.TEST_DATABASE_URL);
    await migrate(connection.db, { migrationsFolder: "drizzle" });
    repository = new DrizzleReportRepository(connection.db);
  });

  beforeEach(async () => {
    await cleanupTestData(connection);
    await connection.db.insert(categories).values({
      id: testCategoryId,
      name: "Categoria test strade",
      slug: "test-strade"
    });
  });

  afterAll(async () => {
    if (connection) {
      await cleanupTestData(connection);
      await connection.close();
    }
  });

  it("persists and loads a pending report", async () => {
    const report = createReport("test-report-1", "VC-ABC12345");
    const events = report.pullDomainEvents();

    await repository.save(report, events);

    const foundReport = await repository.findByPublicCode(PublicCode.create("VC-ABC12345"));

    expect(foundReport?.toSnapshot()).toEqual(report.toSnapshot());
  });

  it("persists report status dates and events", async () => {
    const report = createReport("test-report-1", "VC-ABC12345");
    report.pullDomainEvents();
    report.approve(new Date("2026-01-02T10:00:00.000Z"));
    report.markCommunicated(new Date("2026-01-03T10:00:00.000Z"));
    const events = report.pullDomainEvents();

    await repository.save(report, events);

    const foundReport = await repository.findByPublicCode(PublicCode.create("VC-ABC12345"));

    expect(foundReport?.toSnapshot()).toMatchObject({
      moderationStatus: "approved",
      publicStatus: "communicated",
      publishedAt: new Date("2026-01-02T10:00:00.000Z"),
      communicatedAt: new Date("2026-01-03T10:00:00.000Z")
    });

    const savedEvents = await connection.db
      .select({ type: reportEvents.type })
      .from(reportEvents)
      .where(inArray(reportEvents.reportId, testReportIds))
      .orderBy(reportEvents.createdAt);
    expect(savedEvents.map((event) => event.type)).toEqual([
      "ReportApproved",
      "ReportCommunicated"
    ]);
  });

  it("rejects duplicate public codes", async () => {
    await repository.save(createReport("test-report-1", "VC-ABC12345"));

    await expect(repository.save(createReport("test-report-2", "VC-ABC12345"))).rejects.toThrow(
      DuplicatePublicCodePersistenceError
    );
  });

  it("enforces category references", async () => {
    const report = Report.create({
      id: "test-report-missing-category",
      publicCode: PublicCode.create("VC-ABC12345"),
      title: "Buche in strada",
      description: "Sono presenti buche profonde vicino alla scuola.",
      categoryId: "missing-test-category",
      location: Location.create({
        latitude: 41.4821,
        longitude: 14.0474
      }),
      createdAt: new Date("2026-01-01T10:00:00.000Z")
    });

    await expect(repository.save(report)).rejects.toThrow();
  });
});

async function cleanupTestData(connection: DatabaseConnection): Promise<void> {
  await connection.db.delete(reportEvents).where(inArray(reportEvents.reportId, testReportIds));
  await connection.db.delete(reports).where(inArray(reports.id, testReportIds));
  await connection.db.delete(categories).where(sql`${categories.id} = ${testCategoryId}`);
}

function createReport(id: string, publicCode: string): Report {
  return Report.create({
    id,
    publicCode: PublicCode.create(publicCode),
    title: "Buche in strada",
    description: "Sono presenti buche profonde vicino alla scuola.",
    categoryId: testCategoryId,
    location: Location.create({
      latitude: 41.4821,
      longitude: 14.0474,
      address: "Via Roma"
    }),
    createdAt: new Date("2026-01-01T10:00:00.000Z")
  });
}

import { inArray, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ConfirmReportUseCase, ReportNotConfirmableError } from "@/modules/reports/application/confirmations/report-confirmations";
import { DrizzleReportConfirmationRepository } from "@/modules/reports/infrastructure/confirmations/drizzle-report-confirmation-repository";
import { DrizzleReportRepository } from "@/modules/reports/infrastructure/drizzle-report-repository";
import { Location, PublicCode, Report } from "@/modules/reports/domain";
import { createDatabaseConnection, type DatabaseConnection } from "@/shared/db/client";
import { categories, reportConfirmations, reportEvents, reports } from "@/shared/db/schema";

const maybeDescribe = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const testCategoryId = "test-confirmations-category";
const testReportIds = [
  "test-confirmation-approved",
  "test-confirmation-pending",
  "test-confirmation-rejected"
];

maybeDescribe("DrizzleReportConfirmationRepository", () => {
  let connection: DatabaseConnection;
  let reportRepository: DrizzleReportRepository;
  let confirmationRepository: DrizzleReportConfirmationRepository;

  beforeAll(async () => {
    connection = createDatabaseConnection(process.env.TEST_DATABASE_URL);
    await migrate(connection.db, { migrationsFolder: "drizzle" });
    reportRepository = new DrizzleReportRepository(connection.db);
    confirmationRepository = new DrizzleReportConfirmationRepository(connection.db);
  });

  beforeEach(async () => {
    await cleanupTestData(connection);
    await connection.db.insert(categories).values({
      id: testCategoryId,
      name: "Categoria test conferme",
      slug: "categoria-test-conferme"
    });
  });

  afterAll(async () => {
    if (connection) {
      await cleanupTestData(connection);
      await connection.close();
    }
  });

  it("persists one confirmation and counts it", async () => {
    await saveApprovedReport("test-confirmation-approved", "VC-CONF0001");

    const result = await createUseCase().execute({
      publicCode: "VC-CONF0001",
      antiAbuseKey: "browser-a"
    });

    expect(result).toMatchObject({ count: 1, alreadyConfirmed: true, created: true });
    await expect(confirmationRepository.countByReportId("test-confirmation-approved")).resolves.toBe(1);
    await expect(
      confirmationRepository.exists({
        reportId: "test-confirmation-approved",
        antiAbuseKey: "browser-a"
      })
    ).resolves.toBe(true);
  });

  it("does not duplicate confirmations for the same report and anti-abuse key", async () => {
    await saveApprovedReport("test-confirmation-approved", "VC-CONF0001");
    const useCase = createUseCase();

    await useCase.execute({ publicCode: "VC-CONF0001", antiAbuseKey: "browser-a" });
    const secondResult = await useCase.execute({ publicCode: "VC-CONF0001", antiAbuseKey: "browser-a" });

    expect(secondResult).toMatchObject({ count: 1, created: false });
    await expect(
      connection.db.insert(reportConfirmations).values({
        id: "test-confirmation-duplicate",
        reportId: "test-confirmation-approved",
        antiAbuseKey: "browser-a"
      })
    ).rejects.toThrow();
  });

  it("allows multiple pseudonymous browsers to confirm the same report", async () => {
    await saveApprovedReport("test-confirmation-approved", "VC-CONF0001");
    const useCase = createUseCase();

    await useCase.execute({ publicCode: "VC-CONF0001", antiAbuseKey: "browser-a" });
    const secondResult = await useCase.execute({ publicCode: "VC-CONF0001", antiAbuseKey: "browser-b" });

    expect(secondResult).toMatchObject({ count: 2, created: true });
  });

  it("does not allow confirmations for pending or rejected reports", async () => {
    await reportRepository.save(createPendingReport("test-confirmation-pending", "VC-CONF0002"));
    const rejectedReport = createPendingReport("test-confirmation-rejected", "VC-CONF0003");
    await reportRepository.save(rejectedReport, rejectedReport.pullDomainEvents());
    rejectedReport.reject(new Date("2026-01-05T10:00:00.000Z"));
    await reportRepository.save(rejectedReport, rejectedReport.pullDomainEvents(), {
      expectedModerationStatus: "pending_review"
    });
    const useCase = createUseCase();

    await expect(
      useCase.execute({ publicCode: "VC-CONF0002", antiAbuseKey: "browser-a" })
    ).rejects.toThrow(ReportNotConfirmableError);
    await expect(
      useCase.execute({ publicCode: "VC-CONF0003", antiAbuseKey: "browser-a" })
    ).rejects.toThrow(ReportNotConfirmableError);
    await expect(confirmationRepository.countByReportId("test-confirmation-pending")).resolves.toBe(0);
    await expect(confirmationRepository.countByReportId("test-confirmation-rejected")).resolves.toBe(0);
  });

  it("does not allow confirmations for missing reports", async () => {
    await expect(
      createUseCase().execute({ publicCode: "VC-MISSING1", antiAbuseKey: "browser-a" })
    ).rejects.toThrow(ReportNotConfirmableError);
  });

  function createUseCase() {
    return new ConfirmReportUseCase({
      reportRepository,
      confirmationRepository,
      now: () => new Date("2026-01-06T10:00:00.000Z"),
      createId: () => `test-confirmation-${Math.random().toString(36).slice(2)}`
    });
  }

  async function saveApprovedReport(id: string, publicCode: string): Promise<void> {
    const report = createPendingReport(id, publicCode);
    await reportRepository.save(report, report.pullDomainEvents());
    report.approve(new Date("2026-01-04T10:00:00.000Z"));
    await reportRepository.save(report, report.pullDomainEvents(), {
      expectedModerationStatus: "pending_review"
    });
  }
});

async function cleanupTestData(connection: DatabaseConnection): Promise<void> {
  await connection.db.delete(reportConfirmations).where(inArray(reportConfirmations.reportId, testReportIds));
  await connection.db.delete(reportEvents).where(inArray(reportEvents.reportId, testReportIds));
  await connection.db.delete(reports).where(inArray(reports.id, testReportIds));
  await connection.db.delete(categories).where(sql`${categories.id} = ${testCategoryId}`);
}

function createPendingReport(id: string, publicCode: string): Report {
  return Report.create({
    id,
    publicCode: PublicCode.create(publicCode),
    title: "Report da confermare",
    description: "Descrizione lunga del report da usare per i test delle conferme.",
    categoryId: testCategoryId,
    location: Location.create({ latitude: 41.4821, longitude: 14.0474, address: "Via Roma" }),
    createdAt: new Date("2026-01-01T10:00:00.000Z")
  });
}

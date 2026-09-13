import { inArray, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseConnection, type DatabaseConnection } from "@/shared/db/client";
import { categories, reportAttachments, reportEvents, reports } from "@/shared/db/schema";
import { DrizzleReportRepository } from "@/modules/reports/infrastructure/drizzle-report-repository";
import { DuplicatePublicCodePersistenceError } from "@/modules/reports/application/report-repository";
import { Location, PublicCode, Report } from "@/modules/reports/domain";

const maybeDescribe = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const testCategoryId = "test-roads";
const testReportIds = [
  "test-report-1",
  "test-report-2",
  "test-report-approve",
  "test-report-reject",
  "test-report-missing-category",
  "test-report-map-approved-new",
  "test-report-map-approved-old",
  "test-report-map-pending",
  "test-report-map-rejected",
  "test-report-attachment"
];

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

  it("lists pending reports for moderation", async () => {
    await repository.save(createReport("test-report-1", "VC-ABC12345"));
    const approvedReport = createReport("test-report-2", "VC-ABC12346");
    approvedReport.pullDomainEvents();
    approvedReport.approve(new Date("2026-01-02T10:00:00.000Z"));
    await repository.save(approvedReport, approvedReport.pullDomainEvents());

    const pendingReports = await repository.listForModeration({ status: "pending_review" });
    const pendingCodes = pendingReports.map((report) => report.publicCode);

    expect(pendingCodes).toContain("VC-ABC12345");
    expect(pendingCodes).not.toContain("VC-ABC12346");
    expect(await repository.countByModerationStatus("pending_review")).toBeGreaterThanOrEqual(1);
  });

  it("persists approval moderation state and ReportApproved event", async () => {
    const report = createReport("test-report-approve", "VC-APPROVE1");
    await repository.save(report, report.pullDomainEvents());
    report.approve(new Date("2026-01-04T10:00:00.000Z"));

    await repository.save(report, report.pullDomainEvents(), {
      expectedModerationStatus: "pending_review"
    });

    const foundReport = await repository.findByPublicCode(PublicCode.create("VC-APPROVE1"));
    expect(foundReport?.toSnapshot()).toMatchObject({
      moderationStatus: "approved",
      publicStatus: "reported",
      publishedAt: new Date("2026-01-04T10:00:00.000Z")
    });

    const savedEvents = await connection.db
      .select({ type: reportEvents.type, publicStatus: reportEvents.publicStatus })
      .from(reportEvents)
      .where(sql`${reportEvents.reportId} = ${"test-report-approve"}`);
    expect(savedEvents).toContainEqual({ type: "ReportApproved", publicStatus: "reported" });
  });

  it("persists rejection moderation state and ReportRejected event", async () => {
    const report = createReport("test-report-reject", "VC-REJECT01");
    await repository.save(report, report.pullDomainEvents());
    report.reject(new Date("2026-01-05T10:00:00.000Z"));
    const events = report.pullDomainEvents().map((event) =>
      event.type === "ReportRejected"
        ? { ...event, metadata: { internalNote: "Test note" } }
        : event
    );

    await repository.save(report, events, { expectedModerationStatus: "pending_review" });

    const foundReport = await repository.findByPublicCode(PublicCode.create("VC-REJECT01"));
    expect(foundReport?.toSnapshot()).toMatchObject({
      moderationStatus: "rejected"
    });
    expect(foundReport?.toSnapshot().publicStatus).toBeUndefined();
    expect(foundReport?.toSnapshot().publishedAt).toBeUndefined();

    const savedEvents = await connection.db
      .select({ type: reportEvents.type, metadata: reportEvents.metadata })
      .from(reportEvents)
      .where(sql`${reportEvents.reportId} = ${"test-report-reject"}`);
    expect(savedEvents).toContainEqual({
      type: "ReportRejected",
      metadata: { internalNote: "Test note" }
    });
  });

  it("does not expose pending or rejected reports as public reports", async () => {
    const pendingReport = createReport("test-report-1", "VC-ABC12345");
    await repository.save(pendingReport, pendingReport.pullDomainEvents());

    const rejectedReport = createReport("test-report-reject", "VC-REJECT01");
    await repository.save(rejectedReport, rejectedReport.pullDomainEvents());
    rejectedReport.reject(new Date("2026-01-05T10:00:00.000Z"));
    await repository.save(rejectedReport, rejectedReport.pullDomainEvents(), {
      expectedModerationStatus: "pending_review"
    });

    await expect(repository.findPublicByPublicCode(PublicCode.create("VC-ABC12345"))).resolves.toBeNull();
    await expect(repository.findPublicByPublicCode(PublicCode.create("VC-REJECT01"))).resolves.toBeNull();
  });

  it("returns approved public reports and only public timeline events ordered by date", async () => {
    const report = createReport("test-report-approve", "VC-APPROVE1");
    await repository.save(report, report.pullDomainEvents());
    report.approve(new Date("2026-01-04T10:00:00.000Z"));
    report.markCommunicated(new Date("2026-01-06T10:00:00.000Z"));
    const publicEvents = report.pullDomainEvents();

    await repository.save(report, publicEvents, {
      expectedModerationStatus: "pending_review"
    });
    await connection.db.insert(reportEvents).values({
      id: "test-report-approve-internal-event",
      reportId: "test-report-approve",
      type: "ReportRejected",
      visibility: "internal",
      publicStatus: null,
      metadata: { internalNote: "Non deve essere restituita" },
      createdAt: new Date("2026-01-05T10:00:00.000Z")
    });

    await expect(repository.findPublicByPublicCode(PublicCode.create("VC-APPROVE1"))).resolves.toMatchObject({
      publicCode: "VC-APPROVE1",
      title: "Buche in strada",
      categoryName: "Categoria test strade",
      publicStatus: "communicated",
      publishedAt: new Date("2026-01-04T10:00:00.000Z")
    });

    await expect(repository.listPublicEventsByPublicCode(PublicCode.create("VC-APPROVE1"))).resolves.toEqual([
      {
        type: "ReportApproved",
        publicStatus: "reported",
        occurredAt: new Date("2026-01-04T10:00:00.000Z")
      },
      {
        type: "ReportCommunicated",
        publicStatus: "communicated",
        occurredAt: new Date("2026-01-06T10:00:00.000Z")
      }
    ]);
  });


  it("lists only approved public reports for the map ordered by publication date", async () => {
    const olderApproved = createReport("test-report-map-approved-old", "VC-MAPOLD01");
    olderApproved.pullDomainEvents();
    olderApproved.approve(new Date("2026-01-03T10:00:00.000Z"));
    await repository.save(olderApproved, olderApproved.pullDomainEvents());

    const newerApproved = createReport("test-report-map-approved-new", "VC-MAPNEW01");
    newerApproved.pullDomainEvents();
    newerApproved.approve(new Date("2026-01-05T10:00:00.000Z"));
    await repository.save(newerApproved, newerApproved.pullDomainEvents());

    const pendingReport = createReport("test-report-map-pending", "VC-MAPPEN01");
    await repository.save(pendingReport, pendingReport.pullDomainEvents());

    const rejectedReport = createReport("test-report-map-rejected", "VC-MAPREJ01");
    await repository.save(rejectedReport, rejectedReport.pullDomainEvents());
    rejectedReport.reject(new Date("2026-01-04T10:00:00.000Z"));
    await repository.save(rejectedReport, rejectedReport.pullDomainEvents(), {
      expectedModerationStatus: "pending_review"
    });

    const mapReports = await repository.listPublicForMap();
    const testMapReports = mapReports.filter((report) => report.publicCode.startsWith("VC-MAP"));

    expect(testMapReports.map((report) => report.publicCode)).toEqual(["VC-MAPNEW01", "VC-MAPOLD01"]);
    expect(testMapReports[0]).toMatchObject({
      title: "Buche in strada",
      categoryName: "Categoria test strade",
      latitude: 41.4821,
      longitude: 14.0474,
      publicStatus: "reported",
      publishedAt: new Date("2026-01-05T10:00:00.000Z")
    });
    expect(testMapReports[0]).not.toHaveProperty("moderationStatus");
    expect(testMapReports[0]).not.toHaveProperty("description");
  });


  it("persists one image attachment and exposes it only after approval", async () => {
    const report = createReport("test-report-attachment", "VC-ATCH0001");
    const events = report.pullDomainEvents();

    await repository.saveWithAttachment(
      report,
      {
        id: "test-attachment-1",
        reportId: "test-report-attachment",
        type: "image",
        storageKey: "test-storage-key.jpg",
        mimeType: "image/jpeg",
        size: 1234,
        createdAt: new Date("2026-01-01T10:00:00.000Z")
      },
      events
    );

    await expect(repository.findAttachmentForModeration(PublicCode.create("VC-ATCH0001"))).resolves.toEqual({
      storageKey: "test-storage-key.jpg",
      mimeType: "image/jpeg",
      size: 1234
    });
    await expect(repository.findPublicAttachmentByPublicCode(PublicCode.create("VC-ATCH0001"))).resolves.toBeNull();

    report.approve(new Date("2026-01-04T10:00:00.000Z"));
    await repository.save(report, report.pullDomainEvents(), {
      expectedModerationStatus: "pending_review"
    });

    await expect(repository.findPublicAttachmentByPublicCode(PublicCode.create("VC-ATCH0001"))).resolves.toEqual({
      storageKey: "test-storage-key.jpg",
      mimeType: "image/jpeg",
      size: 1234
    });
    await expect(repository.findPublicByPublicCode(PublicCode.create("VC-ATCH0001"))).resolves.toMatchObject({
      attachment: {
        mimeType: "image/jpeg",
        size: 1234,
        url: "/api/report-images/VC-ATCH0001"
      }
    });
  });

  it("enforces at most one image attachment for each report", async () => {
    const report = createReport("test-report-attachment", "VC-ATCH0001");
    await repository.saveWithAttachment(report, {
      id: "test-attachment-1",
      reportId: "test-report-attachment",
      type: "image",
      storageKey: "test-storage-key.jpg",
      mimeType: "image/jpeg",
      size: 1234,
      createdAt: new Date("2026-01-01T10:00:00.000Z")
    });

    await expect(
      connection.db.insert(reportAttachments).values({
        id: "test-attachment-2",
        reportId: "test-report-attachment",
        type: "image",
        storageKey: "test-storage-key-2.jpg",
        mimeType: "image/jpeg",
        size: 1234,
        createdAt: new Date("2026-01-01T10:00:00.000Z")
      })
    ).rejects.toThrow();
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
  await connection.db.delete(reportAttachments).where(inArray(reportAttachments.reportId, testReportIds));
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

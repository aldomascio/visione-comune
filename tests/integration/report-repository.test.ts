import { inArray, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseConnection, type DatabaseConnection } from "@/shared/db/client";
import { categories, reportAttachments, reportConfirmations, reportEvents, reports } from "@/shared/db/schema";
import { DrizzleCategoryRepository } from "@/modules/categories/infrastructure/drizzle-category-repository";
import { DrizzleReportRepository } from "@/modules/reports/infrastructure/drizzle-report-repository";
import { DuplicatePublicCodePersistenceError } from "@/modules/reports/application/report-repository";
import { AddInternalReportNoteUseCase, ChangeReportCategoryUseCase } from "@/modules/reports/application/operational-registry";
import { MarkReportAsDuplicateUseCase, RemoveReportDuplicateLinkUseCase } from "@/modules/reports/application/report-duplicates";
import { GetAdminReportTimelineUseCase, GetPublicReportTimelineUseCase } from "@/modules/reports/application/report-timeline";
import { ReportResolutionNotAllowedError, ResolveReportUseCase } from "@/modules/reports/application/resolve-report";
import { Location, PublicCode, Report } from "@/modules/reports/domain";

const maybeDescribe = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const testCategoryId = "test-roads";
const otherCategoryId = "test-lighting";
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
  "test-report-attachment",
  "test-report-duplicate-valid",
  "test-report-duplicate-pending",
  "test-report-duplicate-rejected",
  "test-report-duplicate-category",
  "test-report-duplicate-far",
  "test-report-duplicate-old",
  "test-report-timeline",
  "test-report-resolution",
  "test-report-resolution-reported",
  "test-report-primary",
  "test-report-linked-duplicate",
  "test-report-map-linked-duplicate",
  "test-report-operational-registry"
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


  it("persists report resolution state, public event and internal note safely", async () => {
    const report = createReport("test-report-resolution", "VC-RESINT01");
    await repository.save(report, report.pullDomainEvents());
    report.approve(new Date("2026-01-04T10:00:00.000Z"));
    report.markCommunicated(new Date("2026-01-05T10:00:00.000Z"));
    await repository.save(report, report.pullDomainEvents(), {
      expectedModerationStatus: "pending_review"
    });

    const useCase = new ResolveReportUseCase({
      reportRepository: repository,
      now: () => new Date("2026-01-06T10:00:00.000Z")
    });

    await useCase.execute({
      publicCode: "VC-RESINT01",
      internalNote: "Sopralluogo completato"
    });

    const foundReport = await repository.findByPublicCode(PublicCode.create("VC-RESINT01"));
    expect(foundReport?.toSnapshot()).toMatchObject({
      publicStatus: "resolved",
      resolvedAt: new Date("2026-01-06T10:00:00.000Z")
    });

    await expect(repository.findPublicByPublicCode(PublicCode.create("VC-RESINT01"))).resolves.toMatchObject({
      publicCode: "VC-RESINT01",
      publicStatus: "resolved",
      communicatedAt: new Date("2026-01-05T10:00:00.000Z"),
      resolvedAt: new Date("2026-01-06T10:00:00.000Z")
    });

    const savedEvents = await connection.db
      .select({ type: reportEvents.type, visibility: reportEvents.visibility, publicStatus: reportEvents.publicStatus, metadata: reportEvents.metadata })
      .from(reportEvents)
      .where(sql`${reportEvents.reportId} = ${"test-report-resolution"}`);
    expect(savedEvents).toContainEqual({
      type: "ReportResolved",
      visibility: "public",
      publicStatus: "resolved",
      metadata: { internalNote: "Sopralluogo completato" }
    });

    const publicItems = await new GetPublicReportTimelineUseCase({
      timelineRepository: repository
    }).execute({ publicCode: "VC-RESINT01" });
    expect(publicItems).toContainEqual({
      id: expect.any(String),
      occurredAt: new Date("2026-01-06T10:00:00.000Z"),
      label: "Problema risolto",
      description: "Visione Comune ha verificato la risoluzione del problema."
    });
    expect(JSON.stringify(publicItems)).not.toContain("Sopralluogo completato");

    const adminItems = await new GetAdminReportTimelineUseCase({
      timelineRepository: repository
    }).execute({ reportId: "test-report-resolution" });
    expect(adminItems).toContainEqual(
      expect.objectContaining({
        label: "Problema risolto",
        visibility: "public",
        note: "Sopralluogo completato"
      })
    );
  });

  it("does not resolve a report that is still only Segnalata", async () => {
    const report = createReport("test-report-resolution-reported", "VC-RESINT02");
    await repository.save(report, report.pullDomainEvents());
    report.approve(new Date("2026-01-04T10:00:00.000Z"));
    await repository.save(report, report.pullDomainEvents(), {
      expectedModerationStatus: "pending_review"
    });

    const useCase = new ResolveReportUseCase({ reportRepository: repository });

    await expect(useCase.execute({ publicCode: "VC-RESINT02" })).rejects.toThrow(
      ReportResolutionNotAllowedError
    );

    const foundReport = await repository.findByPublicCode(PublicCode.create("VC-RESINT02"));
    expect(foundReport?.toSnapshot().publicStatus).toBe("reported");
  });


  it("returns complete admin timeline and safe public timeline with stable order", async () => {
    const report = createReport("test-report-timeline", "VC-TIMELN01");
    await repository.save(report, report.pullDomainEvents());
    report.approve(new Date("2026-01-04T10:00:00.000Z"));
    await repository.save(report, report.pullDomainEvents(), {
      expectedModerationStatus: "pending_review"
    });

    const sameTimestamp = new Date("2026-01-04T10:00:00.000Z");
    await connection.db.insert(reportEvents).values([
      {
        id: "test-report-timeline-a-internal-note",
        reportId: "test-report-timeline",
        type: "ReportRejected",
        visibility: "internal",
        publicStatus: null,
        metadata: { internalNote: "Nota interna da non esporre", recipientName: "Ufficio tecnico" },
        createdAt: sameTimestamp
      },
      {
        id: "test-report-timeline-z-public-communicated",
        reportId: "test-report-timeline",
        type: "ReportCommunicated",
        visibility: "public",
        publicStatus: "communicated",
        metadata: { externalMessageId: "PEC-123" },
        createdAt: new Date("2026-01-05T10:00:00.000Z")
      }
    ]);

    const adminEvents = await repository.listTimelineByReportId("test-report-timeline");
    const sortedAdminEventIds = [...adminEvents]
      .sort((left, right) => {
        const timeDifference = left.occurredAt.getTime() - right.occurredAt.getTime();
        return timeDifference || left.id.localeCompare(right.id);
      })
      .map((event) => event.id);
    expect(adminEvents.map((event) => event.id)).toEqual(sortedAdminEventIds);
    expect(adminEvents.map((event) => event.type)).toEqual(expect.arrayContaining(["ReportCreated", "ReportApproved", "ReportRejected", "ReportCommunicated"]));
    expect(adminEvents.filter((event) => event.visibility === "internal")).toHaveLength(2);
    expect(adminEvents.filter((event) => event.visibility === "public")).toHaveLength(2);
    const internalNoteEvent = adminEvents.find((event) => event.id === "test-report-timeline-a-internal-note");
    expect(internalNoteEvent?.metadata).toEqual({
      internalNote: "Nota interna da non esporre",
      recipientName: "Ufficio tecnico"
    });

    const publicEvents = await repository.listPublicTimelineByPublicCode(PublicCode.create("VC-TIMELN01"));
    expect(publicEvents.map((event) => event.type)).toEqual(["ReportApproved", "ReportCommunicated"]);
    expect(publicEvents.every((event) => event.visibility === "public")).toBe(true);

    const publicItems = await new GetPublicReportTimelineUseCase({
      timelineRepository: repository
    }).execute({ publicCode: "VC-TIMELN01" });
    expect(publicItems).toEqual([
      {
        id: expect.any(String),
        occurredAt: new Date("2026-01-04T10:00:00.000Z"),
        label: "Segnalazione pubblicata",
        description: "Visione Comune ha verificato la segnalazione e l'ha resa pubblica."
      },
      {
        id: "test-report-timeline-z-public-communicated",
        occurredAt: new Date("2026-01-05T10:00:00.000Z"),
        label: "Segnalazione comunicata all'ente competente",
        description: "La segnalazione e stata comunicata all'ente competente."
      }
    ]);
    expect(publicItems[0]).not.toHaveProperty("metadata");

    const adminItems = await new GetAdminReportTimelineUseCase({
      timelineRepository: repository
    }).execute({ reportId: "test-report-timeline" });
    expect(adminItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "test-report-timeline-a-internal-note",
          label: "Segnalazione rifiutata",
          visibility: "internal",
          note: "Nota interna da non esporre",
          metadataItems: [{ label: "Destinatario", value: "Ufficio tecnico" }]
        })
      ])
    );
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



  it("finds only public duplicate candidates within category, distance and time window", async () => {
    await connection.db.insert(categories).values({
      id: otherCategoryId,
      name: "Categoria test illuminazione",
      slug: "test-illuminazione"
    });

    const validDuplicate = createReport("test-report-duplicate-valid", "VC-DUPGOOD1");
    validDuplicate.pullDomainEvents();
    validDuplicate.approve(new Date("2026-01-05T10:00:00.000Z"));
    await repository.save(validDuplicate, validDuplicate.pullDomainEvents());

    const pendingReport = createReport("test-report-duplicate-pending", "VC-DUPPEND1");
    await repository.save(pendingReport, pendingReport.pullDomainEvents());

    const rejectedReport = createReport("test-report-duplicate-rejected", "VC-DUPREJ01");
    await repository.save(rejectedReport, rejectedReport.pullDomainEvents());
    rejectedReport.reject(new Date("2026-01-05T10:00:00.000Z"));
    await repository.save(rejectedReport, rejectedReport.pullDomainEvents(), {
      expectedModerationStatus: "pending_review"
    });

    const differentCategory = createReport("test-report-duplicate-category", "VC-DUPCAT01", {
      categoryId: otherCategoryId
    });
    differentCategory.pullDomainEvents();
    differentCategory.approve(new Date("2026-01-06T10:00:00.000Z"));
    await repository.save(differentCategory, differentCategory.pullDomainEvents());

    const farReport = createReport("test-report-duplicate-far", "VC-DUPFAR01", {
      latitude: 41.49,
      longitude: 14.05
    });
    farReport.pullDomainEvents();
    farReport.approve(new Date("2026-01-07T10:00:00.000Z"));
    await repository.save(farReport, farReport.pullDomainEvents());

    const oldReport = createReport("test-report-duplicate-old", "VC-DUPOLD01");
    oldReport.pullDomainEvents();
    oldReport.approve(new Date("2025-09-01T10:00:00.000Z"));
    await repository.save(oldReport, oldReport.pullDomainEvents());

    const candidates = await repository.findPotentialDuplicates({
      categoryId: testCategoryId,
      minLatitude: 41.4815,
      maxLatitude: 41.4827,
      minLongitude: 14.0468,
      maxLongitude: 14.048,
      publishedAfter: new Date("2025-10-12T10:00:00.000Z"),
      limit: 20
    });

    expect(candidates.map((candidate) => candidate.publicCode)).toEqual(["VC-DUPGOOD1"]);
    expect(candidates[0]).toMatchObject({
      title: "Buche in strada",
      categoryName: "Categoria test strade",
      latitude: 41.4821,
      longitude: 14.0474,
      publicStatus: "reported",
      publishedAt: new Date("2026-01-05T10:00:00.000Z")
    });
    expect(candidates[0]).not.toHaveProperty("moderationStatus");
    expect(candidates[0]).not.toHaveProperty("description");
  });


  it("updates report category and stores internal operational notes without contaminating public timeline", async () => {
    await connection.db.insert(categories).values({
      id: otherCategoryId,
      name: "Categoria test illuminazione",
      slug: "test-illuminazione"
    });

    const report = createReport("test-report-operational-registry", "VC-OPREG001");
    await repository.save(report, report.pullDomainEvents());
    report.approve(new Date("2026-01-04T10:00:00.000Z"));
    await repository.save(report, report.pullDomainEvents(), {
      expectedModerationStatus: "pending_review"
    });

    const categoryRepository = new DrizzleCategoryRepository(connection.db);
    await new ChangeReportCategoryUseCase({
      reportRepository: repository,
      categoryRepository,
      now: () => new Date("2026-01-05T10:00:00.000Z")
    }).execute({
      publicCode: "VC-OPREG001",
      categoryId: otherCategoryId,
      actorAdminId: "admin-operational",
      actorAdminEmail: "operational@example.test"
    });

    await new AddInternalReportNoteUseCase({
      reportRepository: repository,
      now: () => new Date("2026-01-06T10:00:00.000Z")
    }).execute({
      publicCode: "VC-OPREG001",
      note: "Nota visibile solo nel registro interno.",
      actorAdminId: "admin-operational",
      actorAdminEmail: "operational@example.test"
    });

    await expect(repository.findByPublicCode(PublicCode.create("VC-OPREG001"))).resolves.toSatisfy((savedReport) =>
      savedReport?.toSnapshot().categoryId === otherCategoryId
    );

    const adminItems = await new GetAdminReportTimelineUseCase({
      timelineRepository: repository
    }).execute({ reportId: "test-report-operational-registry" });
    expect(adminItems.map((item) => item.label)).toEqual([
      "Segnalazione ricevuta",
      "Segnalazione pubblicata",
      "Categoria modificata",
      "Nota interna aggiunta"
    ]);
    expect(adminItems).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: "Categoria modificata",
        visibility: "internal",
        metadataItems: expect.arrayContaining([
          { label: "Categoria precedente", value: "Categoria test strade" },
          { label: "Nuova categoria", value: "Categoria test illuminazione" },
          { label: "Admin", value: "operational@example.test" }
        ])
      }),
      expect.objectContaining({
        label: "Nota interna aggiunta",
        visibility: "internal",
        note: "Nota visibile solo nel registro interno.",
        metadataItems: expect.arrayContaining([
          { label: "Admin", value: "operational@example.test" }
        ])
      })
    ]));

    const publicItems = await new GetPublicReportTimelineUseCase({
      timelineRepository: repository
    }).execute({ publicCode: "VC-OPREG001" });
    expect(publicItems.map((item) => item.label)).toEqual(["Segnalazione pubblicata"]);
    expect(publicItems.map((item) => item.description).join(" ")).not.toContain("Nota visibile");
  });

  it("persists report and resolution attachments and exposes only approved public images", async () => {
    const report = createReport("test-report-attachment", "VC-ATCH0001");
    const events = report.pullDomainEvents();

    await repository.saveWithAttachment(
      report,
      {
        id: "test-attachment-1",
        reportId: "test-report-attachment",
        type: "report_photo",
        storageKey: "test-storage-key.jpg",
        mimeType: "image/jpeg",
        size: 1234,
        reviewStatus: "pending_review",
        createdAt: new Date("2026-01-01T10:00:00.000Z")
      },
      events
    );

    await expect(repository.findAttachmentForModeration(PublicCode.create("VC-ATCH0001"), "report_photo")).resolves.toEqual({
      storageKey: "test-storage-key.jpg",
      mimeType: "image/jpeg",
      size: 1234
    });
    await expect(repository.findPublicAttachmentByPublicCode(PublicCode.create("VC-ATCH0001"), "report_photo")).resolves.toBeNull();

    report.approve(new Date("2026-01-04T10:00:00.000Z"));
    report.markCommunicated(new Date("2026-01-05T10:00:00.000Z"));
    await repository.save(report, report.pullDomainEvents(), {
      expectedModerationStatus: "pending_review"
    });

    await expect(repository.findPublicAttachmentByPublicCode(PublicCode.create("VC-ATCH0001"), "report_photo")).resolves.toBeNull();

    await repository.updateAttachmentReview(
      {
        reportId: "test-report-attachment",
        attachmentType: "report_photo",
        reviewStatus: "approved",
        reviewedAt: new Date("2026-01-06T10:00:00.000Z")
      },
      []
    );

    await repository.saveAttachment({
      id: "test-attachment-resolution",
      reportId: "test-report-attachment",
      type: "resolution_photo",
      storageKey: "test-resolution-key.jpg",
      mimeType: "image/jpeg",
      size: 2345,
      reviewStatus: "pending_review",
      createdAt: new Date("2026-01-06T10:00:00.000Z")
    });

    await expect(repository.findPublicAttachmentByPublicCode(PublicCode.create("VC-ATCH0001"), "report_photo")).resolves.toEqual({
      storageKey: "test-storage-key.jpg",
      mimeType: "image/jpeg",
      size: 1234
    });
    await expect(repository.findPublicAttachmentByPublicCode(PublicCode.create("VC-ATCH0001"), "resolution_photo")).resolves.toBeNull();

    await repository.updateAttachmentReview(
      {
        reportId: "test-report-attachment",
        attachmentType: "resolution_photo",
        reviewStatus: "approved",
        reviewedAt: new Date("2026-01-07T10:00:00.000Z")
      },
      []
    );

    await expect(repository.findPublicByPublicCode(PublicCode.create("VC-ATCH0001"))).resolves.toMatchObject({
      reportPhoto: {
        mimeType: "image/jpeg",
        size: 1234,
        url: "/api/report-images/VC-ATCH0001?type=report_photo"
      },
      resolutionPhoto: {
        mimeType: "image/jpeg",
        size: 2345,
        url: "/api/report-images/VC-ATCH0001?type=resolution_photo"
      }
    });

    await repository.updateAttachmentReview(
      {
        reportId: "test-report-attachment",
        attachmentType: "resolution_photo",
        reviewStatus: "rejected",
        reviewedAt: new Date("2026-01-08T10:00:00.000Z")
      },
      []
    );

    await expect(repository.findPublicAttachmentByPublicCode(PublicCode.create("VC-ATCH0001"), "resolution_photo")).resolves.toBeNull();
  });


  it("persists duplicate links, lists linked duplicates and excludes duplicates from map", async () => {
    const primary = createReport("test-report-primary", "VC-PRIMARY1");
    await repository.save(primary, primary.pullDomainEvents());
    primary.approve(new Date("2026-01-04T10:00:00.000Z"));
    await repository.save(primary, primary.pullDomainEvents(), {
      expectedModerationStatus: "pending_review"
    });

    const duplicate = createReport("test-report-linked-duplicate", "VC-DUPLINK1");
    await repository.save(duplicate, duplicate.pullDomainEvents());
    duplicate.approve(new Date("2026-01-05T10:00:00.000Z"));
    await repository.save(duplicate, duplicate.pullDomainEvents(), {
      expectedModerationStatus: "pending_review"
    });
    await connection.db.insert(reportConfirmations).values({
      id: "test-report-linked-duplicate-confirmation",
      reportId: "test-report-linked-duplicate",
      antiAbuseKey: "browser-before-link"
    });

    await new MarkReportAsDuplicateUseCase({
      reportRepository: repository,
      now: () => new Date("2026-01-06T10:00:00.000Z")
    }).execute({ publicCode: "VC-DUPLINK1", primaryPublicCode: "VC-PRIMARY1" });

    await expect(repository.findByPublicCode(PublicCode.create("VC-DUPLINK1"))).resolves.toSatisfy((report) =>
      report?.toSnapshot().duplicateOfReportId === "test-report-primary"
    );
    await expect(repository.findPublicByPublicCode(PublicCode.create("VC-DUPLINK1"))).resolves.toMatchObject({
      publicCode: "VC-DUPLINK1",
      duplicateOf: { publicCode: "VC-PRIMARY1", title: "Buche in strada" }
    });
    await expect(repository.listDuplicatesOfReport("test-report-primary")).resolves.toMatchObject([
      { publicCode: "VC-DUPLINK1", confirmationsCount: 1 }
    ]);
    await expect(repository.listPublicForMap()).resolves.not.toContainEqual(
      expect.objectContaining({ publicCode: "VC-DUPLINK1" })
    );

    const savedEvents = await connection.db
      .select({ type: reportEvents.type, metadata: reportEvents.metadata })
      .from(reportEvents)
      .where(sql`${reportEvents.reportId} = ${"test-report-linked-duplicate"}`);
    expect(savedEvents).toContainEqual({
      type: "ReportMarkedAsDuplicate",
      metadata: { primaryReportId: "test-report-primary", primaryPublicCode: "VC-PRIMARY1" }
    });

    await new RemoveReportDuplicateLinkUseCase({
      reportRepository: repository,
      now: () => new Date("2026-01-07T10:00:00.000Z")
    }).execute({ publicCode: "VC-DUPLINK1" });

    await expect(repository.findByPublicCode(PublicCode.create("VC-DUPLINK1"))).resolves.toSatisfy((report) =>
      report?.toSnapshot().duplicateOfReportId === undefined
    );
  });

  it("enforces at most one attachment for each report and type", async () => {
    const report = createReport("test-report-attachment", "VC-ATCH0001");
    await repository.saveWithAttachment(report, {
      id: "test-attachment-1",
      reportId: "test-report-attachment",
      type: "report_photo",
      storageKey: "test-storage-key.jpg",
      mimeType: "image/jpeg",
      size: 1234,
      reviewStatus: "pending_review",
      createdAt: new Date("2026-01-01T10:00:00.000Z")
    });

    await expect(
      connection.db.insert(reportAttachments).values({
        id: "test-attachment-2",
        reportId: "test-report-attachment",
        type: "report_photo",
        storageKey: "test-storage-key-2.jpg",
        mimeType: "image/jpeg",
        size: 1234,
        reviewStatus: "pending_review",
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
  await connection.db.delete(reportConfirmations).where(inArray(reportConfirmations.reportId, testReportIds));
  await connection.db.delete(reportEvents).where(inArray(reportEvents.reportId, testReportIds));
  await connection.db.delete(reportAttachments).where(inArray(reportAttachments.reportId, testReportIds));
  await connection.db.delete(reports).where(inArray(reports.id, testReportIds));
  await connection.db.delete(categories).where(inArray(categories.id, [testCategoryId, otherCategoryId]));
}

function createReport(
  id: string,
  publicCode: string,
  options: { categoryId?: string; latitude?: number; longitude?: number } = {}
): Report {
  return Report.create({
    id,
    publicCode: PublicCode.create(publicCode),
    title: "Buche in strada",
    description: "Sono presenti buche profonde vicino alla scuola.",
    categoryId: options.categoryId ?? testCategoryId,
    location: Location.create({
      latitude: options.latitude ?? 41.4821,
      longitude: options.longitude ?? 14.0474,
      address: "Via Roma"
    }),
    createdAt: new Date("2026-01-01T10:00:00.000Z")
  });
}

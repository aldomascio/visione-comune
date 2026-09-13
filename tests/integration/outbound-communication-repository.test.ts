import { inArray, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DrizzleCategoryRepository } from "@/modules/categories/infrastructure/drizzle-category-repository";
import { CreateManualCommunicationUseCase, MarkCommunicationDeliveredUseCase, MarkCommunicationFailedUseCase } from "@/modules/communications/application/manual-communications";
import { DrizzleOutboundCommunicationRepository } from "@/modules/communications/infrastructure/drizzle-outbound-communication-repository";
import { DrizzleRecipientRepository } from "@/modules/recipients/infrastructure/drizzle-recipient-repository";
import { DrizzleReportRepository } from "@/modules/reports/infrastructure/drizzle-report-repository";
import { Location, PublicCode, Report } from "@/modules/reports/domain";
import { createDatabaseConnection, type DatabaseConnection } from "@/shared/db/client";
import { categories, categoryRecipients, outboundCommunications, recipients, reportEvents, reports } from "@/shared/db/schema";

const maybeDescribe = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const categoryId = "test-communication-category";
const recipientIds = ["test-communication-recipient", "test-communication-recipient-alt"];
const reportIds = ["test-communication-report", "test-communication-report-2"];

maybeDescribe("DrizzleOutboundCommunicationRepository", () => {
  let connection: DatabaseConnection;
  let reportRepository: DrizzleReportRepository;
  let recipientRepository: DrizzleRecipientRepository;
  let categoryRepository: DrizzleCategoryRepository;
  let communicationRepository: DrizzleOutboundCommunicationRepository;

  beforeAll(async () => {
    connection = createDatabaseConnection(process.env.TEST_DATABASE_URL);
    await migrate(connection.db, { migrationsFolder: "drizzle" });
    reportRepository = new DrizzleReportRepository(connection.db);
    recipientRepository = new DrizzleRecipientRepository(connection.db);
    categoryRepository = new DrizzleCategoryRepository(connection.db);
    communicationRepository = new DrizzleOutboundCommunicationRepository(connection.db);
  });

  beforeEach(async () => {
    await cleanupTestData(connection);
    await seedBaseData(connection);
  });

  afterAll(async () => {
    if (connection) {
      await cleanupTestData(connection);
      await connection.close();
    }
  });

  it("persists a manual sent communication with recipient snapshot and lists it by report", async () => {
    await createApprovedReport(reportRepository, reportIds[0], "VC-COMM0001");

    const communication = await new CreateManualCommunicationUseCase({
      reportRepository,
      recipientRepository,
      categoryRepository,
      communicationRepository,
      createId: () => "test-communication-1",
      now: () => new Date("2026-01-03T10:00:00.000Z")
    }).execute({ publicCode: "VC-COMM0001", recipientId: recipientIds[0], channel: "pec", subject: "Oggetto", body: "Corpo", status: "sent" });

    expect(communication).toMatchObject({
      id: "test-communication-1",
      reportId: reportIds[0],
      recipientId: recipientIds[0],
      recipientNameSnapshot: "Ufficio Test",
      recipientOrganizationSnapshot: "Comune Test",
      recipientAddressSnapshot: "ufficio-test@pec.example.test",
      channel: "pec",
      status: "sent",
      sentAt: new Date("2026-01-03T10:00:00.000Z")
    });

    await connection.db.update(recipients).set({ name: "Nome modificato", pec: "modificato@pec.example.test" }).where(sql`${recipients.id} = ${recipientIds[0]}`);

    await expect(communicationRepository.listByReportId(reportIds[0])).resolves.toMatchObject([
      {
        recipientNameSnapshot: "Ufficio Test",
        recipientAddressSnapshot: "ufficio-test@pec.example.test"
      }
    ]);

    const events = await connection.db.select({ type: reportEvents.type }).from(reportEvents).where(sql`${reportEvents.reportId} = ${reportIds[0]}`).orderBy(reportEvents.createdAt);
    expect(events.map((event) => event.type)).toContain("CommunicationSent");
  });

  it("marks delivered, updates report to Comunicata and creates a single public ReportCommunicated event", async () => {
    await createApprovedReport(reportRepository, reportIds[0], "VC-COMM0001");
    const communication = await createSentCommunication("test-communication-1", "VC-COMM0001");
    const useCase = new MarkCommunicationDeliveredUseCase({
      reportRepository,
      communicationRepository,
      now: () => new Date("2026-01-04T10:00:00.000Z")
    });

    await useCase.execute({ communicationId: communication.id });
    await useCase.execute({ communicationId: communication.id });

    await expect(reportRepository.findByPublicCode(PublicCode.create("VC-COMM0001"))).resolves.toSatisfy((report) => {
      expect(report?.toSnapshot()).toMatchObject({
        publicStatus: "communicated",
        communicatedAt: new Date("2026-01-04T10:00:00.000Z")
      });
      return true;
    });

    const events = await connection.db.select({ type: reportEvents.type, visibility: reportEvents.visibility }).from(reportEvents).where(sql`${reportEvents.reportId} = ${reportIds[0]}`);
    expect(events.filter((event) => event.type === "CommunicationDelivered")).toHaveLength(1);
    expect(events.filter((event) => event.type === "ReportCommunicated" && event.visibility === "public")).toHaveLength(1);
  });

  it("does not duplicate ReportCommunicated when a second communication is delivered", async () => {
    await createApprovedReport(reportRepository, reportIds[0], "VC-COMM0001");
    const first = await createSentCommunication("test-communication-1", "VC-COMM0001");
    const second = await createSentCommunication("test-communication-2", "VC-COMM0001", recipientIds[1], "email");
    const useCase = new MarkCommunicationDeliveredUseCase({ reportRepository, communicationRepository, now: () => new Date("2026-01-04T10:00:00.000Z") });

    await useCase.execute({ communicationId: first.id });
    await useCase.execute({ communicationId: second.id });

    const events = await connection.db.select({ type: reportEvents.type }).from(reportEvents).where(sql`${reportEvents.reportId} = ${reportIds[0]}`);
    expect(events.filter((event) => event.type === "ReportCommunicated")).toHaveLength(1);
    expect(events.filter((event) => event.type === "CommunicationDelivered")).toHaveLength(2);
  });

  it("marks failed without changing report status", async () => {
    await createApprovedReport(reportRepository, reportIds[0], "VC-COMM0001");
    const communication = await createSentCommunication("test-communication-1", "VC-COMM0001");

    await new MarkCommunicationFailedUseCase({ communicationRepository, now: () => new Date("2026-01-04T10:00:00.000Z") }).execute({ communicationId: communication.id });

    await expect(reportRepository.findByPublicCode(PublicCode.create("VC-COMM0001"))).resolves.toSatisfy((report) => {
      expect(report?.toSnapshot().publicStatus).toBe("reported");
      return true;
    });
    await expect(communicationRepository.findById(communication.id)).resolves.toMatchObject({
      status: "failed",
      failedAt: new Date("2026-01-04T10:00:00.000Z")
    });
  });

  it("enforces recipient and report foreign keys", async () => {
    await createApprovedReport(reportRepository, reportIds[0], "VC-COMM0001");

    await expect(
      connection.db.insert(outboundCommunications).values({
        id: "test-communication-invalid-report",
        reportId: "missing-report",
        recipientId: recipientIds[0],
        recipientNameSnapshot: "Ufficio",
        recipientOrganizationSnapshot: "Comune",
        recipientAddressSnapshot: "ufficio@pec.example.test",
        channel: "pec",
        subject: "Oggetto",
        body: "Corpo",
        status: "sent",
        createdAt: new Date("2026-01-03T10:00:00.000Z"),
        sentAt: new Date("2026-01-03T10:00:00.000Z")
      })
    ).rejects.toThrow();

    await expect(
      connection.db.insert(outboundCommunications).values({
        id: "test-communication-invalid-recipient",
        reportId: reportIds[0],
        recipientId: "missing-recipient",
        recipientNameSnapshot: "Ufficio",
        recipientOrganizationSnapshot: "Comune",
        recipientAddressSnapshot: "ufficio@pec.example.test",
        channel: "pec",
        subject: "Oggetto",
        body: "Corpo",
        status: "sent",
        createdAt: new Date("2026-01-03T10:00:00.000Z"),
        sentAt: new Date("2026-01-03T10:00:00.000Z")
      })
    ).rejects.toThrow();
  });

  async function createSentCommunication(id: string, publicCode: string, recipientId = recipientIds[0], channel: "email" | "pec" = "pec") {
    return new CreateManualCommunicationUseCase({
      reportRepository,
      recipientRepository,
      categoryRepository,
      communicationRepository,
      createId: () => id,
      now: () => new Date("2026-01-03T10:00:00.000Z")
    }).execute({ publicCode, recipientId, channel, subject: `Oggetto ${id}`, body: `Corpo ${id}`, status: "sent" });
  }
});

async function seedBaseData(connection: DatabaseConnection): Promise<void> {
  await connection.db.insert(categories).values({ id: categoryId, name: "Categoria comunicazioni", slug: "test-comunicazioni" });
  await connection.db.insert(recipients).values([
    { id: recipientIds[0], name: "Ufficio Test", organization: "Comune Test", email: "ufficio-test@example.test", pec: "ufficio-test@pec.example.test", active: true },
    { id: recipientIds[1], name: "Ufficio Alternativo", organization: "Comune Test", email: "alternativo@example.test", pec: "alternativo@pec.example.test", active: true }
  ]);
  await connection.db.insert(categoryRecipients).values([
    { categoryId, recipientId: recipientIds[0], sortOrder: 0 },
    { categoryId, recipientId: recipientIds[1], sortOrder: 1 }
  ]);
}

async function createApprovedReport(repository: DrizzleReportRepository, id: string, publicCode: string): Promise<void> {
  const report = Report.create({
    id,
    publicCode: PublicCode.create(publicCode),
    title: "Segnalazione comunicazioni",
    description: "Descrizione per test comunicazioni.",
    categoryId,
    location: Location.create({ latitude: 41.4821, longitude: 14.0474, address: "Via Roma" }),
    createdAt: new Date("2026-01-01T10:00:00.000Z")
  });
  report.pullDomainEvents();
  report.approve(new Date("2026-01-02T10:00:00.000Z"));
  await repository.save(report, report.pullDomainEvents());
}

async function cleanupTestData(connection: DatabaseConnection): Promise<void> {
  await connection.db.delete(outboundCommunications).where(inArray(outboundCommunications.reportId, reportIds));
  await connection.db.delete(reportEvents).where(inArray(reportEvents.reportId, reportIds));
  await connection.db.delete(reports).where(inArray(reports.id, reportIds));
  await connection.db.delete(categoryRecipients).where(inArray(categoryRecipients.categoryId, [categoryId]));
  await connection.db.delete(recipients).where(inArray(recipients.id, recipientIds));
  await connection.db.delete(categories).where(inArray(categories.id, [categoryId]));
}

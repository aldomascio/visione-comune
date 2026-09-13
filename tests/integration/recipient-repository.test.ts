import { inArray, or } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DrizzleCategoryRepository } from "@/modules/categories/infrastructure/drizzle-category-repository";
import {
  CreateRecipientUseCase,
  DuplicateRecipientContactError,
  SetRecipientActiveStateUseCase,
  UpdateCategoryRecipientsUseCase
} from "@/modules/recipients/application/manage-recipients";
import { DrizzleRecipientRepository } from "@/modules/recipients/infrastructure/drizzle-recipient-repository";
import { DrizzleReportRepository } from "@/modules/reports/infrastructure/drizzle-report-repository";
import { PublicCode } from "@/modules/reports/domain";
import { createDatabaseConnection, type DatabaseConnection } from "@/shared/db/client";
import { categories, categoryRecipients, recipients, reportEvents, reports } from "@/shared/db/schema";

const maybeDescribe = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const categoryIds = ["test-routing-category", "test-routing-category-disabled"];
const recipientIds = ["test-routing-recipient-1", "test-routing-recipient-2", "test-routing-recipient-inactive"];
const reportIds = ["test-routing-report-history"];

maybeDescribe("recipient routing with PostgreSQL", () => {
  let connection: DatabaseConnection;
  let repository: DrizzleRecipientRepository;

  beforeAll(async () => {
    connection = createDatabaseConnection(process.env.TEST_DATABASE_URL);
    await migrate(connection.db, { migrationsFolder: "drizzle" });
    repository = new DrizzleRecipientRepository(connection.db);
  });

  beforeEach(async () => {
    await cleanupTestData(connection);
    await insertCategory(connection, categoryIds[0], "Categoria routing", true);
    await insertCategory(connection, categoryIds[1], "Categoria routing disattivata", false);
  });

  afterAll(async () => {
    if (connection) {
      await cleanupTestData(connection);
      await connection.close();
    }
  });

  it("persists recipients and enforces unique contacts", async () => {
    await new CreateRecipientUseCase({ recipientRepository: repository, createId: () => recipientIds[0] }).execute({
      name: "Ufficio Tecnico",
      organization: "Comune di Test",
      email: "tecnico@example.test",
      pec: "tecnico@pec.example.test"
    });

    await expect(repository.findById(recipientIds[0])).resolves.toMatchObject({ name: "Ufficio Tecnico", active: true });
    await expect(new CreateRecipientUseCase({ recipientRepository: repository, createId: () => recipientIds[1] }).execute({ name: "Duplicato", organization: "Comune", email: "tecnico@example.test" })).rejects.toBeInstanceOf(DuplicateRecipientContactError);
  });

  it("persists category-recipient associations and preferred recipient", async () => {
    await insertRecipient(connection, recipientIds[0], "Secondario", true);
    await insertRecipient(connection, recipientIds[1], "Principale", true);

    await new UpdateCategoryRecipientsUseCase({ categoryRepository: new DrizzleCategoryRepository(connection.db), recipientRepository: repository, categoryRecipientRepository: repository }).execute({
      categoryId: categoryIds[0],
      recipientIds: [recipientIds[0], recipientIds[1]],
      primaryRecipientId: recipientIds[1]
    });

    await expect(repository.listByCategory(categoryIds[0])).resolves.toMatchObject([{ id: recipientIds[1], sortOrder: 0 }, { id: recipientIds[0] }]);
    await expect(repository.getPreferred(categoryIds[0])).resolves.toMatchObject({ id: recipientIds[1], name: "Principale" });
  });

  it("excludes inactive recipients from operational proposals", async () => {
    await insertRecipient(connection, recipientIds[2], "Inattivo", false);
    await repository.replaceAssociations(categoryIds[0], [{ recipientId: recipientIds[2], sortOrder: 0 }]);

    await expect(repository.listByCategory(categoryIds[0])).resolves.toMatchObject([{ id: recipientIds[2], active: false }]);
    await expect(repository.getPreferred(categoryIds[0])).resolves.toBeNull();
  });

  it("keeps relations for inactive categories", async () => {
    await insertRecipient(connection, recipientIds[0], "Ufficio", true);
    await repository.replaceAssociations(categoryIds[1], [{ recipientId: recipientIds[0], sortOrder: 0 }]);

    await expect(repository.listByCategory(categoryIds[1])).resolves.toMatchObject([{ id: recipientIds[0] }]);
  });

  it("does not break historical reports when routing changes", async () => {
    await insertRecipient(connection, recipientIds[0], "Ufficio", true);
    await insertApprovedReport(connection);
    await repository.replaceAssociations(categoryIds[0], [{ recipientId: recipientIds[0], sortOrder: 0 }]);
    await new SetRecipientActiveStateUseCase({ recipientRepository: repository }).execute({ id: recipientIds[0], active: false });

    const report = await new DrizzleReportRepository(connection.db).findPublicByPublicCode(PublicCode.create("VC-ROUTE001"));
    expect(report).toMatchObject({ categoryName: "Categoria routing" });
    await expect(repository.getPreferred(categoryIds[0])).resolves.toBeNull();
  });
});

async function insertCategory(connection: DatabaseConnection, id: string, name: string, active: boolean) {
  await connection.db.insert(categories).values({ id, name, slug: id, active });
}

async function insertRecipient(connection: DatabaseConnection, id: string, name: string, active: boolean) {
  await connection.db.insert(recipients).values({ id, name, organization: "Comune di Test", email: `${id}@example.test`, pec: `${id}@pec.example.test`, active });
}

async function insertApprovedReport(connection: DatabaseConnection) {
  await connection.db.insert(reports).values({ id: reportIds[0], publicCode: "VC-ROUTE001", title: "Report storico routing", description: "Descrizione pubblica del report storico routing.", categoryId: categoryIds[0], latitude: 41.4821, longitude: 14.0474, moderationStatus: "approved", publicStatus: "reported", createdAt: new Date("2026-01-01T10:00:00.000Z"), publishedAt: new Date("2026-01-01T11:00:00.000Z") });
  await connection.db.insert(reportEvents).values({ id: `${reportIds[0]}-event`, reportId: reportIds[0], type: "ReportApproved", visibility: "public", publicStatus: "reported", createdAt: new Date("2026-01-01T11:00:00.000Z") });
}

async function cleanupTestData(connection: DatabaseConnection) {
  await connection.db.delete(reportEvents).where(inArray(reportEvents.reportId, reportIds));
  await connection.db.delete(reports).where(inArray(reports.id, reportIds));
  await connection.db.delete(categoryRecipients).where(or(inArray(categoryRecipients.categoryId, categoryIds), inArray(categoryRecipients.recipientId, recipientIds)));
  await connection.db.delete(recipients).where(inArray(recipients.id, recipientIds));
  await connection.db.delete(categories).where(inArray(categories.id, categoryIds));
}

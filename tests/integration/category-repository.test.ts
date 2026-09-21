import { inArray, or } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  CreateCategoryUseCase,
  DuplicateCategorySlugError,
  SetCategoryActiveStateUseCase,
  UpdateCategoryUseCase
} from "@/modules/categories/application/manage-categories";
import { DrizzleCategoryRepository } from "@/modules/categories/infrastructure/drizzle-category-repository";
import { CreateReportUseCase } from "@/modules/reports/application/create-report";
import type { PublicCodeGenerator } from "@/modules/reports/application/public-code-generator";
import { PublicCode } from "@/modules/reports/domain";
import { DrizzleReportRepository } from "@/modules/reports/infrastructure/drizzle-report-repository";
import { createDatabaseConnection, type DatabaseConnection } from "@/shared/db/client";
import { categories, reportEvents, reports } from "@/shared/db/schema";

const maybeDescribe = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const categoryIds = ["test-category-repository", "test-category-repository-2", "test-category-inactive"];
const categorySlugs = [
  "categoria-integration",
  "categoria-duplicata",
  "nome-iniziale",
  "nome-aggiornato",
  "storico-categoria",
  "categoria-inattiva"
];
const reportIds = ["test-category-history-report", "test-category-inactive-report"];

maybeDescribe("category management with PostgreSQL", () => {
  let connection: DatabaseConnection;
  let categoryRepository: DrizzleCategoryRepository;

  beforeAll(async () => {
    connection = createDatabaseConnection(process.env.TEST_DATABASE_URL);
    await migrate(connection.db, { migrationsFolder: "drizzle" });
    categoryRepository = new DrizzleCategoryRepository(connection.db);
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

  it("creates and lists a category with report count", async () => {
    const created = await new CreateCategoryUseCase({
      categoryRepository,
      createId: () => categoryIds[0],
      now: () => new Date("2026-01-01T10:00:00.000Z")
    }).execute({ name: "Categoria integration", slug: "categoria-integration" });

    expect(created).toMatchObject({
      id: categoryIds[0],
      name: "Categoria integration",
      slug: "categoria-integration",
      active: true
    });

    const listed = await categoryRepository.listAll();
    expect(listed).toEqual(expect.arrayContaining([expect.objectContaining({ id: categoryIds[0], reportCount: 0 })]));
  });

  it("enforces unique category slugs", async () => {
    await new CreateCategoryUseCase({ categoryRepository, createId: () => categoryIds[0] }).execute({
      name: "Categoria uno",
      slug: "categoria-duplicata"
    });

    await expect(
      new CreateCategoryUseCase({ categoryRepository, createId: () => categoryIds[1] }).execute({
        name: "Categoria due",
        slug: "categoria-duplicata"
      })
    ).rejects.toBeInstanceOf(DuplicateCategorySlugError);
  });

  it("persists updates and active state changes", async () => {
    await insertCategory(connection, { id: categoryIds[0], name: "Nome iniziale", slug: "nome-iniziale", active: true });

    const updated = await new UpdateCategoryUseCase({
      categoryRepository,
      now: () => new Date("2026-01-02T10:00:00.000Z")
    }).execute({ id: categoryIds[0], name: "Nome aggiornato", slug: "nome-aggiornato", active: true });

    expect(updated).toMatchObject({ name: "Nome aggiornato", slug: "nome-aggiornato", active: true });

    const deactivated = await new SetCategoryActiveStateUseCase({ categoryRepository }).execute({
      id: categoryIds[0],
      active: false
    });

    expect(deactivated.active).toBe(false);
    await expect(categoryRepository.findActiveById(categoryIds[0])).resolves.toBeNull();
  });

  it("keeps historical reports readable after category deactivation", async () => {
    await insertCategory(connection, { id: categoryIds[0], name: "Storico categoria", slug: "storico-categoria", active: true });
    await insertApprovedReport(connection, {
      id: reportIds[0],
      publicCode: "VC-CATREP01",
      categoryId: categoryIds[0],
      title: "Report con categoria storica"
    });

    await new SetCategoryActiveStateUseCase({ categoryRepository }).execute({ id: categoryIds[0], active: false });

    const publicReport = await new DrizzleReportRepository(connection.db).findPublicByPublicCode(
      PublicCode.create("VC-CATREP01")
    );
    const listed = await categoryRepository.listAll();

    expect(publicReport).toMatchObject({ categoryName: "Storico categoria" });
    expect(listed).toEqual(expect.arrayContaining([expect.objectContaining({ id: categoryIds[0], reportCount: 1 })]));
  });

  it("rejects new report creation with an inactive category", async () => {
    await insertCategory(connection, { id: categoryIds[2], name: "Categoria inattiva", slug: "categoria-inattiva", active: false });

    const useCase = new CreateReportUseCase({
      reportRepository: new DrizzleReportRepository(connection.db),
      categoryRepository,
      publicCodeGenerator: new FixedPublicCodeGenerator("VC-INACT001"),
      createId: () => reportIds[1]
    });

    await expect(
      useCase.execute({
        title: "Segnalazione categoria inattiva",
        categoryId: categoryIds[2],
        description: "Descrizione sufficientemente lunga per creare una segnalazione di test.",
        latitude: "41.4821",
        longitude: "14.0474",
        address: "Via test"
      })
    ).rejects.toMatchObject({
      fieldErrors: { categoryId: "Seleziona una categoria disponibile." }
    });
  });
});

async function insertCategory(
  connection: DatabaseConnection,
  input: { id: string; name: string; slug: string; active: boolean }
): Promise<void> {
  await connection.db.insert(categories).values({
    id: input.id,
    name: input.name,
    slug: input.slug,
    active: input.active
  });
}

async function insertApprovedReport(
  connection: DatabaseConnection,
  input: { id: string; publicCode: string; categoryId: string; title: string }
): Promise<void> {
  await connection.db.insert(reports).values({
    id: input.id,
    publicCode: input.publicCode,
    title: input.title,
    description: "Descrizione pubblica del report storico per test di categoria.",
    categoryId: input.categoryId,
    latitude: 41.4821,
    longitude: 14.0474,
    address: "Via storica",
    publicStatus: "reported",
    moderationStatus: "approved",
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
    publishedAt: new Date("2026-01-01T11:00:00.000Z")
  });
  await connection.db.insert(reportEvents).values({
    id: `${input.id}-approved`,
    reportId: input.id,
    type: "ReportApproved",
    visibility: "public",
    publicStatus: "reported",
    createdAt: new Date("2026-01-01T11:00:00.000Z")
  });
}

async function cleanupTestData(connection: DatabaseConnection): Promise<void> {
  await connection.db.delete(reportEvents).where(inArray(reportEvents.reportId, reportIds));
  await connection.db.delete(reports).where(inArray(reports.id, reportIds));
  await connection.db
    .delete(categories)
    .where(or(inArray(categories.id, categoryIds), inArray(categories.slug, categorySlugs)));
}

class FixedPublicCodeGenerator implements PublicCodeGenerator {
  constructor(private readonly publicCode: string) {}

  generate(): PublicCode {
    return PublicCode.create(this.publicCode);
  }
}

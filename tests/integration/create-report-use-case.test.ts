import { inArray, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DrizzleCategoryRepository } from "@/modules/categories/infrastructure/drizzle-category-repository";
import { CreateReportUseCase } from "@/modules/reports/application/create-report";
import type { PublicCodeGenerator } from "@/modules/reports/application/public-code-generator";
import { PublicCode } from "@/modules/reports/domain";
import { DrizzleReportRepository } from "@/modules/reports/infrastructure/drizzle-report-repository";
import { createDatabaseConnection, type DatabaseConnection } from "@/shared/db/client";
import { categories, reportEvents, reports } from "@/shared/db/schema";

const maybeDescribe = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const testCategoryId = "test-create-report-category";
const testReportIds = ["test-create-report-1", "test-create-report-2"];

maybeDescribe("CreateReportUseCase with PostgreSQL", () => {
  let connection: DatabaseConnection;

  beforeAll(async () => {
    connection = createDatabaseConnection(process.env.TEST_DATABASE_URL);
    await migrate(connection.db, { migrationsFolder: "drizzle" });
  });

  beforeEach(async () => {
    await cleanupTestData(connection);
    await connection.db.insert(categories).values({
      id: testCategoryId,
      name: "Categoria test creazione",
      slug: "categoria-test-creazione"
    });
  });

  afterAll(async () => {
    if (connection) {
      await cleanupTestData(connection);
      await connection.close();
    }
  });

  it("persists a newly submitted report as pending review and not public", async () => {
    const useCase = createUseCase(connection, { publicCodes: ["VC-23456789"] });

    const result = await useCase.execute({
      categoryId: testCategoryId,
      description: "Una buca profonda rende difficile il passaggio pedonale vicino alla scuola.",
      latitude: "41.4821",
      longitude: "14.0474",
      address: "Via Roma"
    });

    expect(result).toEqual({ reportId: "test-create-report-1", publicCode: "VC-23456789" });

    const [savedReport] = await connection.db
      .select()
      .from(reports)
      .where(sql`${reports.id} = ${result.reportId}`);

    expect(savedReport).toMatchObject({
      id: "test-create-report-1",
      publicCode: "VC-23456789",
      categoryId: testCategoryId,
      moderationStatus: "pending_review",
      publicStatus: null,
      publishedAt: null,
      communicatedAt: null,
      resolvedAt: null
    });

    const savedEvents = await connection.db
      .select({ type: reportEvents.type, visibility: reportEvents.visibility })
      .from(reportEvents)
      .where(sql`${reportEvents.reportId} = ${result.reportId}`);

    expect(savedEvents).toEqual([{ type: "ReportCreated", visibility: "internal" }]);
  });

  it("retries when the generated public code collides with an existing report", async () => {
    const firstUseCase = createUseCase(connection, {
      publicCodes: ["VC-23456789"],
      ids: ["test-create-report-1"]
    });
    await firstUseCase.execute(validInput());

    const retryingUseCase = createUseCase(connection, {
      publicCodes: ["VC-23456789", "VC-ABCDEFGH"],
      ids: ["test-create-report-2", "test-create-report-2"]
    });

    const result = await retryingUseCase.execute(validInput());

    expect(result).toEqual({ reportId: "test-create-report-2", publicCode: "VC-ABCDEFGH" });
  });
});

function createUseCase(connection: DatabaseConnection, input: { publicCodes: string[]; ids?: string[] }) {
  const ids = new Sequence(input.ids ?? ["test-create-report-1"]);

  return new CreateReportUseCase({
    reportRepository: new DrizzleReportRepository(connection.db),
    categoryRepository: new DrizzleCategoryRepository(connection.db),
    publicCodeGenerator: new SequencePublicCodeGenerator(input.publicCodes),
    createId: () => ids.next(),
    now: () => new Date("2026-01-01T10:00:00.000Z")
  });
}

function validInput() {
  return {
    categoryId: testCategoryId,
    description: "Una buca profonda rende difficile il passaggio pedonale vicino alla scuola.",
    latitude: "41.4821",
    longitude: "14.0474",
    address: "Via Roma"
  };
}

async function cleanupTestData(connection: DatabaseConnection): Promise<void> {
  await connection.db.delete(reportEvents).where(inArray(reportEvents.reportId, testReportIds));
  await connection.db.delete(reports).where(inArray(reports.id, testReportIds));
  await connection.db.delete(categories).where(sql`${categories.id} = ${testCategoryId}`);
}

class SequencePublicCodeGenerator implements PublicCodeGenerator {
  private readonly sequence: Sequence;

  constructor(publicCodes: string[]) {
    this.sequence = new Sequence(publicCodes);
  }

  generate(): PublicCode {
    return PublicCode.create(this.sequence.next());
  }
}

class Sequence {
  private index = 0;

  constructor(private readonly values: string[]) {}

  next(): string {
    const value = this.values[this.index] ?? this.values.at(-1);
    this.index += 1;

    if (!value) {
      throw new Error("Missing sequence value.");
    }

    return value;
  }
}

import { describe, expect, it } from "vitest";
import type { CategoryOption, CategoryRepository } from "@/modules/categories/application/category-repository";
import {
  PublicCode,
  type ModerationStatus,
  type PublicCode as PublicCodeValue,
  type Report,
  type ReportDomainEvent
} from "../domain";
import {
  DuplicatePublicCodePersistenceError,
  type ReportModerationFilter,
  type ReportModerationSummary,
  type ReportRepository
} from "./report-repository";
import type { PublicCodeGenerator } from "./public-code-generator";
import {
  CreateReportUseCase,
  CreateReportValidationError,
  PublicCodeGenerationExhaustedError,
  deriveReportTitle,
  validateCreateReportInput
} from "./create-report";

const category: CategoryOption = {
  id: "test-roads",
  name: "Strade e marciapiedi",
  slug: "strade-e-marciapiedi"
};

function createValidInput() {
  return {
    categoryId: category.id,
    description: "Sono presenti buche profonde vicino alla scuola e serve una verifica.",
    latitude: "41.4821",
    longitude: "14.0474",
    address: "Via Roma, Venafro"
  };
}

describe("CreateReportUseCase", () => {
  it("creates a pending report with a generated public code", async () => {
    const reportRepository = new InMemoryReportRepository();
    const useCase = createUseCase({ reportRepository });

    const result = await useCase.execute(createValidInput());

    expect(result).toEqual({ reportId: "report-1", publicCode: "VC-23456789" });
    expect(reportRepository.savedReports[0]?.toSnapshot()).toMatchObject({
      id: "report-1",
      publicCode: "VC-23456789",
      title: "Strade e marciapiedi: Via Roma, Venafro",
      categoryId: "test-roads",
      moderationStatus: "pending_review",
      createdAt: new Date("2026-01-01T10:00:00.000Z")
    });
    expect(reportRepository.savedReports[0]?.toSnapshot().publicStatus).toBeUndefined();
    expect(reportRepository.savedEvents.map((event) => event.type)).toEqual([
      "ReportCreated"
    ]);
  });

  it("rejects invalid input with field errors", async () => {
    const useCase = createUseCase();

    await expect(
      useCase.execute({
        categoryId: " ",
        description: "troppo corta",
        latitude: "non valida",
        longitude: "999",
        address: "a".repeat(501)
      })
    ).rejects.toMatchObject({
      fieldErrors: {
        categoryId: "Seleziona una categoria.",
        description: "Descrivi il problema con almeno 20 caratteri.",
        latitude: "Inserisci una latitudine valida tra -90 e 90.",
        longitude: "Inserisci una longitudine valida tra -180 e 180.",
        address: "L'indirizzo non puo superare 500 caratteri."
      }
    });
  });

  it("rejects a missing or inactive category", async () => {
    const useCase = createUseCase({ categoryRepository: new FakeCategoryRepository(null) });

    await expect(useCase.execute(createValidInput())).rejects.toMatchObject({
      fieldErrors: {
        categoryId: "Seleziona una categoria disponibile."
      }
    });
  });

  it("retries public code generation when a collision occurs", async () => {
    const reportRepository = new InMemoryReportRepository({ duplicateCodes: ["VC-23456789"] });
    const useCase = createUseCase({
      reportRepository,
      publicCodeGenerator: new SequencePublicCodeGenerator(["VC-23456789", "VC-ABCDEFGH"]),
      createId: new SequenceIdGenerator(["report-1", "report-2"])
    });

    const result = await useCase.execute(createValidInput());

    expect(result).toEqual({ reportId: "report-2", publicCode: "VC-ABCDEFGH" });
    expect(reportRepository.saveAttempts).toBe(2);
  });

  it("fails with a controlled error when public code retries are exhausted", async () => {
    const reportRepository = new InMemoryReportRepository({ duplicateCodes: ["VC-23456789"] });
    const useCase = createUseCase({
      reportRepository,
      maxPublicCodeRetries: 2,
      publicCodeGenerator: new SequencePublicCodeGenerator(["VC-23456789", "VC-23456789"]),
      createId: new SequenceIdGenerator(["report-1", "report-2"])
    });

    await expect(useCase.execute(createValidInput())).rejects.toThrow(
      PublicCodeGenerationExhaustedError
    );
    expect(reportRepository.saveAttempts).toBe(2);
  });
});

describe("validateCreateReportInput", () => {
  it("trims text and accepts comma decimal coordinates", () => {
    expect(
      validateCreateReportInput({
        categoryId: " test-roads ",
        description: "  Segnalazione con spazi ripetuti nella descrizione.  ",
        latitude: "41,4821",
        longitude: "14,0474",
        address: "  Via Roma  "
      })
    ).toEqual({
      categoryId: "test-roads",
      description: "Segnalazione con spazi ripetuti nella descrizione.",
      latitude: 41.4821,
      longitude: 14.0474,
      address: "Via Roma"
    });
  });

  it("throws CreateReportValidationError for empty malicious-looking input", () => {
    expect(() =>
      validateCreateReportInput({
        categoryId: "<script>",
        description: "       ",
        latitude: "Infinity",
        longitude: "NaN"
      })
    ).toThrow(CreateReportValidationError);
  });
});

describe("deriveReportTitle", () => {
  it("derives a deterministic title from category and address", () => {
    expect(
      deriveReportTitle({
        categoryName: "Illuminazione",
        address: "Piazza centrale",
        description: "Lampione spento da diversi giorni."
      })
    ).toBe("Illuminazione: Piazza centrale");
  });
});

function createUseCase(overrides: Partial<CreateReportUseCaseDependenciesForTest> = {}) {
  return new CreateReportUseCase({
    reportRepository: overrides.reportRepository ?? new InMemoryReportRepository(),
    categoryRepository: overrides.categoryRepository ?? new FakeCategoryRepository(category),
    publicCodeGenerator:
      overrides.publicCodeGenerator ?? new SequencePublicCodeGenerator(["VC-23456789"]),
    now: () => new Date("2026-01-01T10:00:00.000Z"),
    createId: overrides.createId?.next ?? new SequenceIdGenerator(["report-1"]).next,
    maxPublicCodeRetries: overrides.maxPublicCodeRetries
  });
}

type CreateReportUseCaseDependenciesForTest = {
  reportRepository: ReportRepository;
  categoryRepository: CategoryRepository;
  publicCodeGenerator: PublicCodeGenerator;
  createId: SequenceIdGenerator;
  maxPublicCodeRetries: number;
};

class FakeCategoryRepository implements CategoryRepository {
  constructor(private readonly category: CategoryOption | null) {}

  async findById(categoryId: string): Promise<CategoryOption | null> {
    return this.category?.id === categoryId ? this.category : null;
  }

  async listActive(): Promise<CategoryOption[]> {
    return this.category ? [this.category] : [];
  }

  async findActiveById(categoryId: string): Promise<CategoryOption | null> {
    return this.category?.id === categoryId ? this.category : null;
  }
}

class InMemoryReportRepository implements ReportRepository {
  readonly savedReports: Report[] = [];
  readonly savedEvents: ReportDomainEvent[] = [];
  saveAttempts = 0;

  constructor(private readonly options: { duplicateCodes?: string[] } = {}) {}

  async save(report: Report, events: ReportDomainEvent[] = []): Promise<void> {
    this.saveAttempts += 1;
    const publicCode = report.toSnapshot().publicCode;

    if (this.options.duplicateCodes?.includes(publicCode)) {
      throw new DuplicatePublicCodePersistenceError(publicCode);
    }

    this.savedReports.push(report);
    this.savedEvents.push(...events);
  }

  async findByPublicCode(publicCode: PublicCodeValue): Promise<Report | null> {
    return this.savedReports.find((report) => report.toSnapshot().publicCode === publicCode.toString()) ?? null;
  }

  async listForModeration(input: { status?: ReportModerationFilter; limit?: number } = {}): Promise<ReportModerationSummary[]> {
    const status = input.status ?? "pending_review";
    return this.savedReports
      .filter((report) => status === "all" || report.toSnapshot().moderationStatus === status)
      .slice(0, input.limit ?? 100)
      .map((report) => {
        const snapshot = report.toSnapshot();
        return {
          publicCode: snapshot.publicCode,
          title: snapshot.title,
          categoryName: "Categoria test",
          createdAt: snapshot.createdAt,
          moderationStatus: snapshot.moderationStatus,
          ...(snapshot.location.address ? { address: snapshot.location.address } : {})
        };
      });
  }

  async countByModerationStatus(status: ModerationStatus): Promise<number> {
    return this.savedReports.filter((report) => report.toSnapshot().moderationStatus === status).length;
  }

  async findPublicByPublicCode(): Promise<null> {
    return null;
  }

  async listPublicEventsByPublicCode(): Promise<[]> {
    return [];
  }
}

class SequencePublicCodeGenerator implements PublicCodeGenerator {
  private index = 0;

  constructor(private readonly values: string[]) {}

  generate(): PublicCodeValue {
    const value = this.values[this.index] ?? this.values.at(-1);
    this.index += 1;

    if (!value) {
      throw new Error("Missing public code test value.");
    }

    return PublicCode.create(value);
  }
}

class SequenceIdGenerator {
  private index = 0;

  constructor(private readonly values: string[]) {}

  next = () => {
    const value = this.values[this.index] ?? this.values.at(-1);
    this.index += 1;

    if (!value) {
      throw new Error("Missing id test value.");
    }

    return value;
  };
}

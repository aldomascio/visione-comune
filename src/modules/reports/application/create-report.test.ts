import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { CategoryDetails, CategoryListItem, CategoryOption, CategoryRepository, CategoryUpdate, NewCategory } from "@/modules/categories/application/category-repository";
import type { SaveObjectInput, StorageProvider, StoredObject } from "@/modules/storage/application/storage-provider";
import {
  PublicCode,
  type ModerationStatus,
  type PublicCode as PublicCodeValue,
  type Report,
  type ReportDomainEvent
} from "../domain";
import {
  DuplicatePublicCodePersistenceError,
  type NewReportAttachment,
  type ReportModerationFilter,
  type ReportModerationSummary,
  type ReportRepository
} from "./report-repository";
import type { PublicCodeGenerator } from "./public-code-generator";
import {
  CreateAdminReportUseCase,
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
    title: "Buca profonda vicino alla scuola",
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
      title: "Buca profonda vicino alla scuola",
      categoryId: "test-roads",
      source: "platform",
      moderationStatus: "pending_review",
      createdAt: new Date("2026-01-01T10:00:00.000Z")
    });
    expect(reportRepository.savedReports[0]?.toSnapshot().createdByAdminId).toBeUndefined();
    expect(reportRepository.savedReports[0]?.toSnapshot().publicStatus).toBeUndefined();
    expect(reportRepository.savedEvents).toMatchObject([
      {
        type: "ReportCreated",
        metadata: { source: "platform" }
      }
    ]);
  });

  it("uses an explicit report title when provided", async () => {
    const reportRepository = new InMemoryReportRepository();
    const useCase = createUseCase({ reportRepository });

    await useCase.execute({
      ...createValidInput(),
      title: "Buca profonda sulla carreggiata"
    });

    expect(reportRepository.savedReports[0]?.toSnapshot().title).toBe("Buca profonda sulla carreggiata");
  });

  it("creates an admin report with the selected source as pending review", async () => {
    const reportRepository = new InMemoryReportRepository();
    const useCase = createAdminUseCase({ reportRepository });

    const result = await useCase.execute({ ...createValidInput(), source: "social", createdByAdminId: "admin-1" });

    expect(result).toEqual({ reportId: "report-1", publicCode: "VC-23456789" });
    expect(reportRepository.savedReports[0]?.toSnapshot()).toMatchObject({
      source: "social",
      createdByAdminId: "admin-1",
      moderationStatus: "pending_review"
    });
    expect(reportRepository.savedReports[0]?.toSnapshot().publicStatus).toBeUndefined();
    expect(reportRepository.savedEvents).toMatchObject([
      {
        type: "ReportCreated",
        visibility: "internal",
        metadata: { source: "social", createdByAdminId: "admin-1" }
      }
    ]);
  });

  it("rejects invalid admin report source", async () => {
    const useCase = createAdminUseCase();

    await expect(useCase.execute({ ...createValidInput(), source: "fax", createdByAdminId: "admin-1" })).rejects.toMatchObject({
      fieldErrors: {
        source: "Seleziona una fonte valida."
      }
    });
  });

  it("rejects admin report creation without a server-side admin id", async () => {
    const useCase = createAdminUseCase();

    await expect(useCase.execute({ ...createValidInput(), source: "email", createdByAdminId: " " })).rejects.toMatchObject({
      fieldErrors: {
        createdByAdminId: "Identita amministratore non disponibile."
      }
    });
  });


  it("creates a pending report with a normalized photo attachment", async () => {
    const reportRepository = new InMemoryReportRepository();
    const storageProvider = new FakeStorageProvider();
    const useCase = createUseCase({ reportRepository, storageProvider });

    const result = await useCase.execute({
      ...createValidInput(),
      photo: { buffer: await validPng(), mimeType: "image/png" }
    });

    expect(result).toEqual({ reportId: "report-1", publicCode: "VC-23456789" });
    expect(storageProvider.savedObjects).toHaveLength(1);
    expect(reportRepository.savedAttachments[0]).toMatchObject({
      reportId: "report-1",
      type: "report_photo",
      storageKey: "stored-photo-1.jpg",
      mimeType: "image/jpeg",
      reviewStatus: "pending_review"
    });
  });

  it("cleans up a stored photo when database save fails", async () => {
    const reportRepository = new InMemoryReportRepository({ duplicateCodes: ["VC-23456789"] });
    const storageProvider = new FakeStorageProvider();
    const useCase = createUseCase({
      reportRepository,
      storageProvider,
      maxPublicCodeRetries: 1
    });

    await expect(
      useCase.execute({
        ...createValidInput(),
        photo: { buffer: await validPng(), mimeType: "image/png" }
      })
    ).rejects.toThrow(PublicCodeGenerationExhaustedError);

    expect(storageProvider.deletedKeys).toEqual(["stored-photo-1.jpg"]);
  });

  it("rejects invalid input with field errors", async () => {
    const useCase = createUseCase();

    await expect(
      useCase.execute({
        categoryId: " ",
        title: " ",
        description: "troppo corta",
        latitude: "non valida",
        longitude: "999",
        address: "a".repeat(501)
      })
    ).rejects.toMatchObject({
      fieldErrors: {
        categoryId: "Seleziona una categoria.",
        title: "Inserisci un titolo.",
        description: "Descrivi il problema con almeno 20 caratteri.",
        latitude: "Inserisci una latitudine valida tra -90 e 90.",
        longitude: "Inserisci una longitudine valida tra -180 e 180.",
        address: "L'indirizzo non puo superare 500 caratteri."
      }
    });
  });

  it("rejects a too short explicit title in public submissions", async () => {
    const useCase = createUseCase();

    await expect(useCase.execute({ ...createValidInput(), title: "abc" })).rejects.toMatchObject({
      fieldErrors: {
        title: "Il titolo deve avere almeno 5 caratteri."
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
    maxPublicCodeRetries: overrides.maxPublicCodeRetries,
    storageProvider: overrides.storageProvider
  });
}


function createAdminUseCase(overrides: Partial<CreateReportUseCaseDependenciesForTest> = {}) {
  return new CreateAdminReportUseCase({
    reportRepository: overrides.reportRepository ?? new InMemoryReportRepository(),
    categoryRepository: overrides.categoryRepository ?? new FakeCategoryRepository(category),
    publicCodeGenerator:
      overrides.publicCodeGenerator ?? new SequencePublicCodeGenerator(["VC-23456789"]),
    now: () => new Date("2026-01-01T10:00:00.000Z"),
    createId: overrides.createId?.next ?? new SequenceIdGenerator(["report-1"]).next,
    maxPublicCodeRetries: overrides.maxPublicCodeRetries,
    storageProvider: overrides.storageProvider
  });
}

type CreateReportUseCaseDependenciesForTest = {
  reportRepository: ReportRepository;
  categoryRepository: CategoryRepository;
  publicCodeGenerator: PublicCodeGenerator;
  createId: SequenceIdGenerator;
  maxPublicCodeRetries: number;
  storageProvider: StorageProvider;
};

class FakeCategoryRepository implements CategoryRepository {
  constructor(private category: CategoryOption | null) {}

  async listActive(): Promise<CategoryOption[]> {
    return this.category ? [this.category] : [];
  }

  async listAll(): Promise<CategoryListItem[]> {
    const details = this.category ? toCategoryDetails(this.category) : null;
    return details ? [{ ...details, reportCount: 0 }] : [];
  }

  async findById(categoryId: string): Promise<CategoryDetails | null> {
    return this.category?.id === categoryId ? toCategoryDetails(this.category) : null;
  }

  async findBySlug(slug: string): Promise<CategoryDetails | null> {
    return this.category?.slug === slug ? toCategoryDetails(this.category) : null;
  }

  async findActiveById(categoryId: string): Promise<CategoryOption | null> {
    return this.category?.id === categoryId ? this.category : null;
  }

  async create(category: NewCategory): Promise<CategoryDetails> {
    this.category = category;
    return category;
  }

  async update(category: CategoryUpdate): Promise<CategoryDetails | null> {
    const existingCategory = this.category ? toCategoryDetails(this.category) : null;

    if (!existingCategory || existingCategory.id !== category.id) {
      return null;
    }

    const updatedCategory = { ...existingCategory, ...category };
    this.category = updatedCategory;

    return updatedCategory;
  }
}

function toCategoryDetails(category: CategoryOption): CategoryDetails {
  if ("active" in category && "createdAt" in category && "updatedAt" in category) {
    return category as CategoryDetails;
  }

  return {
    ...category,
    active: true,
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
    updatedAt: new Date("2026-01-01T10:00:00.000Z")
  };
}

class InMemoryReportRepository implements ReportRepository {
  readonly savedReports: Report[] = [];
  readonly savedEvents: ReportDomainEvent[] = [];
  readonly savedAttachments: NewReportAttachment[] = [];
  saveAttempts = 0;

  constructor(private readonly options: { duplicateCodes?: string[] } = {}) {}

  async saveWithAttachment(report: Report, attachment: NewReportAttachment, events: ReportDomainEvent[] = []): Promise<void> {
    await this.save(report, events);
    this.savedAttachments.push(attachment);
  }

  async findAttachmentForModeration(): Promise<null> {
    return null;
  }

  async findPublicAttachmentByPublicCode(): Promise<null> {
    return null;
  }

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
          source: snapshot.source,
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

  async listPublicForMap(): Promise<[]> {
    return [];
  }

  async findPotentialDuplicates(): Promise<[]> {
    return [];
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


class FakeStorageProvider implements StorageProvider {
  readonly savedObjects: SaveObjectInput[] = [];
  readonly deletedKeys: string[] = [];

  async save(input: SaveObjectInput): Promise<StoredObject> {
    this.savedObjects.push(input);
    return { storageKey: `stored-photo-${this.savedObjects.length}.${input.extension}`, size: input.buffer.byteLength };
  }

  async read(): Promise<Buffer> {
    return Buffer.alloc(0);
  }

  async delete(storageKey: string): Promise<void> {
    this.deletedKeys.push(storageKey);
  }
}

async function validPng(): Promise<Buffer> {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: "red" } })
    .png()
    .toBuffer();
}

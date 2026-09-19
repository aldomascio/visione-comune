import { randomUUID } from "node:crypto";
import type { CategoryRepository } from "@/modules/categories/application/category-repository";
import type { StorageProvider } from "@/modules/storage/application/storage-provider";
import { processReportImage, mapReportImageErrorToMessage } from "./attachments/report-image-processing";
import {
  InvalidLocationError,
  InvalidPublicCodeError,
  InvalidReportDataError,
  Location,
  Report,
  isReportSource,
  type ReportSource
} from "../domain";
import {
  DuplicatePublicCodePersistenceError,
  type ReportRepository
} from "./report-repository";
import type { PublicCodeGenerator } from "./public-code-generator";

export const CREATE_REPORT_DESCRIPTION_MIN_LENGTH = 20;
export const CREATE_REPORT_DESCRIPTION_MAX_LENGTH = 500;
export const CREATE_REPORT_ADDRESS_MAX_LENGTH = 500;
export const CREATE_REPORT_TITLE_MIN_LENGTH = 5;
export const CREATE_REPORT_TITLE_MAX_LENGTH = 180;
export const CREATE_REPORT_PUBLIC_CODE_MAX_RETRIES = 5;

export type CreateReportInput = {
  categoryId: string;
  description: string;
  title?: string;
  latitude: string | number;
  longitude: string | number;
  address?: string;
  photo?: { buffer: Buffer; mimeType?: string };
};

export type CreateReportResult = {
  reportId: string;
  publicCode: string;
};

export type CreateAdminReportInput = CreateReportInput & {
  source: string;
  createdByAdminId: string;
};

export class CreateReportValidationError extends Error {
  constructor(readonly fieldErrors: CreateReportFieldErrors) {
    super("Report submission contains invalid data.");
    this.name = "CreateReportValidationError";
  }
}

export class PublicCodeGenerationExhaustedError extends Error {
  constructor(readonly attempts: number) {
    super(`Unable to generate a unique public code after ${attempts} attempts.`);
    this.name = "PublicCodeGenerationExhaustedError";
  }
}

export type CreateReportFieldErrors = Partial<
  Record<"categoryId" | "source" | "createdByAdminId" | "title" | "description" | "latitude" | "longitude" | "address" | "photo", string>
>;

export type CreateReportUseCaseDependencies = {
  reportRepository: ReportRepository;
  categoryRepository: CategoryRepository;
  publicCodeGenerator: PublicCodeGenerator;
  storageProvider?: StorageProvider;
  now?: () => Date;
  createId?: () => string;
  maxPublicCodeRetries?: number;
};

export class CreateReportUseCase {
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly maxPublicCodeRetries: number;

  constructor(private readonly dependencies: CreateReportUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.createId = dependencies.createId ?? randomUUID;
    this.maxPublicCodeRetries =
      dependencies.maxPublicCodeRetries ?? CREATE_REPORT_PUBLIC_CODE_MAX_RETRIES;
  }

  async execute(input: CreateReportInput): Promise<CreateReportResult> {
    return createReportWithSource(this.dependencies, {
      input,
      requireTitle: true,
      source: "platform",
      now: this.now,
      createId: this.createId,
      maxPublicCodeRetries: this.maxPublicCodeRetries
    });
  }
}

export class CreateAdminReportUseCase {
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly maxPublicCodeRetries: number;

  constructor(private readonly dependencies: CreateReportUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.createId = dependencies.createId ?? randomUUID;
    this.maxPublicCodeRetries =
      dependencies.maxPublicCodeRetries ?? CREATE_REPORT_PUBLIC_CODE_MAX_RETRIES;
  }

  async execute(input: CreateAdminReportInput): Promise<CreateReportResult> {
    const source = parseCreateReportSource(input.source);
    const createdByAdminId = parseCreatedByAdminId(input.createdByAdminId);
    return createReportWithSource(this.dependencies, {
      input,
      source,
      createdByAdminId,
      now: this.now,
      createId: this.createId,
      maxPublicCodeRetries: this.maxPublicCodeRetries
    });
  }
}

async function createReportWithSource(
  dependencies: CreateReportUseCaseDependencies,
  options: {
    input: CreateReportInput;
    requireTitle?: boolean;
    source: ReportSource;
    createdByAdminId?: string;
    now: () => Date;
    createId: () => string;
    maxPublicCodeRetries: number;
  }
): Promise<CreateReportResult> {
  const validatedInput = validateCreateReportInput(options.input, { requireTitle: options.requireTitle });
  const category = await dependencies.categoryRepository.findActiveById(
    validatedInput.categoryId
  );

  if (!category) {
    throw new CreateReportValidationError({
      categoryId: "Seleziona una categoria disponibile."
    });
  }

  const processedPhoto = options.input.photo
    ? await processReportImage({ buffer: options.input.photo.buffer, declaredMimeType: options.input.photo.mimeType })
    : undefined;

  const title = validatedInput.title ?? deriveReportTitle({
    categoryName: category.name,
    address: validatedInput.address,
    description: validatedInput.description
  });

  for (let attempt = 1; attempt <= options.maxPublicCodeRetries; attempt += 1) {
    const publicCode = dependencies.publicCodeGenerator.generate();
    const report = Report.create({
      id: options.createId(),
      publicCode,
      title,
      description: validatedInput.description,
      categoryId: validatedInput.categoryId,
      source: options.source,
      ...(options.createdByAdminId ? { createdByAdminId: options.createdByAdminId } : {}),
      location: Location.create({
        latitude: validatedInput.latitude,
        longitude: validatedInput.longitude,
        ...(validatedInput.address ? { address: validatedInput.address } : {})
      }),
      createdAt: options.now()
    });

    const events = report.pullDomainEvents();
    const snapshot = report.toSnapshot();
    let savedStorageKey: string | undefined;

    try {
      if (processedPhoto) {
        if (!dependencies.storageProvider) {
          throw new Error("Storage provider is required for report photos.");
        }

        const storedPhoto = await dependencies.storageProvider.save({
          buffer: processedPhoto.buffer,
          extension: processedPhoto.extension
        });
        savedStorageKey = storedPhoto.storageKey;

        const attachmentId = options.createId();
        await dependencies.reportRepository.saveWithAttachment(
          report,
          {
            id: attachmentId,
            reportId: snapshot.id,
            type: "report_photo",
            storageKey: storedPhoto.storageKey,
            mimeType: processedPhoto.mimeType,
            size: storedPhoto.size,
            reviewStatus: "pending_review",
            createdAt: snapshot.createdAt
          },
          [
            ...events,
            {
              type: "ReportAttachmentAdded",
              reportId: snapshot.id,
              occurredAt: snapshot.createdAt,
              visibility: "internal",
              metadata: { attachmentId, attachmentType: "report_photo" }
            }
          ]
        );
      } else {
        await dependencies.reportRepository.save(report, events);
      }

      return {
        reportId: snapshot.id,
        publicCode: publicCode.toString()
      };
    } catch (error) {
      if (savedStorageKey && dependencies.storageProvider) {
        await cleanupStoredPhoto(dependencies.storageProvider, savedStorageKey);
      }

      if (error instanceof DuplicatePublicCodePersistenceError) {
        continue;
      }

      throw error;
    }
  }

  throw new PublicCodeGenerationExhaustedError(options.maxPublicCodeRetries);
}

export function parseCreatedByAdminId(value: string): string {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    throw new CreateReportValidationError({
      createdByAdminId: "Identita amministratore non disponibile."
    });
  }

  return normalizedValue;
}

export function parseCreateReportSource(value: string): ReportSource {
  const normalizedValue = value.trim();

  if (!isReportSource(normalizedValue)) {
    throw new CreateReportValidationError({
      source: "Seleziona una fonte valida."
    });
  }

  return normalizedValue;
}

export function validateCreateReportInput(input: CreateReportInput, options: { requireTitle?: boolean } = {}): {
  categoryId: string;
  description: string;
  latitude: number;
  longitude: number;
  address?: string;
  title?: string;
} {
  const fieldErrors: CreateReportFieldErrors = {};
  const categoryId = normalizeText(input.categoryId);
  const description = normalizeText(input.description);
  const title = normalizeText(input.title ?? "");
  const address = normalizeText(input.address ?? "");
  const latitude = parseCoordinate(input.latitude);
  const longitude = parseCoordinate(input.longitude);

  if (!categoryId) {
    fieldErrors.categoryId = "Seleziona una categoria.";
  }

  if (options.requireTitle && !title) {
    fieldErrors.title = "Inserisci un titolo.";
  } else if (options.requireTitle && title.length < CREATE_REPORT_TITLE_MIN_LENGTH) {
    fieldErrors.title = `Il titolo deve avere almeno ${CREATE_REPORT_TITLE_MIN_LENGTH} caratteri.`;
  } else if (title.length > CREATE_REPORT_TITLE_MAX_LENGTH) {
    fieldErrors.title = `Il titolo non puo superare ${CREATE_REPORT_TITLE_MAX_LENGTH} caratteri.`;
  }

  if (!description) {
    fieldErrors.description = "Descrivi il problema.";
  } else if (description.length < CREATE_REPORT_DESCRIPTION_MIN_LENGTH) {
    fieldErrors.description = `Descrivi il problema con almeno ${CREATE_REPORT_DESCRIPTION_MIN_LENGTH} caratteri.`;
  } else if (description.length > CREATE_REPORT_DESCRIPTION_MAX_LENGTH) {
    fieldErrors.description = `La descrizione non puo superare ${CREATE_REPORT_DESCRIPTION_MAX_LENGTH} caratteri.`;
  }

  if (latitude === null || latitude < -90 || latitude > 90) {
    fieldErrors.latitude = "Inserisci una latitudine valida tra -90 e 90.";
  }

  if (longitude === null || longitude < -180 || longitude > 180) {
    fieldErrors.longitude = "Inserisci una longitudine valida tra -180 e 180.";
  }

  if (address.length > CREATE_REPORT_ADDRESS_MAX_LENGTH) {
    fieldErrors.address = `L'indirizzo non puo superare ${CREATE_REPORT_ADDRESS_MAX_LENGTH} caratteri.`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new CreateReportValidationError(fieldErrors);
  }

  try {
    Location.create({ latitude: latitude as number, longitude: longitude as number, address });
  } catch (error) {
    if (error instanceof InvalidLocationError) {
      throw new CreateReportValidationError({
        latitude: fieldErrors.latitude,
        longitude: fieldErrors.longitude
      });
    }

    throw error;
  }

  return {
    categoryId,
    description,
    ...(title ? { title } : {}),
    latitude: latitude as number,
    longitude: longitude as number,
    ...(address ? { address } : {})
  };
}

export function deriveReportTitle(input: {
  categoryName: string;
  address?: string;
  description: string;
}): string {
  const categoryName = normalizeText(input.categoryName);
  const address = normalizeText(input.address ?? "");
  const description = normalizeText(input.description);
  const baseTitle = address
    ? `${categoryName}: ${address}`
    : `${categoryName}: ${description.slice(0, 80)}`;

  return baseTitle.slice(0, CREATE_REPORT_TITLE_MAX_LENGTH).trim();
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function parseCoordinate(value: string | number): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const normalizedValue = value.trim().replace(",", ".");

  if (!normalizedValue) {
    return null;
  }

  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

async function cleanupStoredPhoto(storageProvider: StorageProvider, storageKey: string): Promise<void> {
  try {
    await storageProvider.delete(storageKey);
  } catch (cleanupError) {
    console.error("Unable to cleanup report photo after create failure", cleanupError);
  }
}

export function mapCreateReportErrorToMessage(error: unknown): string {
  if (error instanceof CreateReportValidationError) {
    return "Controlla i campi evidenziati.";
  }

  if (error instanceof Error && error.name === "InvalidReportImageError") {
    return mapReportImageErrorToMessage(error);
  }

  if (
    error instanceof PublicCodeGenerationExhaustedError ||
    error instanceof InvalidPublicCodeError ||
    error instanceof InvalidReportDataError ||
    error instanceof InvalidLocationError
  ) {
    return "Non siamo riusciti a registrare la segnalazione. Riprova tra poco.";
  }

  return "Si e verificato un errore inatteso. Riprova tra poco.";
}

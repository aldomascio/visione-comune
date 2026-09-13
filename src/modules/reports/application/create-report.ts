import { randomUUID } from "node:crypto";
import type { CategoryRepository } from "@/modules/categories/application/category-repository";
import {
  InvalidLocationError,
  InvalidPublicCodeError,
  InvalidReportDataError,
  Location,
  Report
} from "../domain";
import {
  DuplicatePublicCodePersistenceError,
  type ReportRepository
} from "./report-repository";
import type { PublicCodeGenerator } from "./public-code-generator";

export const CREATE_REPORT_DESCRIPTION_MIN_LENGTH = 20;
export const CREATE_REPORT_DESCRIPTION_MAX_LENGTH = 4000;
export const CREATE_REPORT_ADDRESS_MAX_LENGTH = 500;
export const CREATE_REPORT_TITLE_MAX_LENGTH = 180;
export const CREATE_REPORT_PUBLIC_CODE_MAX_RETRIES = 5;

export type CreateReportInput = {
  categoryId: string;
  description: string;
  latitude: string | number;
  longitude: string | number;
  address?: string;
};

export type CreateReportResult = {
  reportId: string;
  publicCode: string;
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
  Record<"categoryId" | "description" | "latitude" | "longitude" | "address", string>
>;

export type CreateReportUseCaseDependencies = {
  reportRepository: ReportRepository;
  categoryRepository: CategoryRepository;
  publicCodeGenerator: PublicCodeGenerator;
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
    const validatedInput = validateCreateReportInput(input);
    const category = await this.dependencies.categoryRepository.findActiveById(
      validatedInput.categoryId
    );

    if (!category) {
      throw new CreateReportValidationError({
        categoryId: "Seleziona una categoria disponibile."
      });
    }

    const title = deriveReportTitle({
      categoryName: category.name,
      address: validatedInput.address,
      description: validatedInput.description
    });

    for (let attempt = 1; attempt <= this.maxPublicCodeRetries; attempt += 1) {
      const publicCode = this.dependencies.publicCodeGenerator.generate();
      const report = Report.create({
        id: this.createId(),
        publicCode,
        title,
        description: validatedInput.description,
        categoryId: validatedInput.categoryId,
        location: Location.create({
          latitude: validatedInput.latitude,
          longitude: validatedInput.longitude,
          ...(validatedInput.address ? { address: validatedInput.address } : {})
        }),
        createdAt: this.now()
      });

      try {
        await this.dependencies.reportRepository.save(report, report.pullDomainEvents());
        return {
          reportId: report.toSnapshot().id,
          publicCode: publicCode.toString()
        };
      } catch (error) {
        if (error instanceof DuplicatePublicCodePersistenceError) {
          continue;
        }

        throw error;
      }
    }

    throw new PublicCodeGenerationExhaustedError(this.maxPublicCodeRetries);
  }
}

export function validateCreateReportInput(input: CreateReportInput): {
  categoryId: string;
  description: string;
  latitude: number;
  longitude: number;
  address?: string;
} {
  const fieldErrors: CreateReportFieldErrors = {};
  const categoryId = normalizeText(input.categoryId);
  const description = normalizeText(input.description);
  const address = normalizeText(input.address ?? "");
  const latitude = parseCoordinate(input.latitude);
  const longitude = parseCoordinate(input.longitude);

  if (!categoryId) {
    fieldErrors.categoryId = "Seleziona una categoria.";
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

export function mapCreateReportErrorToMessage(error: unknown): string {
  if (error instanceof CreateReportValidationError) {
    return "Controlla i campi evidenziati.";
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

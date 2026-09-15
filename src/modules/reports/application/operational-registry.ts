import type { CategoryRepository } from "@/modules/categories/application/category-repository";
import type { Transmission } from "@/modules/communications/application/transmission-repository";
import {
  InvalidPublicCodeError,
  InvalidReportTransitionError,
  PublicCode,
  type Report,
  type ReportDomainEvent,
  type ReportSnapshot,
} from "../domain";
import type { ReportRepository } from "./report-repository";

export type OperationalStateKey =
  | "duplicate"
  | "rejected"
  | "pending_review"
  | "to_transmit"
  | "transmitting"
  | "communicated"
  | "resolved";

export type DerivedReportOperationalState = {
  key: OperationalStateKey;
  label: string;
  description: string;
};

export type DeriveReportOperationalStateInput = {
  report: Pick<ReportSnapshot, "moderationStatus" | "publicStatus" | "duplicateOfReportId">;
  transmissions?: Array<Pick<Transmission, "status">>;
};

export class ReportOperationalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportOperationalError";
  }
}

export class ReportCategoryChangeError extends ReportOperationalError {
  constructor(message: string) {
    super(message);
    this.name = "ReportCategoryChangeError";
  }
}

export class ReportInternalNoteError extends ReportOperationalError {
  constructor(message: string) {
    super(message);
    this.name = "ReportInternalNoteError";
  }
}

export class ReportOperationalNotFoundError extends ReportOperationalError {
  constructor(publicCode: string) {
    super(`Report not found for operational registry: ${publicCode}`);
    this.name = "ReportOperationalNotFoundError";
  }
}

export type ChangeReportCategoryUseCaseDependencies = {
  reportRepository: ReportRepository;
  categoryRepository: CategoryRepository;
  now?: () => Date;
};

export class ChangeReportCategoryUseCase {
  private readonly now: () => Date;

  constructor(private readonly dependencies: ChangeReportCategoryUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async execute(input: {
    publicCode: string;
    categoryId: string;
    actorAdminId?: string;
    actorAdminEmail?: string;
  }): Promise<void> {
    const report = await findOperationalReport(this.dependencies.reportRepository, input.publicCode);
    const snapshot = report.toSnapshot();
    const normalizedCategoryId = normalizeText(input.categoryId);

    if (!normalizedCategoryId) {
      throw new ReportCategoryChangeError("Seleziona una categoria attiva.");
    }

    if (normalizedCategoryId === snapshot.categoryId) {
      throw new ReportCategoryChangeError("La segnalazione e gia associata a questa categoria.");
    }

    const [previousCategory, newCategory] = await Promise.all([
      this.dependencies.categoryRepository.findById(snapshot.categoryId),
      this.dependencies.categoryRepository.findActiveById(normalizedCategoryId),
    ]);

    if (!newCategory) {
      throw new ReportCategoryChangeError("La categoria selezionata non e attiva.");
    }

    try {
      report.changeCategory({
        newCategoryId: newCategory.id,
        changedAt: this.now(),
        previousCategoryName: previousCategory?.name,
        newCategoryName: newCategory.name,
        actorAdminId: normalizeText(input.actorAdminId),
        actorAdminEmail: normalizeText(input.actorAdminEmail),
      });
    } catch (error) {
      if (error instanceof InvalidReportTransitionError) {
        throw new ReportCategoryChangeError(error.message);
      }
      throw error;
    }

    await this.dependencies.reportRepository.save(report, report.pullDomainEvents());
  }
}

export type AddInternalReportNoteUseCaseDependencies = {
  reportRepository: ReportRepository;
  now?: () => Date;
};

export class AddInternalReportNoteUseCase {
  private readonly now: () => Date;

  constructor(private readonly dependencies: AddInternalReportNoteUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async execute(input: {
    publicCode: string;
    note: string;
    actorAdminId?: string;
    actorAdminEmail?: string;
  }): Promise<void> {
    const report = await findOperationalReport(this.dependencies.reportRepository, input.publicCode);
    const note = normalizeNote(input.note);

    if (!note) {
      throw new ReportInternalNoteError("Scrivi una nota interna.");
    }

    const event: ReportDomainEvent = {
      type: "InternalNoteAdded",
      reportId: report.toSnapshot().id,
      occurredAt: this.now(),
      visibility: "internal",
      metadata: {
        internalNote: note,
        ...(normalizeText(input.actorAdminId) ? { actorAdminId: normalizeText(input.actorAdminId) } : {}),
        ...(normalizeText(input.actorAdminEmail) ? { actorAdminEmail: normalizeText(input.actorAdminEmail) } : {}),
      },
    };

    await this.dependencies.reportRepository.save(report, [event]);
  }
}

export function deriveReportOperationalState(
  input: DeriveReportOperationalStateInput,
): DerivedReportOperationalState {
  const transmissions = input.transmissions ?? [];

  if (input.report.duplicateOfReportId) {
    return {
      key: "duplicate",
      label: "Duplicata",
      description: "La segnalazione e collegata a una segnalazione principale.",
    };
  }

  if (input.report.moderationStatus === "rejected") {
    return {
      key: "rejected",
      label: "Respinta",
      description: "La segnalazione e stata rifiutata e resta non pubblica.",
    };
  }

  if (input.report.publicStatus === "resolved") {
    return {
      key: "resolved",
      label: "Risolta",
      description: "Visione Comune ha verificato la risoluzione del problema.",
    };
  }

  if (input.report.publicStatus === "communicated") {
    return {
      key: "communicated",
      label: "Comunicata",
      description: "La comunicazione all'ente risulta consegnata.",
    };
  }

  if (input.report.moderationStatus === "pending_review") {
    return {
      key: "pending_review",
      label: "Da verificare",
      description: "La segnalazione attende la moderazione amministrativa.",
    };
  }

  if (input.report.publicStatus === "reported" && transmissions.some((transmission) => transmission.status === "sent")) {
    return {
      key: "transmitting",
      label: "In trasmissione",
      description: "Una trasmissione e stata segnata come inviata ma non ancora consegnata.",
    };
  }

  return {
    key: "to_transmit",
    label: "Da trasmettere",
    description: "La segnalazione e pubblica e attende una trasmissione consegnata all'ente.",
  };
}

async function findOperationalReport(
  reportRepository: ReportRepository,
  rawPublicCode: string,
): Promise<Report> {
  let publicCode: PublicCode;

  try {
    publicCode = PublicCode.create(rawPublicCode);
  } catch (error) {
    if (error instanceof InvalidPublicCodeError) {
      throw new ReportOperationalNotFoundError(rawPublicCode);
    }
    throw error;
  }

  const report = await reportRepository.findByPublicCode(publicCode);

  if (!report) {
    throw new ReportOperationalNotFoundError(publicCode.toString());
  }

  return report;
}

function normalizeNote(value: string): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  return normalized.slice(0, 1000);
}

function normalizeText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

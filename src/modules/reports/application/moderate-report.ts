import type { CategoryRepository } from "@/modules/categories/application/category-repository";
import {
  InvalidPublicCodeError,
  InvalidReportTransitionError,
  PublicCode,
  type ReportDomainEvent
} from "../domain";
import {
  ConcurrentReportModerationError,
  type ReportModerationFilter,
  type ReportModerationSummary,
  type ReportRepository
} from "./report-repository";

export type ModerationReportDetail = {
  id: string;
  publicCode: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName?: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  moderationStatus: "pending_review" | "approved" | "rejected";
  publicStatus?: "reported" | "communicated" | "resolved";
  createdAt: Date;
  publishedAt?: Date;
  communicatedAt?: Date;
  resolvedAt?: Date;
  attachment?: { url: string; mimeType: string; size: number };
};

export type ModerationDashboard = {
  pendingCount: number;
  latestPendingReports: ReportModerationSummary[];
};

export class ReportForModerationNotFoundError extends Error {
  constructor(publicCode: string) {
    super(`Report not found for moderation: ${publicCode}`);
    this.name = "ReportForModerationNotFoundError";
  }
}

export class InvalidModerationPublicCodeError extends Error {
  constructor(publicCode: string) {
    super(`Invalid moderation public code: ${publicCode}`);
    this.name = "InvalidModerationPublicCodeError";
  }
}

export class ReportAlreadyModeratedError extends Error {
  constructor(message = "La segnalazione e gia stata moderata.") {
    super(message);
    this.name = "ReportAlreadyModeratedError";
  }
}

export class ReportModerationConflictError extends Error {
  constructor() {
    super("La segnalazione e stata modificata da un altro amministratore. Aggiorna la pagina.");
    this.name = "ReportModerationConflictError";
  }
}

export type GetModerationDashboardUseCaseDependencies = {
  reportRepository: ReportRepository;
};

export class GetModerationDashboardUseCase {
  constructor(private readonly dependencies: GetModerationDashboardUseCaseDependencies) {}

  async execute(): Promise<ModerationDashboard> {
    const [pendingCount, latestPendingReports] = await Promise.all([
      this.dependencies.reportRepository.countByModerationStatus("pending_review"),
      this.dependencies.reportRepository.listForModeration({ status: "pending_review", limit: 5 })
    ]);

    return { pendingCount, latestPendingReports };
  }
}

export type ListReportsForModerationUseCaseDependencies = {
  reportRepository: ReportRepository;
};

export class ListReportsForModerationUseCase {
  constructor(private readonly dependencies: ListReportsForModerationUseCaseDependencies) {}

  execute(input: { status?: ReportModerationFilter } = {}): Promise<ReportModerationSummary[]> {
    return this.dependencies.reportRepository.listForModeration({
      status: input.status ?? "pending_review",
      limit: 100
    });
  }
}

export type GetReportForModerationUseCaseDependencies = {
  reportRepository: ReportRepository;
  categoryRepository: CategoryRepository;
};

export class GetReportForModerationUseCase {
  constructor(private readonly dependencies: GetReportForModerationUseCaseDependencies) {}

  async execute(input: { publicCode: string }): Promise<ModerationReportDetail> {
    const publicCode = parseModerationPublicCode(input.publicCode);
    const report = await this.dependencies.reportRepository.findByPublicCode(publicCode);

    if (!report) {
      throw new ReportForModerationNotFoundError(publicCode.toString());
    }

    const snapshot = report.toSnapshot();
    const category = await this.dependencies.categoryRepository.findById(snapshot.categoryId);

    const attachment = await this.dependencies.reportRepository.findAttachmentForModeration(publicCode);

    return {
      ...snapshot,
      categoryName: category?.name ?? snapshot.categoryId,
      ...(attachment
        ? {
            attachment: {
              url: `/admin/segnalazioni/${snapshot.publicCode}/foto`,
              mimeType: attachment.mimeType,
              size: attachment.size
            }
          }
        : {})
    };
  }
}

export type ApproveReportUseCaseDependencies = {
  reportRepository: ReportRepository;
  now?: () => Date;
};

export class ApproveReportUseCase {
  private readonly now: () => Date;

  constructor(private readonly dependencies: ApproveReportUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async execute(input: { publicCode: string }): Promise<ModerationReportDetail> {
    const publicCode = parseModerationPublicCode(input.publicCode);
    const report = await this.dependencies.reportRepository.findByPublicCode(publicCode);

    if (!report) {
      throw new ReportForModerationNotFoundError(publicCode.toString());
    }

    try {
      report.approve(this.now());
    } catch (error) {
      if (error instanceof InvalidReportTransitionError) {
        throw new ReportAlreadyModeratedError(mapTransitionErrorToMessage(error));
      }

      throw error;
    }

    const events = report.pullDomainEvents();
    await this.saveModerationTransition(report, events);

    return report.toSnapshot();
  }

  private async saveModerationTransition(
    report: Awaited<ReturnType<ReportRepository["findByPublicCode"]>> & {},
    events: ReportDomainEvent[]
  ): Promise<void> {
    try {
      await this.dependencies.reportRepository.save(report, events, {
        expectedModerationStatus: "pending_review"
      });
    } catch (error) {
      if (error instanceof ConcurrentReportModerationError) {
        throw new ReportModerationConflictError();
      }

      throw error;
    }
  }
}

export type RejectReportUseCaseDependencies = {
  reportRepository: ReportRepository;
  now?: () => Date;
};

export class RejectReportUseCase {
  private readonly now: () => Date;

  constructor(private readonly dependencies: RejectReportUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async execute(input: { publicCode: string; internalNote?: string }): Promise<ModerationReportDetail> {
    const publicCode = parseModerationPublicCode(input.publicCode);
    const report = await this.dependencies.reportRepository.findByPublicCode(publicCode);

    if (!report) {
      throw new ReportForModerationNotFoundError(publicCode.toString());
    }

    try {
      report.reject(this.now());
    } catch (error) {
      if (error instanceof InvalidReportTransitionError) {
        throw new ReportAlreadyModeratedError(mapTransitionErrorToMessage(error));
      }

      throw error;
    }

    const note = normalizeInternalNote(input.internalNote);
    const events = report.pullDomainEvents().map((event) =>
      event.type === "ReportRejected" && note
        ? { ...event, metadata: { ...event.metadata, internalNote: note } }
        : event
    );
    await this.saveModerationTransition(report, events);

    return report.toSnapshot();
  }

  private async saveModerationTransition(
    report: Awaited<ReturnType<ReportRepository["findByPublicCode"]>> & {},
    events: ReportDomainEvent[]
  ): Promise<void> {
    try {
      await this.dependencies.reportRepository.save(report, events, {
        expectedModerationStatus: "pending_review"
      });
    } catch (error) {
      if (error instanceof ConcurrentReportModerationError) {
        throw new ReportModerationConflictError();
      }

      throw error;
    }
  }
}

function parseModerationPublicCode(value: string): PublicCode {
  try {
    return PublicCode.create(value.trim().toUpperCase());
  } catch (error) {
    if (error instanceof InvalidPublicCodeError) {
      throw new InvalidModerationPublicCodeError(value);
    }

    throw error;
  }
}

function normalizeInternalNote(note: string | undefined): string | undefined {
  const normalized = note?.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return undefined;
  }

  return normalized.slice(0, 1000);
}

function mapTransitionErrorToMessage(error: InvalidReportTransitionError): string {
  if (error.message.includes("already approved")) {
    return "La segnalazione e gia stata approvata.";
  }

  if (error.message.includes("already rejected")) {
    return "La segnalazione e gia stata rifiutata.";
  }

  return "La segnalazione e gia stata moderata.";
}

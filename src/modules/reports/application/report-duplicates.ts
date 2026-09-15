import {
  InvalidPublicCodeError,
  InvalidReportTransitionError,
  PublicCode,
  type ReportDomainEvent,
} from "../domain";
import {
  ConcurrentReportDuplicateLinkError,
  type DuplicateReportSummary,
  type PotentialPrimaryReport,
  type ReportDuplicateSaveOptions,
  type ReportRepository,
} from "./report-repository";

type ReportDuplicateRepository = ReportRepository & {
  findById(reportId: string): Promise<import("../domain").Report | null>;
  saveDuplicateLink(report: import("../domain").Report, events: ReportDomainEvent[], options: ReportDuplicateSaveOptions): Promise<void>;
  removeDuplicateLink(report: import("../domain").Report, events: ReportDomainEvent[], options: ReportDuplicateSaveOptions): Promise<void>;
  searchPotentialPrimaryReports(input: { query: string; excludeReportId: string; limit: number }): Promise<PotentialPrimaryReport[]>;
  listDuplicatesOfReport(reportId: string): Promise<DuplicateReportSummary[]>;
};

export class ReportDuplicateNotFoundError extends Error {
  constructor(publicCode: string) {
    super(`Report not found for duplicate operation: ${publicCode}`);
    this.name = "ReportDuplicateNotFoundError";
  }
}

export class InvalidDuplicatePublicCodeError extends Error {
  constructor(publicCode: string) {
    super(`Invalid duplicate public code: ${publicCode}`);
    this.name = "InvalidDuplicatePublicCodeError";
  }
}

export class ReportDuplicateTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportDuplicateTargetError";
  }
}

export class ReportDuplicateConflictError extends Error {
  constructor() {
    super(
      "Il collegamento duplicato e stato modificato da un altro amministratore. Aggiorna la pagina.",
    );
    this.name = "ReportDuplicateConflictError";
  }
}

export class SearchPotentialPrimaryReportsUseCase {
  constructor(
    private readonly dependencies: { reportRepository: ReportDuplicateRepository },
  ) {}

  async execute(input: {
    publicCode: string;
    query?: string;
    limit?: number;
  }): Promise<PotentialPrimaryReport[]> {
    const reportPublicCode = parseDuplicatePublicCode(input.publicCode);
    const report =
      await this.dependencies.reportRepository.findByPublicCode(
        reportPublicCode,
      );

    if (!report) {
      throw new ReportDuplicateNotFoundError(reportPublicCode.toString());
    }

    return this.dependencies.reportRepository.searchPotentialPrimaryReports({
      query: normalizeSearchQuery(input.query),
      excludeReportId: report.toSnapshot().id,
      limit: normalizeLimit(input.limit),
    });
  }
}

export class ListReportDuplicatesUseCase {
  constructor(
    private readonly dependencies: { reportRepository: ReportDuplicateRepository },
  ) {}

  async execute(input: {
    publicCode: string;
  }): Promise<DuplicateReportSummary[]> {
    const publicCode = parseDuplicatePublicCode(input.publicCode);
    const report =
      await this.dependencies.reportRepository.findByPublicCode(publicCode);

    if (!report) {
      throw new ReportDuplicateNotFoundError(publicCode.toString());
    }

    return this.dependencies.reportRepository.listDuplicatesOfReport(
      report.toSnapshot().id,
    );
  }
}

export class MarkReportAsDuplicateUseCase {
  private readonly now: () => Date;

  constructor(
    private readonly dependencies: {
      reportRepository: ReportDuplicateRepository;
      now?: () => Date;
    },
  ) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async execute(input: {
    publicCode: string;
    primaryPublicCode: string;
  }): Promise<void> {
    const duplicatePublicCode = parseDuplicatePublicCode(input.publicCode);
    const primaryPublicCode = parseDuplicatePublicCode(input.primaryPublicCode);
    const [duplicateReport, primaryReport] = await Promise.all([
      this.dependencies.reportRepository.findByPublicCode(duplicatePublicCode),
      this.dependencies.reportRepository.findByPublicCode(primaryPublicCode),
    ]);

    if (!duplicateReport) {
      throw new ReportDuplicateNotFoundError(duplicatePublicCode.toString());
    }

    if (!primaryReport) {
      throw new ReportDuplicateNotFoundError(primaryPublicCode.toString());
    }

    const duplicateSnapshot = duplicateReport.toSnapshot();
    const primarySnapshot = primaryReport.toSnapshot();

    if (duplicateSnapshot.id === primarySnapshot.id) {
      throw new ReportDuplicateTargetError(
        "Una segnalazione non puo essere duplicata di se stessa.",
      );
    }

    if (primarySnapshot.duplicateOfReportId) {
      throw new ReportDuplicateTargetError(
        "La segnalazione principale selezionata e gia un duplicato. Scegli la sua principale.",
      );
    }

    if (!primaryReport.isPublic()) {
      throw new ReportDuplicateTargetError(
        "La segnalazione principale deve essere approvata e pubblica.",
      );
    }

    try {
      duplicateReport.markAsDuplicateOf(
        primarySnapshot.id,
        this.now(),
        primarySnapshot.publicCode,
      );
    } catch (error) {
      if (error instanceof InvalidReportTransitionError) {
        throw new ReportDuplicateTargetError(error.message);
      }

      throw error;
    }

    await this.saveDuplicateLink(
      duplicateReport,
      duplicateReport.pullDomainEvents(),
      duplicateSnapshot.duplicateOfReportId ?? null,
    );
  }

  private async saveDuplicateLink(
    report: NonNullable<
      Awaited<ReturnType<ReportRepository["findByPublicCode"]>>
    >,
    events: ReportDomainEvent[],
    expectedDuplicateOfReportId: string | null,
  ): Promise<void> {
    try {
      await this.dependencies.reportRepository.saveDuplicateLink(
        report,
        events,
        {
          expectedDuplicateOfReportId,
        },
      );
    } catch (error) {
      if (error instanceof ConcurrentReportDuplicateLinkError) {
        throw new ReportDuplicateConflictError();
      }

      throw error;
    }
  }
}

export class RemoveReportDuplicateLinkUseCase {
  private readonly now: () => Date;

  constructor(
    private readonly dependencies: {
      reportRepository: ReportDuplicateRepository;
      now?: () => Date;
    },
  ) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async execute(input: { publicCode: string }): Promise<void> {
    const publicCode = parseDuplicatePublicCode(input.publicCode);
    const report =
      await this.dependencies.reportRepository.findByPublicCode(publicCode);

    if (!report) {
      throw new ReportDuplicateNotFoundError(publicCode.toString());
    }

    const snapshot = report.toSnapshot();

    if (!snapshot.duplicateOfReportId) {
      throw new ReportDuplicateTargetError(
        "La segnalazione non e collegata come duplicato.",
      );
    }

    const primaryReport = await this.dependencies.reportRepository.findById(
      snapshot.duplicateOfReportId,
    );
    report.removeDuplicateLink(
      this.now(),
      snapshot.duplicateOfReportId,
      primaryReport?.toSnapshot().publicCode,
    );

    try {
      await this.dependencies.reportRepository.removeDuplicateLink(
        report,
        report.pullDomainEvents(),
        {
          expectedDuplicateOfReportId: snapshot.duplicateOfReportId,
        },
      );
    } catch (error) {
      if (error instanceof ConcurrentReportDuplicateLinkError) {
        throw new ReportDuplicateConflictError();
      }

      throw error;
    }
  }
}

function parseDuplicatePublicCode(value: string): PublicCode {
  try {
    return PublicCode.create(value.trim().toUpperCase());
  } catch (error) {
    if (error instanceof InvalidPublicCodeError) {
      throw new InvalidDuplicatePublicCodeError(value);
    }

    throw error;
  }
}

function normalizeSearchQuery(query: string | undefined): string {
  return query?.trim().slice(0, 80) ?? "";
}

function normalizeLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) {
    return 8;
  }

  return Math.min(12, Math.max(1, Math.floor(limit ?? 8)));
}

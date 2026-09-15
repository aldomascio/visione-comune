import {
  InvalidPublicCodeError,
  InvalidReportTransitionError,
  PublicCode,
  type ReportDomainEvent
} from "../domain";
import {
  ConcurrentReportStateError,
  type ReportRepository
} from "./report-repository";
import type { ModerationReportDetail } from "./moderate-report";

export const REPORT_RESOLUTION_INTERNAL_NOTE_MAX_LENGTH = 1000;

export class ReportForResolutionNotFoundError extends Error {
  constructor(publicCode: string) {
    super(`Report not found for resolution: ${publicCode}`);
    this.name = "ReportForResolutionNotFoundError";
  }
}

export class InvalidResolutionPublicCodeError extends Error {
  constructor(publicCode: string) {
    super(`Invalid resolution public code: ${publicCode}`);
    this.name = "InvalidResolutionPublicCodeError";
  }
}

export class ReportResolutionNotAllowedError extends Error {
  constructor(message = "La segnalazione puo essere risolta solo dopo essere stata comunicata.") {
    super(message);
    this.name = "ReportResolutionNotAllowedError";
  }
}

export class ReportResolutionConflictError extends Error {
  constructor() {
    super("La segnalazione e stata modificata da un altro amministratore. Aggiorna la pagina.");
    this.name = "ReportResolutionConflictError";
  }
}

export type ResolveReportUseCaseDependencies = {
  reportRepository: ReportRepository;
  now?: () => Date;
};

export class ResolveReportUseCase {
  private readonly now: () => Date;

  constructor(private readonly dependencies: ResolveReportUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async execute(input: { publicCode: string; internalNote?: string }): Promise<ModerationReportDetail> {
    const publicCode = parseResolutionPublicCode(input.publicCode);
    const report = await this.dependencies.reportRepository.findByPublicCode(publicCode);

    if (!report) {
      throw new ReportForResolutionNotFoundError(publicCode.toString());
    }

    try {
      report.markResolved(this.now());
    } catch (error) {
      if (error instanceof InvalidReportTransitionError) {
        throw new ReportResolutionNotAllowedError(mapResolutionTransitionErrorToMessage(error));
      }

      throw error;
    }

    const internalNote = normalizeResolutionInternalNote(input.internalNote);
    const events = report.pullDomainEvents().map((event) => addResolutionNote(event, internalNote));

    try {
      await this.dependencies.reportRepository.save(report, events, {
        expectedModerationStatus: "approved",
        expectedPublicStatus: "communicated"
      });
    } catch (error) {
      if (error instanceof ConcurrentReportStateError) {
        throw new ReportResolutionConflictError();
      }

      throw error;
    }

    return { ...report.toSnapshot(), attachments: [] };
  }
}

function parseResolutionPublicCode(value: string): PublicCode {
  try {
    return PublicCode.create(value.trim().toUpperCase());
  } catch (error) {
    if (error instanceof InvalidPublicCodeError) {
      throw new InvalidResolutionPublicCodeError(value);
    }

    throw error;
  }
}

function normalizeResolutionInternalNote(note: string | undefined): string | undefined {
  const normalized = note?.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return undefined;
  }

  return normalized.slice(0, REPORT_RESOLUTION_INTERNAL_NOTE_MAX_LENGTH);
}

function addResolutionNote(
  event: ReportDomainEvent,
  internalNote: string | undefined
): ReportDomainEvent {
  if (event.type !== "ReportResolved" || !internalNote) {
    return event;
  }

  return {
    ...event,
    metadata: {
      ...event.metadata,
      internalNote
    }
  };
}

function mapResolutionTransitionErrorToMessage(error: InvalidReportTransitionError): string {
  if (error.message.includes("Only communicated reports")) {
    return "La segnalazione puo essere risolta solo quando lo stato pubblico e Comunicata.";
  }

  return "La transizione verso Risolta non e consentita per questa segnalazione.";
}

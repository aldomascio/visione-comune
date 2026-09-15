import { randomUUID } from "node:crypto";
import { InvalidPublicCodeError, PublicCode } from "../../domain";
import type { ReportRepository } from "../report-repository";
import type { ReportConfirmationRepository } from "./report-confirmation-repository";

export class ReportNotConfirmableError extends Error {
  constructor(readonly publicCode: string) {
    super(`Report is not confirmable: ${publicCode}`);
    this.name = "ReportNotConfirmableError";
  }
}

export type ReportConfirmationState = {
  publicCode: string;
  count: number;
  alreadyConfirmed: boolean;
  confirmable: boolean;
};

export type ConfirmReportResult = ReportConfirmationState & {
  created: boolean;
};

export type ReportConfirmationUseCaseDependencies = {
  reportRepository: ReportRepository;
  confirmationRepository: ReportConfirmationRepository;
  now?: () => Date;
  createId?: () => string;
};

export class ConfirmReportUseCase {
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(private readonly dependencies: ReportConfirmationUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.createId = dependencies.createId ?? randomUUID;
  }

  async execute(input: { publicCode: string; antiAbuseKey: string }): Promise<ConfirmReportResult> {
    const report = await findConfirmableReport(this.dependencies.reportRepository, input.publicCode);
    const snapshot = report.toSnapshot();
    const result = await this.dependencies.confirmationRepository.create({
      id: this.createId(),
      reportId: snapshot.id,
      antiAbuseKey: normalizeAntiAbuseKey(input.antiAbuseKey),
      createdAt: this.now()
    });
    const count = await this.dependencies.confirmationRepository.countByReportId(snapshot.id);

    return {
      publicCode: snapshot.publicCode,
      count,
      alreadyConfirmed: true,
      confirmable: true,
      created: result === "created"
    };
  }
}

export class GetReportConfirmationStateUseCase {
  constructor(private readonly dependencies: ReportConfirmationUseCaseDependencies) {}

  async execute(input: { publicCode: string; antiAbuseKey?: string }): Promise<ReportConfirmationState> {
    const report = await findPublicReportForConfirmationState(this.dependencies.reportRepository, input.publicCode);
    const snapshot = report.toSnapshot();
    const count = await this.dependencies.confirmationRepository.countByReportId(snapshot.id);
    const confirmable = !snapshot.duplicateOfReportId;
    const alreadyConfirmed = confirmable && input.antiAbuseKey
      ? await this.dependencies.confirmationRepository.exists({
          reportId: snapshot.id,
          antiAbuseKey: normalizeAntiAbuseKey(input.antiAbuseKey)
        })
      : false;

    return {
      publicCode: snapshot.publicCode,
      count,
      alreadyConfirmed,
      confirmable
    };
  }
}

export class CountReportConfirmationsUseCase {
  constructor(private readonly dependencies: Pick<ReportConfirmationUseCaseDependencies, "reportRepository" | "confirmationRepository">) {}

  async execute(input: { publicCode: string }): Promise<number> {
    const report = await findConfirmableReport(this.dependencies.reportRepository, input.publicCode);
    return this.dependencies.confirmationRepository.countByReportId(report.toSnapshot().id);
  }
}

async function findConfirmableReport(reportRepository: ReportRepository, publicCodeValue: string) {
  let publicCode: PublicCode;

  try {
    publicCode = PublicCode.create(publicCodeValue);
  } catch (error) {
    if (error instanceof InvalidPublicCodeError) {
      throw new ReportNotConfirmableError(publicCodeValue);
    }

    throw error;
  }

  const report = await reportRepository.findByPublicCode(publicCode);

  if (!report?.isPublic() || report.isDuplicate()) {
    throw new ReportNotConfirmableError(publicCode.toString());
  }

  return report;
}

async function findPublicReportForConfirmationState(reportRepository: ReportRepository, publicCodeValue: string) {
  let publicCode: PublicCode;

  try {
    publicCode = PublicCode.create(publicCodeValue);
  } catch (error) {
    if (error instanceof InvalidPublicCodeError) {
      throw new ReportNotConfirmableError(publicCodeValue);
    }

    throw error;
  }

  const report = await reportRepository.findByPublicCode(publicCode);

  if (!report?.isPublic()) {
    throw new ReportNotConfirmableError(publicCode.toString());
  }

  return report;
}

function normalizeAntiAbuseKey(value: string): string {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new Error("Anti-abuse key is required to confirm a report.");
  }

  return normalizedValue;
}

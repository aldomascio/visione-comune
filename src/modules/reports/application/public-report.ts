import { InvalidPublicCodeError, PublicCode } from "../domain";
import type {
  PublicReportDetail,
  PublicReportTimelineEvent,
  ReportRepository
} from "./report-repository";

export type TrackReportResult =
  | { status: "invalid_code" }
  | { status: "not_found" }
  | { status: "pending"; publicCode: string }
  | { status: "rejected"; publicCode: string }
  | { status: "published"; publicCode: string };

export class PublicReportNotFoundError extends Error {
  constructor(publicCode: string) {
    super(`Public report not found: ${publicCode}`);
    this.name = "PublicReportNotFoundError";
  }
}

export type TrackReportByPublicCodeUseCaseDependencies = {
  reportRepository: ReportRepository;
};

export class TrackReportByPublicCodeUseCase {
  constructor(private readonly dependencies: TrackReportByPublicCodeUseCaseDependencies) {}

  async execute(input: { publicCode: string }): Promise<TrackReportResult> {
    const publicCode = parsePublicCode(input.publicCode);

    if (!publicCode) {
      return { status: "invalid_code" };
    }

    const report = await this.dependencies.reportRepository.findByPublicCode(publicCode);

    if (!report) {
      return { status: "not_found" };
    }

    const snapshot = report.toSnapshot();

    if (snapshot.moderationStatus === "pending_review") {
      return { status: "pending", publicCode: snapshot.publicCode };
    }

    if (snapshot.moderationStatus === "rejected") {
      return { status: "rejected", publicCode: snapshot.publicCode };
    }

    if (snapshot.moderationStatus === "approved" && snapshot.publicStatus) {
      return { status: "published", publicCode: snapshot.publicCode };
    }

    return { status: "not_found" };
  }
}

export type GetPublicReportUseCaseDependencies = {
  reportRepository: ReportRepository;
};

export class GetPublicReportUseCase {
  constructor(private readonly dependencies: GetPublicReportUseCaseDependencies) {}

  async execute(input: { publicCode: string }): Promise<PublicReportDetail> {
    const publicCode = parsePublicCode(input.publicCode);

    if (!publicCode) {
      throw new PublicReportNotFoundError(input.publicCode);
    }

    const report = await this.dependencies.reportRepository.findPublicByPublicCode(publicCode);

    if (!report) {
      throw new PublicReportNotFoundError(publicCode.toString());
    }

    return report;
  }
}

export type GetPublicReportTimelineUseCaseDependencies = {
  reportRepository: ReportRepository;
};

export class GetPublicReportTimelineUseCase {
  constructor(private readonly dependencies: GetPublicReportTimelineUseCaseDependencies) {}

  async execute(input: { publicCode: string }): Promise<PublicReportTimelineEvent[]> {
    const publicCode = parsePublicCode(input.publicCode);

    if (!publicCode) {
      return [];
    }

    return this.dependencies.reportRepository.listPublicEventsByPublicCode(publicCode);
  }
}

function parsePublicCode(value: string): PublicCode | null {
  try {
    return PublicCode.create(value);
  } catch (error) {
    if (error instanceof InvalidPublicCodeError) {
      return null;
    }

    throw error;
  }
}

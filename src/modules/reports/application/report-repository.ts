import type { ModerationStatus, Report, ReportDomainEvent, PublicCode } from "../domain";

export class DuplicatePublicCodePersistenceError extends Error {
  constructor(publicCode: string) {
    super(`Report public code already exists: ${publicCode}`);
    this.name = "DuplicatePublicCodePersistenceError";
  }
}

export class ConcurrentReportModerationError extends Error {
  constructor(reportId: string) {
    super(`Report moderation state changed before save: ${reportId}`);
    this.name = "ConcurrentReportModerationError";
  }
}

export type ReportSaveOptions = {
  expectedModerationStatus?: ModerationStatus;
};

export type ReportModerationFilter = ModerationStatus | "all";

export type ReportModerationSummary = {
  publicCode: string;
  title: string;
  categoryName: string;
  createdAt: Date;
  moderationStatus: ModerationStatus;
  address?: string;
};

export type ReportRepository = {
  save(report: Report, events?: ReportDomainEvent[], options?: ReportSaveOptions): Promise<void>;
  findByPublicCode(publicCode: PublicCode): Promise<Report | null>;
  listForModeration(input?: {
    status?: ReportModerationFilter;
    limit?: number;
  }): Promise<ReportModerationSummary[]>;
  countByModerationStatus(status: ModerationStatus): Promise<number>;
};

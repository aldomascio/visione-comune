import type { ModerationStatus, PublicReportStatus, Report, ReportDomainEvent, PublicCode } from "../domain";

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

export type PublicReportDetail = {
  publicCode: string;
  title: string;
  description: string;
  categoryName: string;
  address?: string;
  latitude: number;
  longitude: number;
  publicStatus: PublicReportStatus;
  createdAt: Date;
  publishedAt: Date;
};

export type PublicReportTimelineEvent = {
  type: ReportDomainEvent["type"];
  publicStatus?: PublicReportStatus;
  occurredAt: Date;
};

export type PublicReportMapItem = {
  publicCode: string;
  title: string;
  categoryName: string;
  latitude: number;
  longitude: number;
  address?: string;
  publicStatus: PublicReportStatus;
  publishedAt: Date;
};

export type ReportRepository = {
  save(report: Report, events?: ReportDomainEvent[], options?: ReportSaveOptions): Promise<void>;
  findByPublicCode(publicCode: PublicCode): Promise<Report | null>;
  listForModeration(input?: {
    status?: ReportModerationFilter;
    limit?: number;
  }): Promise<ReportModerationSummary[]>;
  countByModerationStatus(status: ModerationStatus): Promise<number>;
  findPublicByPublicCode(publicCode: PublicCode): Promise<PublicReportDetail | null>;
  listPublicForMap(): Promise<PublicReportMapItem[]>;
  listPublicEventsByPublicCode(publicCode: PublicCode): Promise<PublicReportTimelineEvent[]>;
};

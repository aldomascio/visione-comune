import type {
  ModerationStatus,
  PublicReportStatus,
  Report,
  ReportDomainEvent,
  PublicCode,
  ReportSource,
} from "../domain";

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

export class ConcurrentReportStateError extends Error {
  constructor(reportId: string) {
    super(`Report state changed before save: ${reportId}`);
    this.name = "ConcurrentReportStateError";
  }
}

export class ConcurrentReportDuplicateLinkError extends Error {
  constructor(reportId: string) {
    super(`Report duplicate link changed before save: ${reportId}`);
    this.name = "ConcurrentReportDuplicateLinkError";
  }
}

export type ReportSaveOptions = {
  expectedModerationStatus?: ModerationStatus;
  expectedPublicStatus?: PublicReportStatus;
};

export type ReportDuplicateSaveOptions = {
  expectedDuplicateOfReportId: string | null;
};

export type ReportModerationFilter = ModerationStatus | "all";

export type ReportAdminCreator = {
  id: string;
  email: string;
};

export type ReportModerationSummary = {
  publicCode: string;
  title: string;
  categoryName: string;
  createdAt: Date;
  moderationStatus: ModerationStatus;
  publicStatus?: PublicReportStatus;
  source: ReportSource;
  address?: string;
};

export type ReportAttachmentType = "report_photo" | "resolution_photo";

export type ReportAttachmentReviewStatus =
  | "pending_review"
  | "approved"
  | "rejected";

export type ReportAttachment = {
  id: string;
  reportId: string;
  type: ReportAttachmentType;
  storageKey: string;
  mimeType: string;
  size: number;
  reviewStatus: ReportAttachmentReviewStatus;
  reviewedAt?: Date;
  createdAt: Date;
};

export type NewReportAttachment = ReportAttachment;

export type PublicReportAttachment = {
  mimeType: string;
  size: number;
  url: string;
};

export type ModerationReportAttachment = {
  id: string;
  type: ReportAttachmentType;
  reviewStatus: ReportAttachmentReviewStatus;
  mimeType: string;
  size: number;
  createdAt: Date;
  reviewedAt?: Date;
  url: string;
};

export type ReportAttachmentAccess = {
  storageKey: string;
  mimeType: string;
  size: number;
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
  communicatedAt?: Date;
  resolvedAt?: Date;
  duplicateOf?: {
    publicCode: string;
    title: string;
  };
  reportPhoto?: PublicReportAttachment;
  resolutionPhoto?: PublicReportAttachment;
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
  reportPhotoUrl?: string;
  publicStatus: PublicReportStatus;
  publishedAt: Date;
};

export type PotentialPrimaryReport = {
  publicCode: string;
  title: string;
  categoryName: string;
  moderationStatus: ModerationStatus;
  publicStatus?: PublicReportStatus;
  createdAt: Date;
};

export type DuplicateReportSummary = {
  publicCode: string;
  title: string;
  source: ReportSource;
  createdAt: Date;
  moderationStatus: ModerationStatus;
  publicStatus?: PublicReportStatus;
  confirmationsCount: number;
};

export type RecentResolvedPublicReport = {
  publicCode: string;
  title: string;
  categoryName: string;
  resolvedAt: Date;
};

export type PotentialDuplicateReportQuery = {
  categoryId: string;
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
  publishedAfter: Date;
  limit: number;
};

export type PotentialDuplicateReportRecord = {
  publicCode: string;
  title: string;
  categoryName: string;
  latitude: number;
  longitude: number;
  address?: string;
  reportPhotoUrl?: string;
  publicStatus: PublicReportStatus;
  publishedAt: Date;
};

export type ReportRepository = {
  save(
    report: Report,
    events?: ReportDomainEvent[],
    options?: ReportSaveOptions,
  ): Promise<void>;
  saveWithAttachment(
    report: Report,
    attachment: NewReportAttachment,
    events?: ReportDomainEvent[],
  ): Promise<void>;
  saveDuplicateLink?(
    report: Report,
    events: ReportDomainEvent[],
    options: ReportDuplicateSaveOptions,
  ): Promise<void>;
  removeDuplicateLink?(
    report: Report,
    events: ReportDomainEvent[],
    options: ReportDuplicateSaveOptions,
  ): Promise<void>;
  findByPublicCode(publicCode: PublicCode): Promise<Report | null>;
  findById?(reportId: string): Promise<Report | null>;
  findAdminCreatorByReportId?(
    reportId: string,
  ): Promise<ReportAdminCreator | null>;
  saveAttachment?(
    attachment: NewReportAttachment,
    events?: ReportDomainEvent[],
  ): Promise<void>;
  updateAttachmentReview?(
    input: {
      reportId: string;
      attachmentType: ReportAttachmentType;
      reviewStatus: ReportAttachmentReviewStatus;
      reviewedAt: Date;
    },
    events?: ReportDomainEvent[],
  ): Promise<void>;
  findAttachmentByReportAndType?(
    reportId: string,
    type: ReportAttachmentType,
  ): Promise<ReportAttachment | null>;
  listAttachmentsForModeration?(
    publicCode: PublicCode,
  ): Promise<ModerationReportAttachment[]>;
  findAttachmentForModeration(
    publicCode: PublicCode,
    type: ReportAttachmentType,
  ): Promise<ReportAttachmentAccess | null>;
  findPublicAttachmentByPublicCode(
    publicCode: PublicCode,
    type: ReportAttachmentType,
  ): Promise<ReportAttachmentAccess | null>;
  listForModeration(input?: {
    status?: ReportModerationFilter;
    limit?: number;
  }): Promise<ReportModerationSummary[]>;
  searchPotentialPrimaryReports?(input: {
    query: string;
    excludeReportId: string;
    limit: number;
  }): Promise<PotentialPrimaryReport[]>;
  listDuplicatesOfReport?(reportId: string): Promise<DuplicateReportSummary[]>;
  countByModerationStatus(status: ModerationStatus): Promise<number>;
  findPublicByPublicCode(
    publicCode: PublicCode,
  ): Promise<PublicReportDetail | null>;
  listPublicForMap(): Promise<PublicReportMapItem[]>;
  findPotentialDuplicates(
    input: PotentialDuplicateReportQuery,
  ): Promise<PotentialDuplicateReportRecord[]>;
  listPublicEventsByPublicCode(
    publicCode: PublicCode,
  ): Promise<PublicReportTimelineEvent[]>;
};

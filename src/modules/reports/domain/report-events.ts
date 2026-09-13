import type { PublicReportStatus } from "./report-status";

export type ReportEventType =
  | "ReportCreated"
  | "ReportApproved"
  | "ReportRejected"
  | "ReportCommunicated"
  | "ReportResolved";

export type ReportEventVisibility = "public" | "internal";

export type ReportDomainEvent = {
  type: ReportEventType;
  reportId: string;
  occurredAt: Date;
  visibility: ReportEventVisibility;
  publicStatus?: PublicReportStatus;
};


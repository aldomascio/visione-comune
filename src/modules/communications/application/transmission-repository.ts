import type { Report, ReportDomainEvent } from "@/modules/reports/domain";
import type { OutboundCommunicationChannel, OutboundCommunicationStatus } from "./communication-repository";

export type Transmission = {
  id: string;
  primaryReportId: string;
  reportIds: string[];
  reportCount: number;
  recipientId?: string;
  recipientNameSnapshot: string;
  recipientOrganizationSnapshot: string;
  recipientAddressSnapshot: string;
  channel: OutboundCommunicationChannel;
  subject: string;
  body: string;
  status: OutboundCommunicationStatus;
  externalMessageId?: string;
  createdAt: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
};

export type NewTransmission = Omit<Transmission, "reportCount">;

export type TransmissionListFilters = {
  status?: OutboundCommunicationStatus;
  recipientId?: string;
};

export type EligibleTransmissionReport = {
  id: string;
  publicCode: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  address?: string;
  publishedAt: Date;
  createdAt: Date;
};

export type TransmissionReportSummary = EligibleTransmissionReport & {
  publicStatus: "reported" | "communicated" | "resolved";
};

export type TransmissionRepository = {
  createTransmission(transmission: NewTransmission, events?: ReportDomainEvent[]): Promise<Transmission>;
  findTransmissionById(transmissionId: string): Promise<Transmission | null>;
  listTransmissions(filters?: TransmissionListFilters): Promise<Transmission[]>;
  listTransmissionsByReportId(reportId: string): Promise<Transmission[]>;
  listEligibleReportsForRecipient(recipientId: string, limit?: number): Promise<EligibleTransmissionReport[]>;
  listTransmissionReports(transmissionId: string): Promise<TransmissionReportSummary[]>;
  addReportToTransmission(transmissionId: string, reportId: string, events?: ReportDomainEvent[]): Promise<void>;
  removeReportFromTransmission(transmissionId: string, reportId: string, events?: ReportDomainEvent[]): Promise<void>;
  saveTransmissionStatusWithReports(transmission: Transmission, reports: Report[], events?: ReportDomainEvent[]): Promise<Transmission>;
};

import type { Report, ReportDomainEvent } from "@/modules/reports/domain";

export const OUTBOUND_COMMUNICATION_CHANNELS = ["email", "pec"] as const;
export const OUTBOUND_COMMUNICATION_STATUSES = ["draft", "sent", "delivered", "failed"] as const;

export type OutboundCommunicationChannel = (typeof OUTBOUND_COMMUNICATION_CHANNELS)[number];
export type OutboundCommunicationStatus = (typeof OUTBOUND_COMMUNICATION_STATUSES)[number];

export type OutboundCommunication = {
  id: string;
  reportId: string;
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

export type NewOutboundCommunication = OutboundCommunication;

export type OutboundCommunicationRepository = {
  create(communication: NewOutboundCommunication, events?: ReportDomainEvent[]): Promise<OutboundCommunication>;
  findById(communicationId: string): Promise<OutboundCommunication | null>;
  listByReportId(reportId: string): Promise<OutboundCommunication[]>;
  saveFailure(communication: OutboundCommunication, events?: ReportDomainEvent[]): Promise<OutboundCommunication>;
  saveDeliveryWithReport(
    communication: OutboundCommunication,
    report: Report,
    events?: ReportDomainEvent[]
  ): Promise<OutboundCommunication>;
};

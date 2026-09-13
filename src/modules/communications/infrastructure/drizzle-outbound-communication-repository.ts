import { asc, eq } from "drizzle-orm";
import type { Database } from "@/shared/db/client";
import { outboundCommunications, reportEvents, reports } from "@/shared/db/schema";
import { reportEventToRecord, reportToRecord } from "@/modules/reports/infrastructure/report-mapper";
import type { Report, ReportDomainEvent } from "@/modules/reports/domain";
import type {
  NewOutboundCommunication,
  OutboundCommunication,
  OutboundCommunicationRepository
} from "../application/communication-repository";

export class DrizzleOutboundCommunicationRepository implements OutboundCommunicationRepository {
  constructor(private readonly db: Database) {}

  async create(
    communication: NewOutboundCommunication,
    events: ReportDomainEvent[] = []
  ): Promise<OutboundCommunication> {
    return this.db.transaction(async (tx) => {
      const [createdCommunication] = await tx
        .insert(outboundCommunications)
        .values(toOutboundCommunicationRecord(communication))
        .returning();

      if (!createdCommunication) {
        throw new Error("Outbound communication insert did not return a row.");
      }

      if (events.length > 0) {
        await tx.insert(reportEvents).values(events.map(reportEventToRecord));
      }

      return toOutboundCommunication(createdCommunication);
    });
  }

  async findById(communicationId: string): Promise<OutboundCommunication | null> {
    const [communication] = await this.db
      .select()
      .from(outboundCommunications)
      .where(eq(outboundCommunications.id, communicationId))
      .limit(1);

    return communication ? toOutboundCommunication(communication) : null;
  }

  async listByReportId(reportId: string): Promise<OutboundCommunication[]> {
    const rows = await this.db
      .select()
      .from(outboundCommunications)
      .where(eq(outboundCommunications.reportId, reportId))
      .orderBy(asc(outboundCommunications.createdAt), asc(outboundCommunications.id));

    return rows.map(toOutboundCommunication);
  }

  async saveFailure(
    communication: OutboundCommunication,
    events: ReportDomainEvent[] = []
  ): Promise<OutboundCommunication> {
    return this.db.transaction(async (tx) => {
      const [updatedCommunication] = await tx
        .update(outboundCommunications)
        .set(toOutboundCommunicationUpdate(communication))
        .where(eq(outboundCommunications.id, communication.id))
        .returning();

      if (!updatedCommunication) {
        throw new Error("Outbound communication update did not return a row.");
      }

      if (events.length > 0) {
        await tx.insert(reportEvents).values(events.map(reportEventToRecord));
      }

      return toOutboundCommunication(updatedCommunication);
    });
  }

  async saveDeliveryWithReport(
    communication: OutboundCommunication,
    report: Report,
    events: ReportDomainEvent[] = []
  ): Promise<OutboundCommunication> {
    return this.db.transaction(async (tx) => {
      const [updatedCommunication] = await tx
        .update(outboundCommunications)
        .set(toOutboundCommunicationUpdate(communication))
        .where(eq(outboundCommunications.id, communication.id))
        .returning();

      if (!updatedCommunication) {
        throw new Error("Outbound communication update did not return a row.");
      }

      await tx
        .update(reports)
        .set(reportToRecord(report))
        .where(eq(reports.id, communication.reportId));

      if (events.length > 0) {
        await tx.insert(reportEvents).values(events.map(reportEventToRecord));
      }

      return toOutboundCommunication(updatedCommunication);
    });
  }
}

function toOutboundCommunicationRecord(communication: NewOutboundCommunication) {
  return {
    id: communication.id,
    reportId: communication.reportId,
    recipientId: communication.recipientId ?? null,
    recipientNameSnapshot: communication.recipientNameSnapshot,
    recipientOrganizationSnapshot: communication.recipientOrganizationSnapshot,
    recipientAddressSnapshot: communication.recipientAddressSnapshot,
    channel: communication.channel,
    subject: communication.subject,
    body: communication.body,
    status: communication.status,
    externalMessageId: communication.externalMessageId ?? null,
    createdAt: communication.createdAt,
    sentAt: communication.sentAt ?? null,
    deliveredAt: communication.deliveredAt ?? null,
    failedAt: communication.failedAt ?? null
  };
}

function toOutboundCommunicationUpdate(communication: OutboundCommunication) {
  return {
    recipientId: communication.recipientId ?? null,
    recipientNameSnapshot: communication.recipientNameSnapshot,
    recipientOrganizationSnapshot: communication.recipientOrganizationSnapshot,
    recipientAddressSnapshot: communication.recipientAddressSnapshot,
    channel: communication.channel,
    subject: communication.subject,
    body: communication.body,
    status: communication.status,
    externalMessageId: communication.externalMessageId ?? null,
    sentAt: communication.sentAt ?? null,
    deliveredAt: communication.deliveredAt ?? null,
    failedAt: communication.failedAt ?? null
  };
}

function toOutboundCommunication(record: {
  id: string;
  reportId: string;
  recipientId: string | null;
  recipientNameSnapshot: string;
  recipientOrganizationSnapshot: string;
  recipientAddressSnapshot: string;
  channel: OutboundCommunication["channel"];
  subject: string;
  body: string;
  status: OutboundCommunication["status"];
  externalMessageId: string | null;
  createdAt: Date;
  sentAt: Date | null;
  deliveredAt: Date | null;
  failedAt: Date | null;
}): OutboundCommunication {
  return {
    id: record.id,
    reportId: record.reportId,
    ...(record.recipientId ? { recipientId: record.recipientId } : {}),
    recipientNameSnapshot: record.recipientNameSnapshot,
    recipientOrganizationSnapshot: record.recipientOrganizationSnapshot,
    recipientAddressSnapshot: record.recipientAddressSnapshot,
    channel: record.channel,
    subject: record.subject,
    body: record.body,
    status: record.status,
    ...(record.externalMessageId ? { externalMessageId: record.externalMessageId } : {}),
    createdAt: record.createdAt,
    ...(record.sentAt ? { sentAt: record.sentAt } : {}),
    ...(record.deliveredAt ? { deliveredAt: record.deliveredAt } : {}),
    ...(record.failedAt ? { failedAt: record.failedAt } : {})
  };
}

import { and, asc, eq, sql } from "drizzle-orm";
import type { Database } from "@/shared/db/client";
import { categories, categoryRecipients, outboundCommunications, recipients, reportEvents, reports, transmissionReports } from "@/shared/db/schema";
import { reportEventToRecord, reportToRecord } from "@/modules/reports/infrastructure/report-mapper";
import type { Report, ReportDomainEvent } from "@/modules/reports/domain";
import type {
  NewOutboundCommunication,
  OutboundCommunication,
  OutboundCommunicationRepository
} from "../application/communication-repository";
import type {
  EligibleTransmissionReport,
  NewTransmission,
  Transmission,
  TransmissionListFilters,
  TransmissionReportSummary,
  TransmissionRepository
} from "../application/transmission-repository";

export class DrizzleOutboundCommunicationRepository implements OutboundCommunicationRepository, TransmissionRepository {
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

      await tx.insert(transmissionReports).values({
        transmissionId: communication.id,
        reportId: communication.reportId,
        createdAt: communication.createdAt
      }).onConflictDoNothing();

      if (events.length > 0) {
        await tx.insert(reportEvents).values(events.map(reportEventToRecord));
      }

      return toOutboundCommunication(createdCommunication);
    });
  }

  async createTransmission(
    transmission: NewTransmission,
    events: ReportDomainEvent[] = []
  ): Promise<Transmission> {
    return this.db.transaction(async (tx) => {
      const [createdTransmission] = await tx
        .insert(outboundCommunications)
        .values(toOutboundCommunicationRecord(transmissionToOutboundCommunication(transmission)))
        .returning();

      if (!createdTransmission) {
        throw new Error("Transmission insert did not return a row.");
      }

      await tx.insert(transmissionReports).values(transmission.reportIds.map((reportId) => ({
        transmissionId: transmission.id,
        reportId,
        createdAt: transmission.createdAt
      }))).onConflictDoNothing();

      if (events.length > 0) {
        await tx.insert(reportEvents).values(events.map(reportEventToRecord));
      }

      return toTransmission(createdTransmission, transmission.reportIds);
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

  async findTransmissionById(transmissionId: string): Promise<Transmission | null> {
    const [communication] = await this.db
      .select()
      .from(outboundCommunications)
      .where(eq(outboundCommunications.id, transmissionId))
      .limit(1);

    if (!communication) return null;

    const reportIds = await this.getTransmissionReportIds(transmissionId);
    return toTransmission(communication, reportIds);
  }

  async listByReportId(reportId: string): Promise<OutboundCommunication[]> {
    const rows = await this.db
      .select({ communication: outboundCommunications })
      .from(transmissionReports)
      .innerJoin(outboundCommunications, eq(transmissionReports.transmissionId, outboundCommunications.id))
      .where(eq(transmissionReports.reportId, reportId))
      .orderBy(asc(outboundCommunications.createdAt), asc(outboundCommunications.id));

    return rows.map((row) => toOutboundCommunication(row.communication));
  }

  async listTransmissionsByReportId(reportId: string): Promise<Transmission[]> {
    const rows = await this.db
      .select({ communication: outboundCommunications })
      .from(transmissionReports)
      .innerJoin(outboundCommunications, eq(transmissionReports.transmissionId, outboundCommunications.id))
      .where(eq(transmissionReports.reportId, reportId))
      .orderBy(asc(outboundCommunications.createdAt), asc(outboundCommunications.id));

    return Promise.all(rows.map(async (row) => toTransmission(row.communication, await this.getTransmissionReportIds(row.communication.id))));
  }

  async listTransmissions(filters: TransmissionListFilters = {}): Promise<Transmission[]> {
    const conditions = [];
    if (filters.status) conditions.push(eq(outboundCommunications.status, filters.status));
    if (filters.recipientId) conditions.push(eq(outboundCommunications.recipientId, filters.recipientId));

    const query = this.db
      .select()
      .from(outboundCommunications)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(outboundCommunications.createdAt), asc(outboundCommunications.id));

    const rows = await query;
    return Promise.all(rows.map(async (row) => toTransmission(row, await this.getTransmissionReportIds(row.id))));
  }

  async listEligibleReportsForRecipient(recipientId: string, limit = 50): Promise<EligibleTransmissionReport[]> {
    const rows = await this.db
      .select({
        id: reports.id,
        publicCode: reports.publicCode,
        title: reports.title,
        description: reports.description,
        categoryId: reports.categoryId,
        categoryName: categories.name,
        address: reports.address,
        publishedAt: reports.publishedAt,
        createdAt: reports.createdAt
      })
      .from(reports)
      .innerJoin(categories, eq(reports.categoryId, categories.id))
      .innerJoin(categoryRecipients, eq(categoryRecipients.categoryId, reports.categoryId))
      .innerJoin(recipients, eq(categoryRecipients.recipientId, recipients.id))
      .where(sql`${categoryRecipients.recipientId} = ${recipientId}
        and ${recipients.active} = true
        and ${reports.moderationStatus} = 'approved'
        and ${reports.publicStatus} = 'reported'
        and ${reports.duplicateOfReportId} is null
        and ${reports.publishedAt} is not null`)
      .orderBy(asc(reports.publishedAt), asc(reports.publicCode))
      .limit(limit);

    return rows.flatMap((row) => row.publishedAt ? [{
      id: row.id,
      publicCode: row.publicCode,
      title: row.title,
      description: row.description,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      ...(row.address ? { address: row.address } : {}),
      publishedAt: row.publishedAt,
      createdAt: row.createdAt
    }] : []);
  }

  async listTransmissionReports(transmissionId: string): Promise<TransmissionReportSummary[]> {
    const rows = await this.db
      .select({
        id: reports.id,
        publicCode: reports.publicCode,
        title: reports.title,
        description: reports.description,
        categoryId: reports.categoryId,
        categoryName: categories.name,
        address: reports.address,
        publishedAt: reports.publishedAt,
        createdAt: reports.createdAt,
        publicStatus: reports.publicStatus
      })
      .from(transmissionReports)
      .innerJoin(reports, eq(transmissionReports.reportId, reports.id))
      .innerJoin(categories, eq(reports.categoryId, categories.id))
      .where(eq(transmissionReports.transmissionId, transmissionId))
      .orderBy(asc(transmissionReports.createdAt), asc(reports.publicCode));

    return rows.flatMap((row) => {
      if (!row.publishedAt || !row.publicStatus) return [];
      return [{
        id: row.id,
        publicCode: row.publicCode,
        title: row.title,
        description: row.description,
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        ...(row.address ? { address: row.address } : {}),
        publishedAt: row.publishedAt,
        createdAt: row.createdAt,
        publicStatus: row.publicStatus
      }];
    });
  }

  async addReportToTransmission(transmissionId: string, reportId: string, events: ReportDomainEvent[] = []): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(transmissionReports).values({ transmissionId, reportId }).onConflictDoNothing();
      if (events.length > 0) await tx.insert(reportEvents).values(events.map(reportEventToRecord));
    });
  }

  async removeReportFromTransmission(transmissionId: string, reportId: string, events: ReportDomainEvent[] = []): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(transmissionReports).where(and(
        eq(transmissionReports.transmissionId, transmissionId),
        eq(transmissionReports.reportId, reportId)
      ));
      if (events.length > 0) await tx.insert(reportEvents).values(events.map(reportEventToRecord));
    });
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

  async saveTransmissionStatusWithReports(
    transmission: Transmission,
    changedReports: Report[],
    events: ReportDomainEvent[] = []
  ): Promise<Transmission> {
    return this.db.transaction(async (tx) => {
      const [updatedTransmission] = await tx
        .update(outboundCommunications)
        .set(toOutboundCommunicationUpdate(transmissionToOutboundCommunication(transmission)))
        .where(eq(outboundCommunications.id, transmission.id))
        .returning();

      if (!updatedTransmission) {
        throw new Error("Transmission update did not return a row.");
      }

      for (const report of changedReports) {
        const record = reportToRecord(report);
        await tx.update(reports).set(record).where(eq(reports.id, record.id));
      }

      if (events.length > 0) {
        await tx.insert(reportEvents).values(events.map(reportEventToRecord));
      }

      return toTransmission(updatedTransmission, await this.getTransmissionReportIds(transmission.id));
    });
  }

  private async getTransmissionReportIds(transmissionId: string): Promise<string[]> {
    const rows = await this.db
      .select({ reportId: transmissionReports.reportId })
      .from(transmissionReports)
      .where(eq(transmissionReports.transmissionId, transmissionId))
      .orderBy(asc(transmissionReports.createdAt), asc(transmissionReports.reportId));

    return rows.map((row) => row.reportId);
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

function toTransmission(record: Parameters<typeof toOutboundCommunication>[0], reportIds: string[]): Transmission {
  const communication = toOutboundCommunication(record);
  const normalizedReportIds = reportIds.length > 0 ? reportIds : [communication.reportId];

  return {
    id: communication.id,
    primaryReportId: communication.reportId,
    reportIds: normalizedReportIds,
    reportCount: normalizedReportIds.length,
    ...(communication.recipientId ? { recipientId: communication.recipientId } : {}),
    recipientNameSnapshot: communication.recipientNameSnapshot,
    recipientOrganizationSnapshot: communication.recipientOrganizationSnapshot,
    recipientAddressSnapshot: communication.recipientAddressSnapshot,
    channel: communication.channel,
    subject: communication.subject,
    body: communication.body,
    status: communication.status,
    ...(communication.externalMessageId ? { externalMessageId: communication.externalMessageId } : {}),
    createdAt: communication.createdAt,
    ...(communication.sentAt ? { sentAt: communication.sentAt } : {}),
    ...(communication.deliveredAt ? { deliveredAt: communication.deliveredAt } : {}),
    ...(communication.failedAt ? { failedAt: communication.failedAt } : {})
  };
}

function transmissionToOutboundCommunication(transmission: NewTransmission | Transmission): OutboundCommunication {
  return {
    id: transmission.id,
    reportId: transmission.primaryReportId,
    ...(transmission.recipientId ? { recipientId: transmission.recipientId } : {}),
    recipientNameSnapshot: transmission.recipientNameSnapshot,
    recipientOrganizationSnapshot: transmission.recipientOrganizationSnapshot,
    recipientAddressSnapshot: transmission.recipientAddressSnapshot,
    channel: transmission.channel,
    subject: transmission.subject,
    body: transmission.body,
    status: transmission.status,
    ...(transmission.externalMessageId ? { externalMessageId: transmission.externalMessageId } : {}),
    createdAt: transmission.createdAt,
    ...(transmission.sentAt ? { sentAt: transmission.sentAt } : {}),
    ...(transmission.deliveredAt ? { deliveredAt: transmission.deliveredAt } : {}),
    ...(transmission.failedAt ? { failedAt: transmission.failedAt } : {})
  };
}

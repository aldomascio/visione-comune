import { and, asc, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import type { Database } from "@/shared/db/client";
import { adminUsers, categories, reportAttachments, reportEvents, reports } from "@/shared/db/schema";
import {
  ConcurrentReportModerationError,
  ConcurrentReportStateError,
  DuplicatePublicCodePersistenceError,
  type ReportModerationFilter,
  type NewReportAttachment,
  type PublicReportDetail,
  type PublicReportMapItem,
  type RecentResolvedPublicReport,
  type ReportAttachmentAccess,
  type PublicReportTimelineEvent,
  type PotentialDuplicateReportQuery,
  type PotentialDuplicateReportRecord,
  type ReportModerationSummary,
  type ReportRepository,
  type ReportSaveOptions
} from "../application/report-repository";
import type { ReportTimelineEvent } from "../application/report-timeline";
import { PublicCode, type ModerationStatus, type Report, type ReportDomainEvent } from "../domain";
import { recordToReport, reportEventToRecord, reportToRecord } from "./report-mapper";

export class DrizzleReportRepository implements ReportRepository {
  constructor(private readonly db: Database) {}

  async save(
    report: Report,
    events: ReportDomainEvent[] = [],
    options: ReportSaveOptions = {}
  ): Promise<void> {
    try {
      await this.db.transaction(async (tx) => {
        const record = reportToRecord(report);

        if (options.expectedModerationStatus || options.expectedPublicStatus) {
          const conditions = [eq(reports.id, record.id)];

          if (options.expectedModerationStatus) {
            conditions.push(eq(reports.moderationStatus, options.expectedModerationStatus));
          }

          if (options.expectedPublicStatus) {
            conditions.push(eq(reports.publicStatus, options.expectedPublicStatus));
          }

          const updatedRows = await tx
            .update(reports)
            .set(record)
            .where(and(...conditions))
            .returning({ id: reports.id });

          if (updatedRows.length === 0) {
            if (options.expectedPublicStatus) {
              throw new ConcurrentReportStateError(record.id);
            }

            throw new ConcurrentReportModerationError(record.id);
          }
        } else {
          await tx
            .insert(reports)
            .values(record)
            .onConflictDoUpdate({
              target: reports.id,
              set: record
            });
        }

        if (events.length > 0) {
          await tx.insert(reportEvents).values(events.map(reportEventToRecord));
        }
      });
    } catch (error) {
      if (isPublicCodeUniqueViolation(error)) {
        throw new DuplicatePublicCodePersistenceError(report.toSnapshot().publicCode);
      }

      throw error;
    }
  }


  async saveWithAttachment(
    report: Report,
    attachment: NewReportAttachment,
    events: ReportDomainEvent[] = []
  ): Promise<void> {
    try {
      await this.db.transaction(async (tx) => {
        const record = reportToRecord(report);
        await tx.insert(reports).values(record);

        if (events.length > 0) {
          await tx.insert(reportEvents).values(events.map(reportEventToRecord));
        }

        await tx.insert(reportAttachments).values({
          id: attachment.id,
          reportId: attachment.reportId,
          type: attachment.type,
          storageKey: attachment.storageKey,
          mimeType: attachment.mimeType,
          size: attachment.size,
          createdAt: attachment.createdAt
        });
      });
    } catch (error) {
      if (isPublicCodeUniqueViolation(error)) {
        throw new DuplicatePublicCodePersistenceError(report.toSnapshot().publicCode);
      }

      throw error;
    }
  }

  async findByPublicCode(publicCode: PublicCode): Promise<Report | null> {
    const [record] = await this.db
      .select()
      .from(reports)
      .where(eq(reports.publicCode, publicCode.toString()))
      .limit(1);

    return record ? recordToReport(record) : null;
  }

  async findAdminCreatorByReportId(reportId: string) {
    const [row] = await this.db
      .select({
        id: adminUsers.id,
        email: adminUsers.email
      })
      .from(reports)
      .innerJoin(adminUsers, eq(reports.createdByAdminId, adminUsers.id))
      .where(eq(reports.id, reportId))
      .limit(1);

    return row ?? null;
  }

  async findById(reportId: string): Promise<Report | null> {
    const [record] = await this.db
      .select()
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);

    return record ? recordToReport(record) : null;
  }


  async findAttachmentForModeration(publicCode: PublicCode): Promise<ReportAttachmentAccess | null> {
    const [row] = await this.db
      .select({
        storageKey: reportAttachments.storageKey,
        mimeType: reportAttachments.mimeType,
        size: reportAttachments.size
      })
      .from(reportAttachments)
      .innerJoin(reports, eq(reportAttachments.reportId, reports.id))
      .where(eq(reports.publicCode, publicCode.toString()))
      .limit(1);

    return row ?? null;
  }

  async findPublicAttachmentByPublicCode(publicCode: PublicCode): Promise<ReportAttachmentAccess | null> {
    const [row] = await this.db
      .select({
        storageKey: reportAttachments.storageKey,
        mimeType: reportAttachments.mimeType,
        size: reportAttachments.size
      })
      .from(reportAttachments)
      .innerJoin(reports, eq(reportAttachments.reportId, reports.id))
      .where(
        and(
          eq(reports.publicCode, publicCode.toString()),
          eq(reports.moderationStatus, "approved"),
          isNotNull(reports.publicStatus),
          isNotNull(reports.publishedAt)
        )
      )
      .limit(1);

    return row ?? null;
  }

  async listForModeration(input: {
    status?: ReportModerationFilter;
    limit?: number;
  } = {}): Promise<ReportModerationSummary[]> {
    const status = input.status ?? "pending_review";
    const limit = input.limit ?? 50;
    const whereClause = status === "all" ? undefined : eq(reports.moderationStatus, status);

    const query = this.db
      .select({
        publicCode: reports.publicCode,
        title: reports.title,
        categoryName: categories.name,
        createdAt: reports.createdAt,
        moderationStatus: reports.moderationStatus,
        source: reports.source,
        address: reports.address
      })
      .from(reports)
      .innerJoin(categories, eq(reports.categoryId, categories.id))
      .orderBy(desc(reports.createdAt))
      .limit(limit);

    const rows = whereClause ? await query.where(whereClause) : await query;

    return rows.map((row) => ({
      publicCode: row.publicCode,
      title: row.title,
      categoryName: row.categoryName,
      createdAt: row.createdAt,
      moderationStatus: row.moderationStatus,
      source: row.source,
      ...(row.address ? { address: row.address } : {})
    }));
  }

  async findPublicByPublicCode(publicCode: PublicCode): Promise<PublicReportDetail | null> {
    const [row] = await this.db
      .select({
        publicCode: reports.publicCode,
        title: reports.title,
        description: reports.description,
        categoryName: categories.name,
        address: reports.address,
        latitude: reports.latitude,
        longitude: reports.longitude,
        publicStatus: reports.publicStatus,
        createdAt: reports.createdAt,
        publishedAt: reports.publishedAt,
        communicatedAt: reports.communicatedAt,
        resolvedAt: reports.resolvedAt,
        attachmentStorageKey: reportAttachments.storageKey,
        attachmentMimeType: reportAttachments.mimeType,
        attachmentSize: reportAttachments.size
      })
      .from(reports)
      .innerJoin(categories, eq(reports.categoryId, categories.id))
      .leftJoin(reportAttachments, eq(reportAttachments.reportId, reports.id))
      .where(
        and(
          eq(reports.publicCode, publicCode.toString()),
          eq(reports.moderationStatus, "approved")
        )
      )
      .limit(1);

    if (!row?.publicStatus || !row.publishedAt) {
      return null;
    }

    return {
      publicCode: row.publicCode,
      title: row.title,
      description: row.description,
      categoryName: row.categoryName,
      ...(row.address ? { address: row.address } : {}),
      latitude: row.latitude,
      longitude: row.longitude,
      publicStatus: row.publicStatus,
      createdAt: row.createdAt,
      publishedAt: row.publishedAt,
      ...(row.communicatedAt ? { communicatedAt: row.communicatedAt } : {}),
      ...(row.resolvedAt ? { resolvedAt: row.resolvedAt } : {}),
      ...(row.attachmentStorageKey && row.attachmentMimeType && row.attachmentSize
        ? {
            attachment: {
              mimeType: row.attachmentMimeType,
              size: row.attachmentSize,
              url: `/api/report-images/${row.publicCode}`
            }
          }
        : {})
    };
  }


  async listPublicForMap(): Promise<PublicReportMapItem[]> {
    const rows = await this.db
      .select({
        publicCode: reports.publicCode,
        title: reports.title,
        categoryName: categories.name,
        latitude: reports.latitude,
        longitude: reports.longitude,
        address: reports.address,
        publicStatus: reports.publicStatus,
        publishedAt: reports.publishedAt,
        attachmentStorageKey: reportAttachments.storageKey,
        attachmentMimeType: reportAttachments.mimeType,
        attachmentSize: reportAttachments.size
      })
      .from(reports)
      .innerJoin(categories, eq(reports.categoryId, categories.id))
      .leftJoin(reportAttachments, eq(reportAttachments.reportId, reports.id))
      .where(
        and(
          eq(reports.moderationStatus, "approved"),
          isNotNull(reports.publicStatus),
          isNotNull(reports.publishedAt)
        )
      )
      .orderBy(desc(reports.publishedAt), desc(reports.createdAt));

    return rows.flatMap((row) => {
      if (!row.publicStatus || !row.publishedAt) {
        return [];
      }

      return [
        {
          publicCode: row.publicCode,
          title: row.title,
          categoryName: row.categoryName,
          latitude: row.latitude,
          longitude: row.longitude,
          ...(row.address ? { address: row.address } : {}),
          publicStatus: row.publicStatus,
          publishedAt: row.publishedAt
        }
      ];
    });
  }


  async listRecentlyResolvedPublic(limit: number): Promise<RecentResolvedPublicReport[]> {
    const rows = await this.db
      .select({
        publicCode: reports.publicCode,
        title: reports.title,
        categoryName: categories.name,
        resolvedAt: reports.resolvedAt
      })
      .from(reports)
      .innerJoin(categories, eq(reports.categoryId, categories.id))
      .where(
        and(
          eq(reports.moderationStatus, "approved"),
          eq(reports.publicStatus, "resolved"),
          isNotNull(reports.publishedAt),
          isNotNull(reports.resolvedAt)
        )
      )
      .orderBy(desc(reports.resolvedAt), desc(reports.createdAt))
      .limit(limit);

    return rows.flatMap((row) => {
      if (!row.resolvedAt) {
        return [];
      }

      return [
        {
          publicCode: row.publicCode,
          title: row.title,
          categoryName: row.categoryName,
          resolvedAt: row.resolvedAt
        }
      ];
    });
  }


  async findPotentialDuplicates(
    input: PotentialDuplicateReportQuery
  ): Promise<PotentialDuplicateReportRecord[]> {
    const rows = await this.db
      .select({
        publicCode: reports.publicCode,
        title: reports.title,
        categoryName: categories.name,
        latitude: reports.latitude,
        longitude: reports.longitude,
        address: reports.address,
        publicStatus: reports.publicStatus,
        publishedAt: reports.publishedAt
      })
      .from(reports)
      .innerJoin(categories, eq(reports.categoryId, categories.id))
      .where(
        and(
          eq(reports.categoryId, input.categoryId),
          eq(reports.moderationStatus, "approved"),
          isNotNull(reports.publicStatus),
          isNotNull(reports.publishedAt),
          gte(reports.publishedAt, input.publishedAfter),
          gte(reports.latitude, input.minLatitude),
          lte(reports.latitude, input.maxLatitude),
          gte(reports.longitude, input.minLongitude),
          lte(reports.longitude, input.maxLongitude)
        )
      )
      .orderBy(desc(reports.publishedAt), desc(reports.createdAt))
      .limit(input.limit);

    return rows.flatMap((row) => {
      if (!row.publicStatus || !row.publishedAt) {
        return [];
      }

      return [
        {
          publicCode: row.publicCode,
          title: row.title,
          categoryName: row.categoryName,
          latitude: row.latitude,
          longitude: row.longitude,
          ...(row.address ? { address: row.address } : {}),
          publicStatus: row.publicStatus,
          publishedAt: row.publishedAt
        }
      ];
    });
  }

  async listTimelineByReportId(reportId: string): Promise<ReportTimelineEvent[]> {
    const rows = await this.db
      .select({
        id: reportEvents.id,
        reportId: reportEvents.reportId,
        type: reportEvents.type,
        visibility: reportEvents.visibility,
        publicStatus: reportEvents.publicStatus,
        metadata: reportEvents.metadata,
        occurredAt: reportEvents.createdAt
      })
      .from(reportEvents)
      .where(eq(reportEvents.reportId, reportId))
      .orderBy(asc(reportEvents.createdAt), asc(reportEvents.id));

    return rows.map(timelineRowToEvent);
  }

  async listPublicTimelineByPublicCode(publicCode: PublicCode): Promise<ReportTimelineEvent[]> {
    const rows = await this.db
      .select({
        id: reportEvents.id,
        reportId: reportEvents.reportId,
        type: reportEvents.type,
        visibility: reportEvents.visibility,
        publicStatus: reportEvents.publicStatus,
        metadata: reportEvents.metadata,
        occurredAt: reportEvents.createdAt
      })
      .from(reportEvents)
      .innerJoin(reports, eq(reportEvents.reportId, reports.id))
      .where(
        and(
          eq(reports.publicCode, publicCode.toString()),
          eq(reports.moderationStatus, "approved"),
          isNotNull(reports.publicStatus),
          isNotNull(reports.publishedAt),
          eq(reportEvents.visibility, "public")
        )
      )
      .orderBy(asc(reportEvents.createdAt), asc(reportEvents.id));

    return rows.map(timelineRowToEvent);
  }

  async listPublicEventsByPublicCode(publicCode: PublicCode): Promise<PublicReportTimelineEvent[]> {
    const events = await this.listPublicTimelineByPublicCode(publicCode);

    return events.map((event) => ({
      type: event.type,
      ...(event.publicStatus ? { publicStatus: event.publicStatus } : {}),
      occurredAt: event.occurredAt
    }));
  }

  async countByModerationStatus(status: ModerationStatus): Promise<number> {
    const [row] = await this.db
      .select({ value: sql<number>`count(*)` })
      .from(reports)
      .where(eq(reports.moderationStatus, status));

    return Number(row?.value ?? 0);
  }
}

function isPublicCodeUniqueViolation(error: unknown): boolean {
  const postgresError = getPostgresError(error);

  if (!postgresError) {
    return false;
  }

  return (
    postgresError.code === "23505" &&
    postgresError.constraint_name === "reports_public_code_unique"
  );
}

function getPostgresError(error: unknown): PostgresError | null {
  if (isPostgresError(error)) {
    return error;
  }

  if (typeof error === "object" && error !== null && "cause" in error) {
    const cause = (error as { cause?: unknown }).cause;

    if (isPostgresError(cause)) {
      return cause;
    }
  }

  return null;
}

type PostgresError = {
  code?: string;
  constraint_name?: string;
};

function isPostgresError(error: unknown): error is PostgresError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "constraint_name" in error
  );
}


function timelineRowToEvent(row: {
  id: string;
  reportId: string;
  type: ReportTimelineEvent["type"];
  visibility: ReportTimelineEvent["visibility"];
  publicStatus: ReportTimelineEvent["publicStatus"] | null;
  metadata: unknown;
  occurredAt: Date;
}): ReportTimelineEvent {
  return {
    id: row.id,
    reportId: row.reportId,
    type: row.type,
    visibility: row.visibility,
    ...(row.publicStatus ? { publicStatus: row.publicStatus } : {}),
    ...(isTimelineMetadata(row.metadata) ? { metadata: row.metadata } : {}),
    occurredAt: row.occurredAt
  };
}

function isTimelineMetadata(value: unknown): value is ReportTimelineEvent["metadata"] & {} {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

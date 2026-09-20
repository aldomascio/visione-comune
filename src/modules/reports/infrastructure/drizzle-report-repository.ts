import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import type { Database } from "@/shared/db/client";
import {
  adminUsers,
  categories,
  reportAttachments,
  reportConfirmations,
  reportEvents,
  reports,
} from "@/shared/db/schema";
import {
  ConcurrentReportDuplicateLinkError,
  ConcurrentReportModerationError,
  ConcurrentReportStateError,
  DuplicatePublicCodePersistenceError,
  type DuplicateReportSummary,
  type ReportModerationFilter,
  type NewReportAttachment,
  type ModerationReportAttachment,
  type PublicReportDetail,
  type PublicReportMapItem,
  type RecentResolvedPublicReport,
  type ReportAttachment,
  type ReportAttachmentAccess,
  type ReportAttachmentType,
  type PublicReportTimelineEvent,
  type PotentialDuplicateReportQuery,
  type PotentialDuplicateReportRecord,
  type PotentialPrimaryReport,
  type ReportModerationSummary,
  type ReportRepository,
  type ReportDuplicateSaveOptions,
  type ReportSaveOptions,
} from "../application/report-repository";
import type { ReportTimelineEvent } from "../application/report-timeline";
import {
  PublicCode,
  type ModerationStatus,
  type Report,
  type ReportDomainEvent,
} from "../domain";
import {
  recordToReport,
  reportEventToRecord,
  reportToRecord,
} from "./report-mapper";

export class DrizzleReportRepository implements ReportRepository {
  constructor(private readonly db: Database) {}

  async save(
    report: Report,
    events: ReportDomainEvent[] = [],
    options: ReportSaveOptions = {},
  ): Promise<void> {
    try {
      await this.db.transaction(async (tx) => {
        const record = reportToRecord(report);

        if (options.expectedModerationStatus || options.expectedPublicStatus) {
          const conditions = [eq(reports.id, record.id)];

          if (options.expectedModerationStatus) {
            conditions.push(
              eq(reports.moderationStatus, options.expectedModerationStatus),
            );
          }

          if (options.expectedPublicStatus) {
            conditions.push(
              eq(reports.publicStatus, options.expectedPublicStatus),
            );
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
          await tx.insert(reports).values(record).onConflictDoUpdate({
            target: reports.id,
            set: record,
          });
        }

        if (events.length > 0) {
          await tx.insert(reportEvents).values(events.map(reportEventToRecord));
        }
      });
    } catch (error) {
      if (isPublicCodeUniqueViolation(error)) {
        throw new DuplicatePublicCodePersistenceError(
          report.toSnapshot().publicCode,
        );
      }

      throw error;
    }
  }

  async saveDuplicateLink(
    report: Report,
    events: ReportDomainEvent[],
    options: ReportDuplicateSaveOptions,
  ): Promise<void> {
    await this.updateDuplicateLink(report, events, options);
  }

  async removeDuplicateLink(
    report: Report,
    events: ReportDomainEvent[],
    options: ReportDuplicateSaveOptions,
  ): Promise<void> {
    await this.updateDuplicateLink(report, events, options);
  }

  private async updateDuplicateLink(
    report: Report,
    events: ReportDomainEvent[],
    options: ReportDuplicateSaveOptions,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const record = reportToRecord(report);
      const duplicateCondition =
        options.expectedDuplicateOfReportId === null
          ? isNull(reports.duplicateOfReportId)
          : eq(
              reports.duplicateOfReportId,
              options.expectedDuplicateOfReportId,
            );
      if (record.duplicateOfReportId) {
        const primaryRows = await tx.execute(sql`
          select id
          from reports
          where id = ${record.duplicateOfReportId}
            and duplicate_of_report_id is null
          for update
        `);

        if (primaryRows.length === 0) {
          throw new ConcurrentReportDuplicateLinkError(record.id);
        }
      }

      const updatedRows = await tx
        .update(reports)
        .set({ duplicateOfReportId: record.duplicateOfReportId })
        .where(and(eq(reports.id, record.id), duplicateCondition))
        .returning({ id: reports.id });

      if (updatedRows.length === 0) {
        throw new ConcurrentReportDuplicateLinkError(record.id);
      }

      if (events.length > 0) {
        await tx.insert(reportEvents).values(events.map(reportEventToRecord));
      }
    });
  }

  async saveWithAttachment(
    report: Report,
    attachment: NewReportAttachment,
    events: ReportDomainEvent[] = [],
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
          reviewStatus: attachment.reviewStatus,
          reviewedAt: attachment.reviewedAt ?? null,
          createdAt: attachment.createdAt,
        });
      });
    } catch (error) {
      if (isPublicCodeUniqueViolation(error)) {
        throw new DuplicatePublicCodePersistenceError(
          report.toSnapshot().publicCode,
        );
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
        email: adminUsers.email,
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

  async saveAttachment(
    attachment: NewReportAttachment,
    events: ReportDomainEvent[] = [],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(reportAttachments).values({
        id: attachment.id,
        reportId: attachment.reportId,
        type: attachment.type,
        storageKey: attachment.storageKey,
        mimeType: attachment.mimeType,
        size: attachment.size,
        reviewStatus: attachment.reviewStatus,
        reviewedAt: attachment.reviewedAt ?? null,
        createdAt: attachment.createdAt,
      });

      if (events.length > 0) {
        await tx.insert(reportEvents).values(events.map(reportEventToRecord));
      }
    });
  }

  async updateAttachmentReview(
    input: {
      reportId: string;
      attachmentType: ReportAttachmentType;
      reviewStatus: "pending_review" | "approved" | "rejected";
      reviewedAt: Date;
    },
    events: ReportDomainEvent[] = [],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(reportAttachments)
        .set({
          reviewStatus: input.reviewStatus,
          reviewedAt: input.reviewedAt,
        })
        .where(
          and(
            eq(reportAttachments.reportId, input.reportId),
            eq(reportAttachments.type, input.attachmentType),
          ),
        );

      if (events.length > 0) {
        await tx.insert(reportEvents).values(events.map(reportEventToRecord));
      }
    });
  }

  async findAttachmentByReportAndType(
    reportId: string,
    type: ReportAttachmentType,
  ): Promise<ReportAttachment | null> {
    const [row] = await this.db
      .select()
      .from(reportAttachments)
      .where(
        and(eq(reportAttachments.reportId, reportId), eq(reportAttachments.type, type)),
      )
      .limit(1);

    return row ? attachmentRecordToDomain(row) : null;
  }

  async listAttachmentsForModeration(
    publicCode: PublicCode,
  ): Promise<ModerationReportAttachment[]> {
    const rows = await this.db
      .select({
        id: reportAttachments.id,
        type: reportAttachments.type,
        reviewStatus: reportAttachments.reviewStatus,
        mimeType: reportAttachments.mimeType,
        size: reportAttachments.size,
        createdAt: reportAttachments.createdAt,
        reviewedAt: reportAttachments.reviewedAt,
      })
      .from(reportAttachments)
      .innerJoin(reports, eq(reportAttachments.reportId, reports.id))
      .where(eq(reports.publicCode, publicCode.toString()))
      .orderBy(asc(reportAttachments.createdAt));

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      reviewStatus: row.reviewStatus,
      mimeType: row.mimeType,
      size: row.size,
      createdAt: row.createdAt,
      ...(row.reviewedAt ? { reviewedAt: row.reviewedAt } : {}),
      url: `/admin/segnalazioni/${publicCode.toString()}/foto?type=${row.type}`,
    }));
  }

  async findAttachmentForModeration(
    publicCode: PublicCode,
    type: ReportAttachmentType,
  ): Promise<ReportAttachmentAccess | null> {
    const [row] = await this.db
      .select({
        storageKey: reportAttachments.storageKey,
        mimeType: reportAttachments.mimeType,
        size: reportAttachments.size,
      })
      .from(reportAttachments)
      .innerJoin(reports, eq(reportAttachments.reportId, reports.id))
      .where(
        and(eq(reports.publicCode, publicCode.toString()), eq(reportAttachments.type, type)),
      )
      .limit(1);

    return row ?? null;
  }

  async findPublicAttachmentByPublicCode(
    publicCode: PublicCode,
    type: ReportAttachmentType,
  ): Promise<ReportAttachmentAccess | null> {
    const [row] = await this.db
      .select({
        storageKey: reportAttachments.storageKey,
        mimeType: reportAttachments.mimeType,
        size: reportAttachments.size,
      })
      .from(reportAttachments)
      .innerJoin(reports, eq(reportAttachments.reportId, reports.id))
      .where(
        and(
          eq(reports.publicCode, publicCode.toString()),
          eq(reportAttachments.type, type),
          eq(reportAttachments.reviewStatus, "approved"),
          eq(reports.moderationStatus, "approved"),
          isNotNull(reports.publicStatus),
          isNotNull(reports.publishedAt),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async listForModeration(
    input: {
      status?: ReportModerationFilter;
      limit?: number;
    } = {},
  ): Promise<ReportModerationSummary[]> {
    const status = input.status ?? "pending_review";
    const limit = input.limit ?? 50;
    const whereClause =
      status === "all" ? undefined : eq(reports.moderationStatus, status);

    const query = this.db
      .select({
        publicCode: reports.publicCode,
        title: reports.title,
        categoryName: categories.name,
        createdAt: reports.createdAt,
        moderationStatus: reports.moderationStatus,
        publicStatus: reports.publicStatus,
        source: reports.source,
        address: reports.address,
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
      ...(row.publicStatus ? { publicStatus: row.publicStatus } : {}),
      source: row.source,
      ...(row.address ? { address: row.address } : {}),
    }));
  }

  async searchPotentialPrimaryReports(input: {
    query: string;
    excludeReportId: string;
    limit: number;
  }): Promise<PotentialPrimaryReport[]> {
    const normalizedQuery = input.query.trim();
    const queryFilter = normalizedQuery
      ? or(
          ilike(reports.publicCode, `%${normalizedQuery}%`),
          ilike(reports.title, `%${normalizedQuery}%`),
        )
      : undefined;
    const rows = await this.db
      .select({
        publicCode: reports.publicCode,
        title: reports.title,
        categoryName: categories.name,
        moderationStatus: reports.moderationStatus,
        publicStatus: reports.publicStatus,
        createdAt: reports.createdAt,
      })
      .from(reports)
      .innerJoin(categories, eq(reports.categoryId, categories.id))
      .where(
        and(
          ne(reports.id, input.excludeReportId),
          isNull(reports.duplicateOfReportId),
          eq(reports.moderationStatus, "approved"),
          isNotNull(reports.publicStatus),
          isNotNull(reports.publishedAt),
          queryFilter,
        ),
      )
      .orderBy(desc(reports.publishedAt), desc(reports.createdAt))
      .limit(input.limit);

    return rows.map((row) => ({
      publicCode: row.publicCode,
      title: row.title,
      categoryName: row.categoryName,
      moderationStatus: row.moderationStatus,
      ...(row.publicStatus ? { publicStatus: row.publicStatus } : {}),
      createdAt: row.createdAt,
    }));
  }

  async listDuplicatesOfReport(
    reportId: string,
  ): Promise<DuplicateReportSummary[]> {
    const rows = await this.db
      .select({
        publicCode: reports.publicCode,
        title: reports.title,
        source: reports.source,
        createdAt: reports.createdAt,
        moderationStatus: reports.moderationStatus,
        publicStatus: reports.publicStatus,
        confirmationsCount: sql<number>`count(${reportConfirmations.id})::int`,
      })
      .from(reports)
      .leftJoin(
        reportConfirmations,
        eq(reportConfirmations.reportId, reports.id),
      )
      .where(eq(reports.duplicateOfReportId, reportId))
      .groupBy(
        reports.id,
        reports.publicCode,
        reports.title,
        reports.source,
        reports.createdAt,
        reports.moderationStatus,
        reports.publicStatus,
      )
      .orderBy(desc(reports.createdAt));

    return rows.map((row) => ({
      publicCode: row.publicCode,
      title: row.title,
      source: row.source,
      createdAt: row.createdAt,
      moderationStatus: row.moderationStatus,
      ...(row.publicStatus ? { publicStatus: row.publicStatus } : {}),
      confirmationsCount: Number(row.confirmationsCount),
    }));
  }

  async findPublicByPublicCode(
    publicCode: PublicCode,
  ): Promise<PublicReportDetail | null> {
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
        duplicateOfReportId: reports.duplicateOfReportId,
      })
      .from(reports)
      .innerJoin(categories, eq(reports.categoryId, categories.id))
      .where(
        and(
          eq(reports.publicCode, publicCode.toString()),
          eq(reports.moderationStatus, "approved"),
        ),
      )
      .limit(1);

    if (!row?.publicStatus || !row.publishedAt) {
      return null;
    }

    const [duplicateOf, reportPhoto, resolutionPhoto] = await Promise.all([
      row.duplicateOfReportId
        ? this.findDuplicatePrimaryPublicSummary(row.duplicateOfReportId)
        : Promise.resolve(null),
      this.findPublicAttachmentByPublicCode(publicCode, "report_photo"),
      this.findPublicAttachmentByPublicCode(publicCode, "resolution_photo"),
    ]);

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
      ...(duplicateOf ? { duplicateOf } : {}),
      ...(reportPhoto
        ? {
            reportPhoto: {
              mimeType: reportPhoto.mimeType,
              size: reportPhoto.size,
              url: `/api/report-images/${row.publicCode}?type=report_photo`,
            },
          }
        : {}),
      ...(resolutionPhoto
        ? {
            resolutionPhoto: {
              mimeType: resolutionPhoto.mimeType,
              size: resolutionPhoto.size,
              url: `/api/report-images/${row.publicCode}?type=resolution_photo`,
            },
          }
        : {}),
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
        reportPhotoId: reportAttachments.id,
        publicStatus: reports.publicStatus,
        publishedAt: reports.publishedAt,
      })
      .from(reports)
      .innerJoin(categories, eq(reports.categoryId, categories.id))
      .leftJoin(
        reportAttachments,
        and(
          eq(reportAttachments.reportId, reports.id),
          eq(reportAttachments.type, "report_photo"),
          eq(reportAttachments.reviewStatus, "approved"),
        ),
      )
      .where(
        and(
          eq(reports.moderationStatus, "approved"),
          isNotNull(reports.publicStatus),
          isNotNull(reports.publishedAt),
          isNull(reports.duplicateOfReportId),
        ),
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
          ...(row.reportPhotoId ? { reportPhotoUrl: `/api/report-images/${row.publicCode}?type=report_photo` } : {}),
          publicStatus: row.publicStatus,
          publishedAt: row.publishedAt,
        },
      ];
    });
  }

  async listRecentlyResolvedPublic(
    limit: number,
  ): Promise<RecentResolvedPublicReport[]> {
    const rows = await this.db
      .select({
        publicCode: reports.publicCode,
        title: reports.title,
        categoryName: categories.name,
        resolvedAt: reports.resolvedAt,
      })
      .from(reports)
      .innerJoin(categories, eq(reports.categoryId, categories.id))
      .where(
        and(
          eq(reports.moderationStatus, "approved"),
          eq(reports.publicStatus, "resolved"),
          isNotNull(reports.publishedAt),
          isNotNull(reports.resolvedAt),
          isNull(reports.duplicateOfReportId),
        ),
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
          resolvedAt: row.resolvedAt,
        },
      ];
    });
  }

  async findPotentialDuplicates(
    input: PotentialDuplicateReportQuery,
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
        publishedAt: reports.publishedAt,
      })
      .from(reports)
      .innerJoin(categories, eq(reports.categoryId, categories.id))
      .where(
        and(
          eq(reports.categoryId, input.categoryId),
          eq(reports.moderationStatus, "approved"),
          isNotNull(reports.publicStatus),
          isNotNull(reports.publishedAt),
          isNull(reports.duplicateOfReportId),
          gte(reports.publishedAt, input.publishedAfter),
          gte(reports.latitude, input.minLatitude),
          lte(reports.latitude, input.maxLatitude),
          gte(reports.longitude, input.minLongitude),
          lte(reports.longitude, input.maxLongitude),
        ),
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
          publishedAt: row.publishedAt,
        },
      ];
    });
  }

  async listTimelineByReportId(
    reportId: string,
  ): Promise<ReportTimelineEvent[]> {
    const rows = await this.db
      .select({
        id: reportEvents.id,
        reportId: reportEvents.reportId,
        type: reportEvents.type,
        visibility: reportEvents.visibility,
        publicStatus: reportEvents.publicStatus,
        metadata: reportEvents.metadata,
        occurredAt: reportEvents.createdAt,
      })
      .from(reportEvents)
      .where(eq(reportEvents.reportId, reportId))
      .orderBy(asc(reportEvents.createdAt), asc(reportEvents.id));

    return rows.map(timelineRowToEvent);
  }

  async listPublicTimelineByPublicCode(
    publicCode: PublicCode,
  ): Promise<ReportTimelineEvent[]> {
    const rows = await this.db
      .select({
        id: reportEvents.id,
        reportId: reportEvents.reportId,
        type: reportEvents.type,
        visibility: reportEvents.visibility,
        publicStatus: reportEvents.publicStatus,
        metadata: reportEvents.metadata,
        occurredAt: reportEvents.createdAt,
      })
      .from(reportEvents)
      .innerJoin(reports, eq(reportEvents.reportId, reports.id))
      .where(
        and(
          eq(reports.publicCode, publicCode.toString()),
          eq(reports.moderationStatus, "approved"),
          isNotNull(reports.publicStatus),
          isNotNull(reports.publishedAt),
          eq(reportEvents.visibility, "public"),
        ),
      )
      .orderBy(asc(reportEvents.createdAt), asc(reportEvents.id));

    return rows.map(timelineRowToEvent);
  }

  async listPublicEventsByPublicCode(
    publicCode: PublicCode,
  ): Promise<PublicReportTimelineEvent[]> {
    const events = await this.listPublicTimelineByPublicCode(publicCode);

    return events.map((event) => ({
      type: event.type,
      ...(event.publicStatus ? { publicStatus: event.publicStatus } : {}),
      occurredAt: event.occurredAt,
    }));
  }

  private async findDuplicatePrimaryPublicSummary(
    reportId: string,
  ): Promise<{ publicCode: string; title: string } | null> {
    const [row] = await this.db
      .select({
        publicCode: reports.publicCode,
        title: reports.title,
      })
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);

    return row ?? null;
  }

  async countByModerationStatus(status: ModerationStatus): Promise<number> {
    const [row] = await this.db
      .select({ value: sql<number>`count(*)` })
      .from(reports)
      .where(eq(reports.moderationStatus, status));

    return Number(row?.value ?? 0);
  }
}


function attachmentRecordToDomain(row: typeof reportAttachments.$inferSelect): ReportAttachment {
  return {
    id: row.id,
    reportId: row.reportId,
    type: row.type,
    storageKey: row.storageKey,
    mimeType: row.mimeType,
    size: row.size,
    reviewStatus: row.reviewStatus,
    ...(row.reviewedAt ? { reviewedAt: row.reviewedAt } : {}),
    createdAt: row.createdAt,
  };
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
    occurredAt: row.occurredAt,
  };
}

function isTimelineMetadata(
  value: unknown,
): value is ReportTimelineEvent["metadata"] & {} {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

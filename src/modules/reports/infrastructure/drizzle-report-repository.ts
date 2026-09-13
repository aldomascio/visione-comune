import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "@/shared/db/client";
import { categories, reportEvents, reports } from "@/shared/db/schema";
import {
  ConcurrentReportModerationError,
  DuplicatePublicCodePersistenceError,
  type ReportModerationFilter,
  type PublicReportDetail,
  type PublicReportTimelineEvent,
  type ReportModerationSummary,
  type ReportRepository,
  type ReportSaveOptions
} from "../application/report-repository";
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

        if (options.expectedModerationStatus) {
          const updatedRows = await tx
            .update(reports)
            .set(record)
            .where(
              and(
                eq(reports.id, record.id),
                eq(reports.moderationStatus, options.expectedModerationStatus)
              )
            )
            .returning({ id: reports.id });

          if (updatedRows.length === 0) {
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

  async findByPublicCode(publicCode: PublicCode): Promise<Report | null> {
    const [record] = await this.db
      .select()
      .from(reports)
      .where(eq(reports.publicCode, publicCode.toString()))
      .limit(1);

    return record ? recordToReport(record) : null;
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
        publishedAt: reports.publishedAt
      })
      .from(reports)
      .innerJoin(categories, eq(reports.categoryId, categories.id))
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
      publishedAt: row.publishedAt
    };
  }

  async listPublicEventsByPublicCode(publicCode: PublicCode): Promise<PublicReportTimelineEvent[]> {
    const rows = await this.db
      .select({
        type: reportEvents.type,
        publicStatus: reportEvents.publicStatus,
        occurredAt: reportEvents.createdAt
      })
      .from(reportEvents)
      .innerJoin(reports, eq(reportEvents.reportId, reports.id))
      .where(
        and(
          eq(reports.publicCode, publicCode.toString()),
          eq(reports.moderationStatus, "approved"),
          eq(reportEvents.visibility, "public")
        )
      )
      .orderBy(reportEvents.createdAt);

    return rows.map((row) => ({
      type: row.type,
      ...(row.publicStatus ? { publicStatus: row.publicStatus } : {}),
      occurredAt: row.occurredAt
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

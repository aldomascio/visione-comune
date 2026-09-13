import { eq } from "drizzle-orm";
import type { Database } from "@/shared/db/client";
import { reportEvents, reports } from "@/shared/db/schema";
import {
  DuplicatePublicCodePersistenceError,
  type ReportRepository
} from "../application/report-repository";
import { PublicCode, type Report, type ReportDomainEvent } from "../domain";
import { recordToReport, reportEventToRecord, reportToRecord } from "./report-mapper";

export class DrizzleReportRepository implements ReportRepository {
  constructor(private readonly db: Database) {}

  async save(report: Report, events: ReportDomainEvent[] = []): Promise<void> {
    try {
      await this.db.transaction(async (tx) => {
        await tx
          .insert(reports)
          .values(reportToRecord(report))
          .onConflictDoUpdate({
            target: reports.id,
            set: reportToRecord(report)
          });

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

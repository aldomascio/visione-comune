import { and, eq, sql } from "drizzle-orm";
import type { Database } from "@/shared/db/client";
import { reportConfirmations } from "@/shared/db/schema";
import type {
  ReportConfirmation,
  ReportConfirmationRepository
} from "../../application/confirmations/report-confirmation-repository";

export class DrizzleReportConfirmationRepository implements ReportConfirmationRepository {
  constructor(private readonly db: Database) {}

  async create(input: ReportConfirmation): Promise<"created" | "already_exists"> {
    const insertedRows = await this.db
      .insert(reportConfirmations)
      .values(input)
      .onConflictDoNothing({
        target: [reportConfirmations.reportId, reportConfirmations.antiAbuseKey]
      })
      .returning({ id: reportConfirmations.id });

    return insertedRows.length > 0 ? "created" : "already_exists";
  }

  async exists(input: { reportId: string; antiAbuseKey: string }): Promise<boolean> {
    const [row] = await this.db
      .select({ id: reportConfirmations.id })
      .from(reportConfirmations)
      .where(
        and(
          eq(reportConfirmations.reportId, input.reportId),
          eq(reportConfirmations.antiAbuseKey, input.antiAbuseKey)
        )
      )
      .limit(1);

    return Boolean(row);
  }

  async countByReportId(reportId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: sql<number>`count(*)` })
      .from(reportConfirmations)
      .where(eq(reportConfirmations.reportId, reportId));

    return Number(row?.value ?? 0);
  }
}

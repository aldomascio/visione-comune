import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import type { Database } from "@/shared/db/client";
import { categories, reportConfirmations, reports } from "@/shared/db/schema";
import type {
  CategoryOperationalMetrics,
  MonthlyOperationalMetrics,
  OperationalMetricCounts,
  OperationalMetricsRepository
} from "../application/operational-metrics";

export class DrizzleOperationalMetricsRepository implements OperationalMetricsRepository {
  constructor(private readonly db: Database) {}

  async getCounts(): Promise<OperationalMetricCounts> {
    const [reportCounts, confirmationCounts] = await Promise.all([
      this.db
        .select({
          totalReceived: sql<number>`count(*)::int`,
          pendingReview: sql<number>`count(*) filter (where ${reports.moderationStatus} = 'pending_review')::int`,
          published: sql<number>`count(*) filter (
            where ${reports.moderationStatus} = 'approved'
              and ${reports.publicStatus} is not null
              and ${reports.publishedAt} is not null
          )::int`,
          communicated: sql<number>`count(*) filter (
            where ${reports.moderationStatus} = 'approved'
              and ${reports.publicStatus} in ('communicated', 'resolved')
          )::int`,
          resolved: sql<number>`count(*) filter (
            where ${reports.moderationStatus} = 'approved'
              and ${reports.publicStatus} = 'resolved'
          )::int`,
          rejected: sql<number>`count(*) filter (where ${reports.moderationStatus} = 'rejected')::int`
        })
        .from(reports),
      this.db.select({ totalConfirmations: sql<number>`count(*)::int` }).from(reportConfirmations)
    ]);

    return {
      totalReceived: Number(reportCounts[0]?.totalReceived ?? 0),
      pendingReview: Number(reportCounts[0]?.pendingReview ?? 0),
      published: Number(reportCounts[0]?.published ?? 0),
      communicated: Number(reportCounts[0]?.communicated ?? 0),
      resolved: Number(reportCounts[0]?.resolved ?? 0),
      rejected: Number(reportCounts[0]?.rejected ?? 0),
      totalConfirmations: Number(confirmationCounts[0]?.totalConfirmations ?? 0)
    };
  }

  async getMedianResolutionTimeMs(): Promise<number | null> {
    const [row] = await this.db
      .select({
        value: sql<number | null>`percentile_cont(0.5) within group (
          order by extract(epoch from (${reports.resolvedAt} - ${reports.publishedAt})) * 1000
        )::double precision`
      })
      .from(reports)
      .where(
        and(
          eq(reports.moderationStatus, "approved"),
          eq(reports.publicStatus, "resolved"),
          isNotNull(reports.publishedAt),
          isNotNull(reports.resolvedAt)
        )
      );

    return row?.value === null || row?.value === undefined ? null : Number(row.value);
  }

  async getMedianCommunicationTimeMs(): Promise<number | null> {
    const [row] = await this.db
      .select({
        value: sql<number | null>`percentile_cont(0.5) within group (
          order by extract(epoch from (${reports.communicatedAt} - ${reports.publishedAt})) * 1000
        )::double precision`
      })
      .from(reports)
      .where(
        and(
          eq(reports.moderationStatus, "approved"),
          inArray(reports.publicStatus, ["communicated", "resolved"]),
          isNotNull(reports.publishedAt),
          isNotNull(reports.communicatedAt)
        )
      );

    return row?.value === null || row?.value === undefined ? null : Number(row.value);
  }

  async getCategoryDistribution(): Promise<CategoryOperationalMetrics[]> {
    const rows = await this.db
      .select({
        categoryId: categories.id,
        categoryName: categories.name,
        publishedCount: sql<number>`count(*) filter (
          where ${reports.moderationStatus} = 'approved'
            and ${reports.publicStatus} is not null
            and ${reports.publishedAt} is not null
        )::int`,
        resolvedCount: sql<number>`count(*) filter (
          where ${reports.moderationStatus} = 'approved'
            and ${reports.publicStatus} = 'resolved'
        )::int`
      })
      .from(categories)
      .leftJoin(reports, eq(reports.categoryId, categories.id))
      .groupBy(categories.id, categories.name)
      .orderBy(desc(sql`count(*) filter (
        where ${reports.moderationStatus} = 'approved'
          and ${reports.publicStatus} is not null
          and ${reports.publishedAt} is not null
      )`), categories.name);

    return rows
      .filter((row) => Number(row.publishedCount) > 0 || Number(row.resolvedCount) > 0)
      .map((row) => ({
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        publishedCount: Number(row.publishedCount),
        resolvedCount: Number(row.resolvedCount)
      }));
  }

  async getMonthlyTrend(input: { months: string[]; from: Date }): Promise<MonthlyOperationalMetrics[]> {
    const [receivedRows, resolvedRows] = await Promise.all([
      this.db
        .select({
          month: sql<string>`to_char(date_trunc('month', ${reports.createdAt}), 'YYYY-MM')`,
          count: sql<number>`count(*)::int`
        })
        .from(reports)
        .where(gte(reports.createdAt, input.from))
        .groupBy(sql`date_trunc('month', ${reports.createdAt})`),
      this.db
        .select({
          month: sql<string>`to_char(date_trunc('month', ${reports.resolvedAt}), 'YYYY-MM')`,
          count: sql<number>`count(*)::int`
        })
        .from(reports)
        .where(
          and(
            eq(reports.moderationStatus, "approved"),
            eq(reports.publicStatus, "resolved"),
            isNotNull(reports.resolvedAt),
            gte(reports.resolvedAt, input.from)
          )
        )
        .groupBy(sql`date_trunc('month', ${reports.resolvedAt})`)
    ]);

    const monthSet = new Set(input.months);
    const byMonth = new Map(input.months.map((month) => [month, { month, receivedCount: 0, resolvedCount: 0 }]));

    for (const row of receivedRows) {
      if (monthSet.has(row.month)) {
        byMonth.get(row.month)!.receivedCount = Number(row.count);
      }
    }

    for (const row of resolvedRows) {
      if (monthSet.has(row.month)) {
        byMonth.get(row.month)!.resolvedCount = Number(row.count);
      }
    }

    return [...byMonth.values()];
  }
}

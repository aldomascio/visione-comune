export const OPERATIONAL_METRIC_DEFINITIONS = {
  totalReceived: "Tutte le segnalazioni create, indipendentemente dalla moderazione.",
  pendingReview: "Segnalazioni con moderazione Da verificare.",
  published: "Segnalazioni approvate con stato pubblico valorizzato e data di pubblicazione.",
  communicated: "Segnalazioni nello stato Comunicata oppure Risolta, per includere le comunicazioni storiche.",
  resolved: "Segnalazioni nello stato Risolta.",
  rejected: "Segnalazioni con moderazione Rifiutata.",
  totalConfirmations: "Numero totale di conferme cittadine persistite.",
  resolutionRate: "Segnalazioni risolte diviso segnalazioni pubblicate, espresso in percentuale.",
  medianResolutionTime: "Mediana del tempo tra publishedAt e resolvedAt per segnalazioni risolte.",
  medianCommunicationTime: "Mediana del tempo tra publishedAt e communicatedAt per segnalazioni comunicate o risolte.",
  categoryDistribution: "Conteggio per categoria di segnalazioni pubblicate e risolte.",
  monthlyTrend: "Ultimi 6 mesi con segnalazioni ricevute per createdAt e risolte per resolvedAt."
} as const;

export type OperationalMetricDefinitions = typeof OPERATIONAL_METRIC_DEFINITIONS;

export type OperationalMetricCounts = {
  totalReceived: number;
  pendingReview: number;
  published: number;
  communicated: number;
  resolved: number;
  rejected: number;
  totalConfirmations: number;
};

export type CategoryOperationalMetrics = {
  categoryId: string;
  categoryName: string;
  publishedCount: number;
  resolvedCount: number;
};

export type MonthlyOperationalMetrics = {
  month: string;
  receivedCount: number;
  resolvedCount: number;
};

export type OperationalMetricsSnapshot = {
  counts: OperationalMetricCounts;
  resolutionRate: {
    resolved: number;
    published: number;
    percentage: number | null;
  };
  medianResolutionTimeMs: number | null;
  medianCommunicationTimeMs: number | null;
  categories: CategoryOperationalMetrics[];
  monthlyTrend: MonthlyOperationalMetrics[];
  definitions: OperationalMetricDefinitions;
  timestamps: {
    received: "createdAt";
    published: "publishedAt";
    communicated: "communicatedAt";
    resolved: "resolvedAt";
  };
};

export type PublicPlatformMetrics = {
  published: number;
  communicated: number;
  resolved: number;
  totalConfirmations: number;
  resolutionRatePercentage: number | null;
};

export type OperationalMetricsRepository = {
  getCounts(): Promise<OperationalMetricCounts>;
  getMedianResolutionTimeMs(): Promise<number | null>;
  getMedianCommunicationTimeMs(): Promise<number | null>;
  getCategoryDistribution(): Promise<CategoryOperationalMetrics[]>;
  getMonthlyTrend(input: { months: string[]; from: Date }): Promise<MonthlyOperationalMetrics[]>;
};

export class GetAdminOperationalMetricsUseCase {
  constructor(
    private readonly dependencies: {
      metricsRepository: OperationalMetricsRepository;
      now?: () => Date;
    }
  ) {}

  async execute(): Promise<OperationalMetricsSnapshot> {
    const monthWindow = buildLastMonthKeys(this.dependencies.now?.() ?? new Date(), 6);
    const [counts, medianResolutionTimeMs, medianCommunicationTimeMs, categories, monthlyTrend] =
      await Promise.all([
        this.dependencies.metricsRepository.getCounts(),
        this.dependencies.metricsRepository.getMedianResolutionTimeMs(),
        this.dependencies.metricsRepository.getMedianCommunicationTimeMs(),
        this.dependencies.metricsRepository.getCategoryDistribution(),
        this.dependencies.metricsRepository.getMonthlyTrend({
          months: monthWindow.months,
          from: monthWindow.from
        })
      ]);

    return buildOperationalMetricsSnapshot({
      counts,
      medianResolutionTimeMs,
      medianCommunicationTimeMs,
      categories,
      monthlyTrend,
      months: monthWindow.months
    });
  }
}

export class GetPublicPlatformMetricsUseCase {
  constructor(
    private readonly dependencies: {
      metricsRepository: Pick<OperationalMetricsRepository, "getCounts">;
    }
  ) {}

  async execute(): Promise<PublicPlatformMetrics> {
    const counts = await this.dependencies.metricsRepository.getCounts();
    return {
      published: counts.published,
      communicated: counts.communicated,
      resolved: counts.resolved,
      totalConfirmations: counts.totalConfirmations,
      resolutionRatePercentage: calculateResolutionRatePercentage(counts)
    };
  }
}

export function buildOperationalMetricsSnapshot(input: {
  counts: OperationalMetricCounts;
  medianResolutionTimeMs: number | null;
  medianCommunicationTimeMs: number | null;
  categories: CategoryOperationalMetrics[];
  monthlyTrend: MonthlyOperationalMetrics[];
  months: string[];
}): OperationalMetricsSnapshot {
  return {
    counts: input.counts,
    resolutionRate: {
      resolved: input.counts.resolved,
      published: input.counts.published,
      percentage: calculateResolutionRatePercentage(input.counts)
    },
    medianResolutionTimeMs: normalizeDuration(input.medianResolutionTimeMs),
    medianCommunicationTimeMs: normalizeDuration(input.medianCommunicationTimeMs),
    categories: input.categories,
    monthlyTrend: fillMonthlyTrend(input.months, input.monthlyTrend),
    definitions: OPERATIONAL_METRIC_DEFINITIONS,
    timestamps: {
      received: "createdAt",
      published: "publishedAt",
      communicated: "communicatedAt",
      resolved: "resolvedAt"
    }
  };
}

export function calculateResolutionRatePercentage(counts: Pick<OperationalMetricCounts, "published" | "resolved">): number | null {
  if (counts.published === 0) {
    return null;
  }

  return roundToOneDecimal((counts.resolved / counts.published) * 100);
}

export function calculateMedian(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? null;
  }

  const left = sorted[middle - 1];
  const right = sorted[middle];

  if (left === undefined || right === undefined) {
    return null;
  }

  return (left + right) / 2;
}

export function buildLastMonthKeys(now: Date, monthsCount: number): { months: string[]; from: Date } {
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const months = Array.from({ length: monthsCount }, (_, index) => {
    const monthDate = new Date(currentMonthStart);
    monthDate.setUTCMonth(currentMonthStart.getUTCMonth() - (monthsCount - 1 - index));
    return toMonthKey(monthDate);
  });
  const from = new Date(currentMonthStart);
  from.setUTCMonth(currentMonthStart.getUTCMonth() - (monthsCount - 1));

  return { months, from };
}

export function toMonthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function fillMonthlyTrend(months: string[], rows: MonthlyOperationalMetrics[]): MonthlyOperationalMetrics[] {
  const rowsByMonth = new Map(rows.map((row) => [row.month, row]));

  return months.map((month) => ({
    month,
    receivedCount: rowsByMonth.get(month)?.receivedCount ?? 0,
    resolvedCount: rowsByMonth.get(month)?.resolvedCount ?? 0
  }));
}

function normalizeDuration(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.round(value));
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

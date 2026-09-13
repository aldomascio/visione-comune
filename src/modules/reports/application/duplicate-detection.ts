import { calculateHaversineDistanceMeters, coordinateBoundingBox } from "@/shared/geo/distance";
import { PUBLIC_REPORT_STATUS_LABELS, type PublicReportStatus } from "../domain";
import type { PotentialDuplicateReportRecord, ReportRepository } from "./report-repository";

export type DuplicateDetectionConfig = {
  maxDistanceMeters: number;
  lookbackDays: number;
  maxCandidates: number;
  databaseCandidateLimit: number;
};

export const DEFAULT_DUPLICATE_DETECTION_CONFIG = {
  maxDistanceMeters: 100,
  lookbackDays: 90,
  maxCandidates: 5,
  databaseCandidateLimit: 50
} satisfies DuplicateDetectionConfig;

export type PotentialDuplicateReportCandidate = {
  publicCode: string;
  title: string;
  categoryName: string;
  address?: string;
  publicStatus: PublicReportStatus;
  publicStatusLabel: string;
  distanceMeters: number;
  publishedAt: Date;
};

export type FindPotentialDuplicateReportsInput = {
  categoryId: string;
  latitude: number;
  longitude: number;
  description: string;
  now?: Date;
  config?: Partial<DuplicateDetectionConfig>;
};

export type FindPotentialDuplicateReportsUseCaseDependencies = {
  reportRepository: ReportRepository;
  now?: () => Date;
  config?: Partial<DuplicateDetectionConfig>;
};

export class FindPotentialDuplicateReportsUseCase {
  private readonly now: () => Date;
  private readonly config: DuplicateDetectionConfig;

  constructor(private readonly dependencies: FindPotentialDuplicateReportsUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.config = resolveDuplicateDetectionConfig(dependencies.config);
  }

  async execute(input: FindPotentialDuplicateReportsInput): Promise<PotentialDuplicateReportCandidate[]> {
    const config = resolveDuplicateDetectionConfig({ ...this.config, ...input.config });
    const now = input.now ?? this.now();
    const publishedAfter = getDuplicateDetectionWindowStart(now, config.lookbackDays);
    const center = { latitude: input.latitude, longitude: input.longitude };
    const boundingBox = coordinateBoundingBox(center, config.maxDistanceMeters);

    const candidates = await this.dependencies.reportRepository.findPotentialDuplicates({
      categoryId: input.categoryId,
      publishedAfter,
      limit: config.databaseCandidateLimit,
      ...boundingBox
    });

    return candidates
      .map((candidate) => toCandidate(candidate, center))
      .filter((candidate) => candidate.distanceMeters <= config.maxDistanceMeters)
      .sort(compareDuplicateCandidates)
      .slice(0, config.maxCandidates);
  }
}

export function getDuplicateDetectionWindowStart(now: Date, lookbackDays: number): Date {
  return new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
}

function resolveDuplicateDetectionConfig(
  override: Partial<DuplicateDetectionConfig> = {}
): DuplicateDetectionConfig {
  return {
    ...DEFAULT_DUPLICATE_DETECTION_CONFIG,
    ...override
  };
}

function toCandidate(
  record: PotentialDuplicateReportRecord,
  center: { latitude: number; longitude: number }
): PotentialDuplicateReportCandidate {
  return {
    publicCode: record.publicCode,
    title: record.title,
    categoryName: record.categoryName,
    ...(record.address ? { address: record.address } : {}),
    publicStatus: record.publicStatus,
    publicStatusLabel: PUBLIC_REPORT_STATUS_LABELS[record.publicStatus],
    distanceMeters: Math.round(
      calculateHaversineDistanceMeters(center, {
        latitude: record.latitude,
        longitude: record.longitude
      })
    ),
    publishedAt: record.publishedAt
  };
}

function compareDuplicateCandidates(
  left: PotentialDuplicateReportCandidate,
  right: PotentialDuplicateReportCandidate
): number {
  if (left.distanceMeters !== right.distanceMeters) {
    return left.distanceMeters - right.distanceMeters;
  }

  return right.publishedAt.getTime() - left.publishedAt.getTime();
}

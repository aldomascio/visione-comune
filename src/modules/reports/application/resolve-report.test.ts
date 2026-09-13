import { describe, expect, it } from "vitest";
import { Location, PublicCode, Report, type ModerationStatus, type ReportDomainEvent } from "../domain";
import {
  ReportForResolutionNotFoundError,
  ReportResolutionConflictError,
  ReportResolutionNotAllowedError,
  ResolveReportUseCase
} from "./resolve-report";
import {
  ConcurrentReportStateError,
  type PotentialDuplicateReportRecord,
  type PublicReportDetail,
  type PublicReportMapItem,
  type PublicReportTimelineEvent,
  type ReportAttachmentAccess,
  type ReportModerationSummary,
  type ReportRepository,
  type ReportSaveOptions
} from "./report-repository";

const resolvedAt = new Date("2026-01-06T10:00:00.000Z");

describe("ResolveReportUseCase", () => {
  it("marks a communicated report as resolved and persists the public event with an internal note", async () => {
    const repository = new InMemoryResolutionReportRepository([
      createCommunicatedReport("report-1", "VC-RESOLV01")
    ]);
    const useCase = new ResolveReportUseCase({ reportRepository: repository, now: () => resolvedAt });

    const result = await useCase.execute({
      publicCode: "VC-RESOLV01",
      internalNote: "  Verifica sul posto completata.  "
    });

    expect(result).toMatchObject({
      publicStatus: "resolved",
      resolvedAt
    });
    expect(repository.savedEvents).toEqual([
      {
        type: "ReportResolved",
        reportId: "report-1",
        occurredAt: resolvedAt,
        visibility: "public",
        publicStatus: "resolved",
        metadata: { internalNote: "Verifica sul posto completata." }
      }
    ]);
    expect(repository.lastSaveOptions).toEqual({
      expectedModerationStatus: "approved",
      expectedPublicStatus: "communicated"
    });
  });

  it.each([
    ["pending", createPendingReport("report-pending", "VC-RESPEND1")],
    ["rejected", createRejectedReport("report-rejected", "VC-RESREJ01")],
    ["reported", createApprovedReport("report-reported", "VC-RESREP01")],
    ["resolved", createResolvedReport("report-resolved", "VC-RESOLD01")]
  ])("rejects %s reports", async (_state, report) => {
    const repository = new InMemoryResolutionReportRepository([report]);
    const useCase = new ResolveReportUseCase({ reportRepository: repository, now: () => resolvedAt });

    await expect(useCase.execute({ publicCode: report.toSnapshot().publicCode })).rejects.toThrow(
      ReportResolutionNotAllowedError
    );
    expect(repository.savedEvents).toEqual([]);
  });

  it("returns a controlled error when the report does not exist", async () => {
    const repository = new InMemoryResolutionReportRepository([]);
    const useCase = new ResolveReportUseCase({ reportRepository: repository, now: () => resolvedAt });

    await expect(useCase.execute({ publicCode: "VC-MISSING1" })).rejects.toThrow(
      ReportForResolutionNotFoundError
    );
  });

  it("returns a controlled conflict when the report state changed before save", async () => {
    const repository = new InMemoryResolutionReportRepository(
      [createCommunicatedReport("report-1", "VC-RESOLV01")],
      { failConcurrentSave: true }
    );
    const useCase = new ResolveReportUseCase({ reportRepository: repository, now: () => resolvedAt });

    await expect(useCase.execute({ publicCode: "VC-RESOLV01" })).rejects.toThrow(
      ReportResolutionConflictError
    );
  });
});

class InMemoryResolutionReportRepository implements ReportRepository {
  readonly savedEvents: ReportDomainEvent[] = [];
  lastSaveOptions?: ReportSaveOptions;

  constructor(
    private readonly reports: Report[],
    private readonly options: { failConcurrentSave?: boolean } = {}
  ) {}

  async save(report: Report, events: ReportDomainEvent[] = [], options: ReportSaveOptions = {}): Promise<void> {
    this.lastSaveOptions = options;

    if (this.options.failConcurrentSave) {
      throw new ConcurrentReportStateError(report.toSnapshot().id);
    }

    const index = this.reports.findIndex((item) => item.toSnapshot().id === report.toSnapshot().id);

    if (index >= 0) {
      this.reports[index] = report;
    } else {
      this.reports.push(report);
    }

    this.savedEvents.push(...events);
  }

  async saveWithAttachment(report: Report, _attachment: never, events: ReportDomainEvent[] = []): Promise<void> {
    await this.save(report, events);
  }

  async findByPublicCode(publicCode: PublicCode): Promise<Report | null> {
    return this.reports.find((report) => report.toSnapshot().publicCode === publicCode.toString()) ?? null;
  }

  async findAttachmentForModeration(): Promise<ReportAttachmentAccess | null> {
    return null;
  }

  async findPublicAttachmentByPublicCode(): Promise<ReportAttachmentAccess | null> {
    return null;
  }

  async listForModeration(): Promise<ReportModerationSummary[]> {
    return [];
  }

  async countByModerationStatus(status: ModerationStatus): Promise<number> {
    return this.reports.filter((report) => report.toSnapshot().moderationStatus === status).length;
  }

  async findPublicByPublicCode(): Promise<PublicReportDetail | null> {
    return null;
  }

  async listPublicForMap(): Promise<PublicReportMapItem[]> {
    return [];
  }

  async findPotentialDuplicates(): Promise<PotentialDuplicateReportRecord[]> {
    return [];
  }

  async listPublicEventsByPublicCode(): Promise<PublicReportTimelineEvent[]> {
    return [];
  }
}

function createPendingReport(id: string, publicCode: string): Report {
  const report = Report.create({
    id,
    publicCode: PublicCode.create(publicCode),
    title: "Buche in strada",
    description: "Sono presenti buche profonde vicino alla scuola.",
    categoryId: "roads",
    location: Location.create({ latitude: 41.4821, longitude: 14.0474, address: "Via Roma" }),
    createdAt: new Date("2026-01-01T10:00:00.000Z")
  });
  report.pullDomainEvents();
  return report;
}

function createApprovedReport(id: string, publicCode: string): Report {
  const report = createPendingReport(id, publicCode);
  report.approve(new Date("2026-01-02T10:00:00.000Z"));
  report.pullDomainEvents();
  return report;
}

function createCommunicatedReport(id: string, publicCode: string): Report {
  const report = createApprovedReport(id, publicCode);
  report.markCommunicated(new Date("2026-01-04T10:00:00.000Z"));
  report.pullDomainEvents();
  return report;
}

function createResolvedReport(id: string, publicCode: string): Report {
  const report = createCommunicatedReport(id, publicCode);
  report.markResolved(new Date("2026-01-05T10:00:00.000Z"));
  report.pullDomainEvents();
  return report;
}

function createRejectedReport(id: string, publicCode: string): Report {
  const report = createPendingReport(id, publicCode);
  report.reject(new Date("2026-01-02T10:00:00.000Z"));
  report.pullDomainEvents();
  return report;
}

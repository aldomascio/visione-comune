import { describe, expect, it } from "vitest";
import { Location, PublicCode, Report, type ModerationStatus, type ReportDomainEvent } from "../domain";
import {
  ApproveReportUseCase,
  GetModerationDashboardUseCase,
  ListReportsForModerationUseCase,
  RejectReportUseCase,
  ReportAlreadyModeratedError,
  ReportForModerationNotFoundError,
  ReportModerationConflictError
} from "./moderate-report";
import {
  ConcurrentReportModerationError,
  type ReportModerationFilter,
  type ReportModerationSummary,
  type ReportRepository,
  type ReportSaveOptions
} from "./report-repository";

const now = new Date("2026-01-02T10:00:00.000Z");

describe("moderation use cases", () => {
  it("lists pending reports for moderation", async () => {
    const repository = new InMemoryModerationReportRepository([
      createPendingReport("report-1", "VC-ABC12345"),
      createApprovedReport("report-2", "VC-ABC12346")
    ]);
    const listUseCase = new ListReportsForModerationUseCase({ reportRepository: repository });
    const dashboardUseCase = new GetModerationDashboardUseCase({ reportRepository: repository });

    await expect(listUseCase.execute()).resolves.toMatchObject([
      { publicCode: "VC-ABC12345", moderationStatus: "pending_review" }
    ]);
    await expect(dashboardUseCase.execute()).resolves.toMatchObject({ pendingCount: 1 });
  });

  it("approves a pending report and persists the domain event", async () => {
    const repository = new InMemoryModerationReportRepository([
      createPendingReport("report-1", "VC-ABC12345")
    ]);
    const useCase = new ApproveReportUseCase({ reportRepository: repository, now: () => now });

    const result = await useCase.execute({ publicCode: "VC-ABC12345" });

    expect(result).toMatchObject({
      moderationStatus: "approved",
      publicStatus: "reported",
      publishedAt: now
    });
    expect(repository.savedEvents).toEqual([
      {
        type: "ReportApproved",
        reportId: "report-1",
        occurredAt: now,
        visibility: "public",
        publicStatus: "reported"
      }
    ]);
    expect(repository.lastSaveOptions).toEqual({ expectedModerationStatus: "pending_review" });
  });

  it("rejects a pending report and persists the internal event with optional note", async () => {
    const repository = new InMemoryModerationReportRepository([
      createPendingReport("report-1", "VC-ABC12345")
    ]);
    const useCase = new RejectReportUseCase({ reportRepository: repository, now: () => now });

    const result = await useCase.execute({
      publicCode: "VC-ABC12345",
      internalNote: "  Contiene dati personali nel testo.  "
    });

    expect(result).toMatchObject({
      moderationStatus: "rejected"
    });
    expect(result.publicStatus).toBeUndefined();
    expect(result.publishedAt).toBeUndefined();
    expect(repository.savedEvents).toEqual([
      {
        type: "ReportRejected",
        reportId: "report-1",
        occurredAt: now,
        visibility: "internal",
        metadata: { internalNote: "Contiene dati personali nel testo." }
      }
    ]);
  });

  it("fails when approving an already approved report", async () => {
    const repository = new InMemoryModerationReportRepository([
      createApprovedReport("report-1", "VC-ABC12345")
    ]);
    const useCase = new ApproveReportUseCase({ reportRepository: repository, now: () => now });

    await expect(useCase.execute({ publicCode: "VC-ABC12345" })).rejects.toThrow(
      ReportAlreadyModeratedError
    );
    expect(repository.savedEvents).toEqual([]);
  });

  it("fails when rejecting an already rejected report", async () => {
    const repository = new InMemoryModerationReportRepository([
      createRejectedReport("report-1", "VC-ABC12345")
    ]);
    const useCase = new RejectReportUseCase({ reportRepository: repository, now: () => now });

    await expect(useCase.execute({ publicCode: "VC-ABC12345" })).rejects.toThrow(
      ReportAlreadyModeratedError
    );
    expect(repository.savedEvents).toEqual([]);
  });

  it("fails when moderating a report already moderated in another state", async () => {
    const repository = new InMemoryModerationReportRepository([
      createApprovedReport("report-1", "VC-ABC12345")
    ]);
    const useCase = new RejectReportUseCase({ reportRepository: repository, now: () => now });

    await expect(useCase.execute({ publicCode: "VC-ABC12345" })).rejects.toThrow(
      ReportAlreadyModeratedError
    );
    expect(repository.savedEvents).toEqual([]);
  });

  it("returns a controlled error for concurrent double moderation", async () => {
    const repository = new InMemoryModerationReportRepository(
      [createPendingReport("report-1", "VC-ABC12345")],
      { failConcurrentSave: true }
    );
    const useCase = new ApproveReportUseCase({ reportRepository: repository, now: () => now });

    await expect(useCase.execute({ publicCode: "VC-ABC12345" })).rejects.toThrow(
      ReportModerationConflictError
    );
  });

  it("returns a controlled error when the report does not exist", async () => {
    const repository = new InMemoryModerationReportRepository([]);
    const useCase = new ApproveReportUseCase({ reportRepository: repository, now: () => now });

    await expect(useCase.execute({ publicCode: "VC-ABC12345" })).rejects.toThrow(
      ReportForModerationNotFoundError
    );
  });
});

class InMemoryModerationReportRepository implements ReportRepository {
  readonly savedEvents: ReportDomainEvent[] = [];
  lastSaveOptions?: ReportSaveOptions;

  constructor(
    private readonly reports: Report[],
    private readonly options: { failConcurrentSave?: boolean } = {}
  ) {}

  async save(report: Report, events: ReportDomainEvent[] = [], options: ReportSaveOptions = {}): Promise<void> {
    this.lastSaveOptions = options;

    if (this.options.failConcurrentSave) {
      throw new ConcurrentReportModerationError(report.toSnapshot().id);
    }

    const index = this.reports.findIndex((item) => item.toSnapshot().id === report.toSnapshot().id);

    if (index >= 0) {
      this.reports[index] = report;
    } else {
      this.reports.push(report);
    }

    this.savedEvents.push(...events);
  }

  async findByPublicCode(publicCode: PublicCode): Promise<Report | null> {
    return this.reports.find((report) => report.toSnapshot().publicCode === publicCode.toString()) ?? null;
  }

  async listForModeration(input: { status?: ReportModerationFilter; limit?: number } = {}): Promise<ReportModerationSummary[]> {
    const status = input.status ?? "pending_review";
    const reports = this.reports.filter((report) => {
      const snapshot = report.toSnapshot();
      return status === "all" || snapshot.moderationStatus === status;
    });

    return reports.slice(0, input.limit ?? 100).map((report) => {
      const snapshot = report.toSnapshot();

      return {
        publicCode: snapshot.publicCode,
        title: snapshot.title,
        categoryName: "Categoria test",
        createdAt: snapshot.createdAt,
        moderationStatus: snapshot.moderationStatus,
        ...(snapshot.location.address ? { address: snapshot.location.address } : {})
      };
    });
  }

  async countByModerationStatus(status: ModerationStatus): Promise<number> {
    return this.reports.filter((report) => report.toSnapshot().moderationStatus === status).length;
  }

  async findPublicByPublicCode(): Promise<null> {
    return null;
  }

  async listPublicForMap(): Promise<[]> {
    return [];
  }

  async listPublicEventsByPublicCode(): Promise<[]> {
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

function createRejectedReport(id: string, publicCode: string): Report {
  const report = createPendingReport(id, publicCode);
  report.reject(new Date("2026-01-02T10:00:00.000Z"));
  report.pullDomainEvents();
  return report;
}

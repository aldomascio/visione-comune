import { describe, expect, it } from "vitest";
import { PublicCode, Report, Location, type ModerationStatus, type PublicCode as PublicCodeValue } from "../../domain";
import type {
  PotentialDuplicateReportQuery,
  PotentialDuplicateReportRecord,
  PublicReportDetail,
  PublicReportMapItem,
  PublicReportTimelineEvent,
  ReportAttachmentAccess,
  ReportModerationFilter,
  ReportModerationSummary,
  ReportRepository
} from "../report-repository";
import type { ReportConfirmation, ReportConfirmationRepository } from "./report-confirmation-repository";
import {
  ConfirmReportUseCase,
  CountReportConfirmationsUseCase,
  GetReportConfirmationStateUseCase,
  ReportNotConfirmableError
} from "./report-confirmations";

const approvedAt = new Date("2026-01-02T10:00:00.000Z");

describe("report confirmation use cases", () => {
  it("creates a confirmation for a public approved report", async () => {
    const reports = new InMemoryReportRepository([createApprovedReport()]);
    const confirmations = new InMemoryReportConfirmationRepository();
    const useCase = createConfirmUseCase(reports, confirmations);

    await expect(
      useCase.execute({ publicCode: "VC-CONFIRM1", antiAbuseKey: "browser-a" })
    ).resolves.toEqual({
      publicCode: "VC-CONFIRM1",
      count: 1,
      alreadyConfirmed: true,
      created: true
    });
    expect(confirmations.confirmations).toMatchObject([
      { reportId: "report-confirmable", antiAbuseKey: "browser-a" }
    ]);
  });

  it("does not create a duplicate confirmation for the same browser key", async () => {
    const reports = new InMemoryReportRepository([createApprovedReport()]);
    const confirmations = new InMemoryReportConfirmationRepository();
    const useCase = createConfirmUseCase(reports, confirmations);

    await useCase.execute({ publicCode: "VC-CONFIRM1", antiAbuseKey: "browser-a" });
    await expect(
      useCase.execute({ publicCode: "VC-CONFIRM1", antiAbuseKey: "browser-a" })
    ).resolves.toMatchObject({ count: 1, alreadyConfirmed: true, created: false });
  });

  it("counts confirmations from multiple pseudonymous browsers", async () => {
    const reports = new InMemoryReportRepository([createApprovedReport()]);
    const confirmations = new InMemoryReportConfirmationRepository();
    const useCase = createConfirmUseCase(reports, confirmations);

    await useCase.execute({ publicCode: "VC-CONFIRM1", antiAbuseKey: "browser-a" });
    await useCase.execute({ publicCode: "VC-CONFIRM1", antiAbuseKey: "browser-b" });

    await expect(
      new CountReportConfirmationsUseCase({
        reportRepository: reports,
        confirmationRepository: confirmations
      }).execute({ publicCode: "VC-CONFIRM1" })
    ).resolves.toBe(2);
  });

  it("returns whether the current browser has already confirmed", async () => {
    const reports = new InMemoryReportRepository([createApprovedReport()]);
    const confirmations = new InMemoryReportConfirmationRepository();
    await confirmations.create({
      id: "confirmation-1",
      reportId: "report-confirmable",
      antiAbuseKey: "browser-a",
      createdAt: new Date("2026-01-03T10:00:00.000Z")
    });

    const useCase = new GetReportConfirmationStateUseCase({
      reportRepository: reports,
      confirmationRepository: confirmations
    });

    await expect(
      useCase.execute({ publicCode: "VC-CONFIRM1", antiAbuseKey: "browser-a" })
    ).resolves.toEqual({ publicCode: "VC-CONFIRM1", count: 1, alreadyConfirmed: true });
    await expect(
      useCase.execute({ publicCode: "VC-CONFIRM1", antiAbuseKey: "browser-b" })
    ).resolves.toEqual({ publicCode: "VC-CONFIRM1", count: 1, alreadyConfirmed: false });
  });

  it("rejects pending, rejected, missing and invalid reports", async () => {
    const pendingReport = createPendingReport("report-pending", "VC-PENDING1");
    const rejectedReport = createPendingReport("report-rejected", "VC-REJECTD1");
    rejectedReport.reject(approvedAt);
    const reports = new InMemoryReportRepository([pendingReport, rejectedReport]);
    const confirmations = new InMemoryReportConfirmationRepository();
    const useCase = createConfirmUseCase(reports, confirmations);

    await expect(
      useCase.execute({ publicCode: "VC-PENDING1", antiAbuseKey: "browser-a" })
    ).rejects.toThrow(ReportNotConfirmableError);
    await expect(
      useCase.execute({ publicCode: "VC-REJECTD1", antiAbuseKey: "browser-a" })
    ).rejects.toThrow(ReportNotConfirmableError);
    await expect(
      useCase.execute({ publicCode: "VC-MISSING1", antiAbuseKey: "browser-a" })
    ).rejects.toThrow(ReportNotConfirmableError);
    await expect(
      useCase.execute({ publicCode: "not-valid", antiAbuseKey: "browser-a" })
    ).rejects.toThrow(ReportNotConfirmableError);
    expect(confirmations.confirmations).toHaveLength(0);
  });
});

function createConfirmUseCase(
  reportRepository: ReportRepository,
  confirmationRepository: ReportConfirmationRepository
) {
  return new ConfirmReportUseCase({
    reportRepository,
    confirmationRepository,
    now: () => new Date("2026-01-03T10:00:00.000Z"),
    createId: () => `confirmation-${confirmationRepository instanceof InMemoryReportConfirmationRepository ? confirmationRepository.confirmations.length + 1 : 1}`
  });
}

function createApprovedReport(): Report {
  const report = createPendingReport("report-confirmable", "VC-CONFIRM1");
  report.pullDomainEvents();
  report.approve(approvedAt);
  report.pullDomainEvents();
  return report;
}

function createPendingReport(id: string, publicCode: string): Report {
  return Report.create({
    id,
    publicCode: PublicCode.create(publicCode),
    title: "Report confermabile",
    description: "Descrizione lunga della segnalazione confermabile.",
    categoryId: "roads",
    location: Location.create({ latitude: 41.4821, longitude: 14.0474, address: "Via Roma" }),
    createdAt: new Date("2026-01-01T10:00:00.000Z")
  });
}

class InMemoryReportConfirmationRepository implements ReportConfirmationRepository {
  readonly confirmations: ReportConfirmation[] = [];

  async create(input: ReportConfirmation): Promise<"created" | "already_exists"> {
    if (await this.exists(input)) {
      return "already_exists";
    }

    this.confirmations.push(input);
    return "created";
  }

  async exists(input: { reportId: string; antiAbuseKey: string }): Promise<boolean> {
    return this.confirmations.some(
      (confirmation) =>
        confirmation.reportId === input.reportId && confirmation.antiAbuseKey === input.antiAbuseKey
    );
  }

  async countByReportId(reportId: string): Promise<number> {
    return this.confirmations.filter((confirmation) => confirmation.reportId === reportId).length;
  }
}

class InMemoryReportRepository implements ReportRepository {
  constructor(private readonly reports: Report[]) {}

  async save(): Promise<void> {}
  async saveWithAttachment(): Promise<void> {}
  async findAttachmentForModeration(): Promise<ReportAttachmentAccess | null> { return null; }
  async findPublicAttachmentByPublicCode(): Promise<ReportAttachmentAccess | null> { return null; }

  async findByPublicCode(publicCode: PublicCodeValue): Promise<Report | null> {
    return this.reports.find((report) => report.toSnapshot().publicCode === publicCode.toString()) ?? null;
  }

  async listForModeration(input: { status?: ReportModerationFilter; limit?: number } = {}): Promise<ReportModerationSummary[]> {
    const status = input.status ?? "pending_review";
    return this.reports
      .filter((report) => status === "all" || report.toSnapshot().moderationStatus === status)
      .slice(0, input.limit ?? 100)
      .map((report) => {
        const snapshot = report.toSnapshot();
        return {
          publicCode: snapshot.publicCode,
          title: snapshot.title,
          categoryName: "Categoria test",
          createdAt: snapshot.createdAt,
          moderationStatus: snapshot.moderationStatus,
          source: snapshot.source,
          ...(snapshot.location.address ? { address: snapshot.location.address } : {})
        };
      });
  }

  async countByModerationStatus(status: ModerationStatus): Promise<number> {
    return this.reports.filter((report) => report.toSnapshot().moderationStatus === status).length;
  }

  async findPublicByPublicCode(): Promise<PublicReportDetail | null> { return null; }
  async listPublicForMap(): Promise<PublicReportMapItem[]> { return []; }
  async findPotentialDuplicates(input: PotentialDuplicateReportQuery): Promise<PotentialDuplicateReportRecord[]> { void input; return []; }
  async listPublicEventsByPublicCode(): Promise<PublicReportTimelineEvent[]> { return []; }
}

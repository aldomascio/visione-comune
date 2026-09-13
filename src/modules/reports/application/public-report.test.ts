import { describe, expect, it } from "vitest";
import { Location, PublicCode, Report, type ModerationStatus, type ReportDomainEvent } from "../domain";
import {
  GetPublicReportTimelineUseCase,
  GetPublicReportUseCase,
  PublicReportNotFoundError,
  TrackReportByPublicCodeUseCase
} from "./public-report";
import type {
  PublicReportDetail,
  PublicReportTimelineEvent,
  ReportModerationFilter,
  ReportModerationSummary,
  ReportRepository
} from "./report-repository";

const approvedAt = new Date("2026-01-02T10:00:00.000Z");

describe("public report tracking", () => {
  it("returns pending state for a valid pending report code", async () => {
    const repository = new InMemoryPublicReportRepository([
      createPendingReport("report-1", "VC-ABC12345")
    ]);
    const useCase = new TrackReportByPublicCodeUseCase({ reportRepository: repository });

    await expect(useCase.execute({ publicCode: "VC-ABC12345" })).resolves.toEqual({
      status: "pending",
      publicCode: "VC-ABC12345"
    });
  });

  it("returns published state for an approved report code", async () => {
    const repository = new InMemoryPublicReportRepository([
      createApprovedReport("report-1", "VC-ABC12345")
    ]);
    const useCase = new TrackReportByPublicCodeUseCase({ reportRepository: repository });

    await expect(useCase.execute({ publicCode: "VC-ABC12345" })).resolves.toEqual({
      status: "published",
      publicCode: "VC-ABC12345"
    });
  });

  it("returns rejected state without exposing rejection details", async () => {
    const repository = new InMemoryPublicReportRepository([
      createRejectedReport("report-1", "VC-ABC12345")
    ]);
    const useCase = new TrackReportByPublicCodeUseCase({ reportRepository: repository });

    await expect(useCase.execute({ publicCode: "VC-ABC12345" })).resolves.toEqual({
      status: "rejected",
      publicCode: "VC-ABC12345"
    });
  });

  it("returns not found for a missing code", async () => {
    const repository = new InMemoryPublicReportRepository([]);
    const useCase = new TrackReportByPublicCodeUseCase({ reportRepository: repository });

    await expect(useCase.execute({ publicCode: "VC-ABC12345" })).resolves.toEqual({
      status: "not_found"
    });
  });

  it("returns invalid code for malformed code", async () => {
    const repository = new InMemoryPublicReportRepository([]);
    const useCase = new TrackReportByPublicCodeUseCase({ reportRepository: repository });

    await expect(useCase.execute({ publicCode: "non valido" })).resolves.toEqual({
      status: "invalid_code"
    });
  });

  it("returns public report detail only for approved reports", async () => {
    const repository = new InMemoryPublicReportRepository([
      createApprovedReport("report-1", "VC-ABC12345"),
      createPendingReport("report-2", "VC-ABC12346")
    ]);
    const useCase = new GetPublicReportUseCase({ reportRepository: repository });

    await expect(useCase.execute({ publicCode: "VC-ABC12345" })).resolves.toMatchObject({
      publicCode: "VC-ABC12345",
      publicStatus: "reported",
      categoryName: "Categoria test"
    });
    await expect(useCase.execute({ publicCode: "VC-ABC12346" })).rejects.toThrow(
      PublicReportNotFoundError
    );
  });

  it("returns only public timeline events without metadata", async () => {
    const repository = new InMemoryPublicReportRepository([
      createApprovedReport("report-1", "VC-ABC12345")
    ]);
    repository.events = [
      {
        type: "ReportRejected",
        reportId: "report-1",
        occurredAt: new Date("2026-01-01T12:00:00.000Z"),
        visibility: "internal",
        metadata: { internalNote: "Non deve uscire" }
      },
      {
        type: "ReportApproved",
        reportId: "report-1",
        occurredAt: approvedAt,
        visibility: "public",
        publicStatus: "reported"
      }
    ];
    const useCase = new GetPublicReportTimelineUseCase({ reportRepository: repository });

    await expect(useCase.execute({ publicCode: "VC-ABC12345" })).resolves.toEqual([
      {
        type: "ReportApproved",
        publicStatus: "reported",
        occurredAt: approvedAt
      }
    ]);
  });
});

class InMemoryPublicReportRepository implements ReportRepository {
  events: ReportDomainEvent[] = [];

  constructor(private readonly reports: Report[]) {}

  async saveWithAttachment(): Promise<void> {}

  async findAttachmentForModeration(): Promise<null> {
    return null;
  }

  async findPublicAttachmentByPublicCode(): Promise<null> {
    return null;
  }

  async save(): Promise<void> {}

  async findByPublicCode(publicCode: PublicCode): Promise<Report | null> {
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
          moderationStatus: snapshot.moderationStatus
        };
      });
  }

  async countByModerationStatus(status: ModerationStatus): Promise<number> {
    return this.reports.filter((report) => report.toSnapshot().moderationStatus === status).length;
  }

  async findPublicByPublicCode(publicCode: PublicCode): Promise<PublicReportDetail | null> {
    const report = await this.findByPublicCode(publicCode);
    const snapshot = report?.toSnapshot();

    if (!snapshot || snapshot.moderationStatus !== "approved" || !snapshot.publicStatus || !snapshot.publishedAt) {
      return null;
    }

    return {
      publicCode: snapshot.publicCode,
      title: snapshot.title,
      description: snapshot.description,
      categoryName: "Categoria test",
      ...(snapshot.location.address ? { address: snapshot.location.address } : {}),
      latitude: snapshot.location.latitude,
      longitude: snapshot.location.longitude,
      publicStatus: snapshot.publicStatus,
      createdAt: snapshot.createdAt,
      publishedAt: snapshot.publishedAt
    };
  }

  async listPublicForMap(): Promise<[]> {
    return [];
  }

  async findPotentialDuplicates(): Promise<[]> {
    return [];
  }

  async listPublicEventsByPublicCode(publicCode: PublicCode): Promise<PublicReportTimelineEvent[]> {
    const report = await this.findByPublicCode(publicCode);

    if (!report?.isPublic()) {
      return [];
    }

    return this.events
      .filter((event) => event.reportId === report.toSnapshot().id && event.visibility === "public")
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
      .map((event) => ({
        type: event.type,
        ...(event.publicStatus ? { publicStatus: event.publicStatus } : {}),
        occurredAt: event.occurredAt
      }));
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
  report.approve(approvedAt);
  report.pullDomainEvents();
  return report;
}

function createRejectedReport(id: string, publicCode: string): Report {
  const report = createPendingReport(id, publicCode);
  report.reject(approvedAt);
  report.pullDomainEvents();
  return report;
}

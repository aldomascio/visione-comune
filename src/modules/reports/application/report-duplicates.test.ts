import { describe, expect, it } from "vitest";
import {
  MarkReportAsDuplicateUseCase,
  RemoveReportDuplicateLinkUseCase,
  ReportDuplicateTargetError,
} from "./report-duplicates";
import {
  type DuplicateReportSummary,
  type PotentialPrimaryReport,
  type ReportDuplicateSaveOptions,
  type ReportRepository,
} from "./report-repository";
import { Location, PublicCode, Report, type ReportDomainEvent } from "../domain";

const createdAt = new Date("2026-01-01T10:00:00.000Z");
const approvedAt = new Date("2026-01-02T10:00:00.000Z");
const markedAt = new Date("2026-01-03T10:00:00.000Z");

function createPendingReport(id: string, publicCode: string): Report {
  return Report.create({
    id,
    publicCode: PublicCode.create(publicCode),
    title: `Report ${publicCode}`,
    description: "Descrizione del report usata nei test duplicati.",
    categoryId: "roads",
    location: Location.create({ latitude: 41.48, longitude: 14.04, address: "Venafro" }),
    createdAt,
  });
}

function createApprovedReport(id: string, publicCode: string): Report {
  const report = createPendingReport(id, publicCode);
  report.pullDomainEvents();
  report.approve(approvedAt);
  report.pullDomainEvents();
  return report;
}

describe("report duplicate use cases", () => {
  it("marks a report as duplicate of a public primary and records an internal event", async () => {
    const duplicate = createPendingReport("duplicate", "VC-DUP00001");
    const primary = createApprovedReport("primary", "VC-PRI00001");
    const repository = new InMemoryDuplicateRepository([duplicate, primary]);

    await new MarkReportAsDuplicateUseCase({ reportRepository: repository, now: () => markedAt }).execute({
      publicCode: "VC-DUP00001",
      primaryPublicCode: "VC-PRI00001",
    });

    expect(duplicate.toSnapshot().duplicateOfReportId).toBe("primary");
    expect(repository.savedEvents).toContainEqual({
      type: "ReportMarkedAsDuplicate",
      reportId: "duplicate",
      occurredAt: markedAt,
      visibility: "internal",
      metadata: {
        primaryReportId: "primary",
        primaryPublicCode: "VC-PRI00001",
      },
    });
  });

  it("does not allow a report to duplicate itself", async () => {
    const report = createApprovedReport("primary", "VC-PRI00001");
    const repository = new InMemoryDuplicateRepository([report]);

    await expect(
      new MarkReportAsDuplicateUseCase({ reportRepository: repository }).execute({
        publicCode: "VC-PRI00001",
        primaryPublicCode: "VC-PRI00001",
      }),
    ).rejects.toThrow(ReportDuplicateTargetError);
  });

  it("rejects a target that is already a duplicate to avoid chains", async () => {
    const duplicate = createPendingReport("duplicate", "VC-DUP00001");
    const primary = createApprovedReport("primary", "VC-PRI00001");
    const chainedTarget = createApprovedReport("target", "VC-TAR00001");
    chainedTarget.markAsDuplicateOf("primary", markedAt, "VC-PRI00001");
    chainedTarget.pullDomainEvents();
    const repository = new InMemoryDuplicateRepository([duplicate, primary, chainedTarget]);

    await expect(
      new MarkReportAsDuplicateUseCase({ reportRepository: repository }).execute({
        publicCode: "VC-DUP00001",
        primaryPublicCode: "VC-TAR00001",
      }),
    ).rejects.toThrow(ReportDuplicateTargetError);
  });

  it("removes a duplicate link with an internal event", async () => {
    const duplicate = createPendingReport("duplicate", "VC-DUP00001");
    const primary = createApprovedReport("primary", "VC-PRI00001");
    duplicate.markAsDuplicateOf("primary", markedAt, "VC-PRI00001");
    duplicate.pullDomainEvents();
    const repository = new InMemoryDuplicateRepository([duplicate, primary]);

    await new RemoveReportDuplicateLinkUseCase({ reportRepository: repository, now: () => markedAt }).execute({
      publicCode: "VC-DUP00001",
    });

    expect(duplicate.toSnapshot().duplicateOfReportId).toBeUndefined();
    expect(repository.savedEvents).toContainEqual({
      type: "ReportDuplicateLinkRemoved",
      reportId: "duplicate",
      occurredAt: markedAt,
      visibility: "internal",
      metadata: {
        primaryReportId: "primary",
        primaryPublicCode: "VC-PRI00001",
      },
    });
  });
});

class InMemoryDuplicateRepository implements ReportRepository {
  savedEvents: ReportDomainEvent[] = [];

  constructor(private readonly reports: Report[]) {}

  async save(): Promise<void> {}
  async saveWithAttachment(): Promise<void> {}

  async saveDuplicateLink(report: Report, events: ReportDomainEvent[], options: ReportDuplicateSaveOptions): Promise<void> {
    void report;
    void options;
    this.savedEvents.push(...events);
  }

  async removeDuplicateLink(report: Report, events: ReportDomainEvent[], options: ReportDuplicateSaveOptions): Promise<void> {
    await this.saveDuplicateLink(report, events, options);
  }

  async findByPublicCode(publicCode: PublicCode): Promise<Report | null> {
    return this.reports.find((report) => report.toSnapshot().publicCode === publicCode.toString()) ?? null;
  }

  async findById(reportId: string): Promise<Report | null> {
    return this.reports.find((report) => report.toSnapshot().id === reportId) ?? null;
  }

  async findAttachmentForModeration(): Promise<null> { return null; }
  async findPublicAttachmentByPublicCode(): Promise<null> { return null; }
  async listForModeration(): Promise<[]> { return []; }
  async searchPotentialPrimaryReports(): Promise<PotentialPrimaryReport[]> { return []; }
  async listDuplicatesOfReport(): Promise<DuplicateReportSummary[]> { return []; }
  async countByModerationStatus(): Promise<number> { return 0; }
  async findPublicByPublicCode(): Promise<null> { return null; }
  async listPublicForMap(): Promise<[]> { return []; }
  async findPotentialDuplicates(): Promise<[]> { return []; }
  async listPublicEventsByPublicCode(): Promise<[]> { return []; }
}

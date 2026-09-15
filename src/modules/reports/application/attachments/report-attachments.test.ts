import { describe, expect, it } from "vitest";
import type { StorageProvider, StoredObject } from "@/modules/storage/application/storage-provider";
import { Location, PublicCode, Report, type ReportDomainEvent } from "../../domain";
import type {
  NewReportAttachment,
  ReportAttachment,
  ReportAttachmentReviewStatus,
  ReportAttachmentType,
  ReportRepository,
} from "../report-repository";
import {
  AddResolutionPhotoUseCase,
  ApproveReportAttachmentUseCase,
  RejectReportAttachmentUseCase,
  ResolutionPhotoNotAllowedError,
} from "./report-attachments";

const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, ...Array(200).fill(0), 0xff, 0xd9]);

describe("report attachment use cases", () => {
  it("adds a resolution photo as pending review", async () => {
    const report = createReport("communicated-report", "VC-ATTAC001");
    report.approve(new Date("2026-01-02T10:00:00.000Z"));
    report.markCommunicated(new Date("2026-01-03T10:00:00.000Z"));
    const repository = new InMemoryAttachmentReportRepository([report]);
    const storageProvider = new FakeStorageProvider();

    await new AddResolutionPhotoUseCase({
      reportRepository: repository,
      storageProvider,
      createId: () => "resolution-attachment-1",
      now: () => new Date("2026-01-04T10:00:00.000Z"),
    }).execute({
      publicCode: "VC-ATTAC001",
      photo: { buffer: await validProcessedInputPng(), mimeType: "image/png" },
    });

    expect(repository.attachments[0]).toMatchObject({
      id: "resolution-attachment-1",
      reportId: "communicated-report",
      type: "resolution_photo",
      reviewStatus: "pending_review",
      storageKey: "stored-1.jpg",
      mimeType: "image/jpeg",
    });
    expect(repository.events.map((event) => event.type)).toContain("ReportAttachmentAdded");
  });

  it("rejects resolution photos for incompatible report states", async () => {
    const report = createReport("reported-report", "VC-ATTAC002");
    report.approve(new Date("2026-01-02T10:00:00.000Z"));
    const repository = new InMemoryAttachmentReportRepository([report]);

    await expect(
      new AddResolutionPhotoUseCase({
        reportRepository: repository,
        storageProvider: new FakeStorageProvider(),
      }).execute({
        publicCode: "VC-ATTAC002",
        photo: { buffer: await validProcessedInputPng(), mimeType: "image/png" },
      }),
    ).rejects.toBeInstanceOf(ResolutionPhotoNotAllowedError);
  });

  it("approves and rejects attachments explicitly", async () => {
    const report = createReport("attachment-report", "VC-ATTAC003");
    const repository = new InMemoryAttachmentReportRepository([report], [
      createAttachment("attachment-report", "report_photo"),
      createAttachment("attachment-report", "resolution_photo"),
    ]);

    await new ApproveReportAttachmentUseCase({
      reportRepository: repository,
      now: () => new Date("2026-01-05T10:00:00.000Z"),
    }).execute({ publicCode: "VC-ATTAC003", attachmentType: "report_photo" });
    await new RejectReportAttachmentUseCase({
      reportRepository: repository,
      now: () => new Date("2026-01-06T10:00:00.000Z"),
    }).execute({ publicCode: "VC-ATTAC003", attachmentType: "resolution_photo" });

    expect(repository.attachments).toContainEqual(expect.objectContaining({ type: "report_photo", reviewStatus: "approved" }));
    expect(repository.attachments).toContainEqual(expect.objectContaining({ type: "resolution_photo", reviewStatus: "rejected" }));
    expect(repository.events.map((event) => event.type)).toEqual(["ReportAttachmentApproved", "ReportAttachmentRejected"]);
  });
});

function createReport(id: string, publicCode: string): Report {
  return Report.create({
    id,
    publicCode: PublicCode.create(publicCode),
    title: "Buca in strada",
    description: "Una buca profonda rende difficile il passaggio vicino alla scuola.",
    categoryId: "category-1",
    location: Location.create({ latitude: 41.4821, longitude: 14.0474 }),
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
  });
}

function createAttachment(reportId: string, type: ReportAttachmentType): ReportAttachment {
  return {
    id: `${reportId}-${type}`,
    reportId,
    type,
    storageKey: `${reportId}-${type}.jpg`,
    mimeType: "image/jpeg",
    size: 1234,
    reviewStatus: "pending_review",
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
  };
}

async function validProcessedInputPng(): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp({
    create: {
      width: 10,
      height: 10,
      channels: 3,
      background: "red",
    },
  })
    .png()
    .toBuffer();
}

class InMemoryAttachmentReportRepository implements ReportRepository {
  readonly events: ReportDomainEvent[] = [];

  constructor(
    private readonly reports: Report[],
    readonly attachments: ReportAttachment[] = [],
  ) {}

  async save(): Promise<void> {}
  async saveWithAttachment(): Promise<void> {}

  async saveAttachment(attachment: NewReportAttachment, events: ReportDomainEvent[] = []): Promise<void> {
    this.attachments.push(attachment);
    this.events.push(...events);
  }

  async updateAttachmentReview(
    input: { reportId: string; attachmentType: ReportAttachmentType; reviewStatus: ReportAttachmentReviewStatus; reviewedAt: Date },
    events: ReportDomainEvent[] = [],
  ): Promise<void> {
    const attachment = this.attachments.find((item) => item.reportId === input.reportId && item.type === input.attachmentType);
    if (attachment) {
      attachment.reviewStatus = input.reviewStatus;
      attachment.reviewedAt = input.reviewedAt;
    }
    this.events.push(...events);
  }

  async findAttachmentByReportAndType(reportId: string, type: ReportAttachmentType): Promise<ReportAttachment | null> {
    return this.attachments.find((attachment) => attachment.reportId === reportId && attachment.type === type) ?? null;
  }

  async listAttachmentsForModeration(): Promise<[]> {
    return [];
  }

  async findAttachmentForModeration(): Promise<null> {
    return null;
  }

  async findPublicAttachmentByPublicCode(): Promise<null> {
    return null;
  }

  async findByPublicCode(publicCode: PublicCode): Promise<Report | null> {
    return this.reports.find((report) => report.toSnapshot().publicCode === publicCode.toString()) ?? null;
  }

  async listForModeration(): Promise<[]> { return []; }
  async countByModerationStatus(): Promise<number> { return 0; }
  async findPublicByPublicCode(): Promise<null> { return null; }
  async listPublicForMap(): Promise<[]> { return []; }
  async findPotentialDuplicates(): Promise<[]> { return []; }
  async listPublicEventsByPublicCode(): Promise<[]> { return []; }
}

class FakeStorageProvider implements StorageProvider {
  async save(input: { buffer: Buffer; extension: string }): Promise<StoredObject> {
    return { storageKey: `stored-1.${input.extension}`, size: input.buffer.byteLength };
  }

  async read(): Promise<Buffer> {
    return validJpeg;
  }

  async delete(): Promise<void> {}
}

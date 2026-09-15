import { randomUUID } from "node:crypto";
import type { StorageProvider } from "@/modules/storage/application/storage-provider";
import {
  InvalidPublicCodeError,
  PublicCode,
  type PublicReportStatus,
  type ReportDomainEvent,
} from "../../domain";
import {
  type ReportAttachmentType,
  type ReportRepository,
} from "../report-repository";
import {
  mapReportImageErrorToMessage,
  processReportImage,
} from "./report-image-processing";

export class InvalidAttachmentPublicCodeError extends Error {
  constructor(publicCode: string) {
    super(`Invalid attachment public code: ${publicCode}`);
    this.name = "InvalidAttachmentPublicCodeError";
  }
}

export class ReportForAttachmentNotFoundError extends Error {
  constructor(publicCode: string) {
    super(`Report not found for attachment: ${publicCode}`);
    this.name = "ReportForAttachmentNotFoundError";
  }
}

export class ReportAttachmentNotFoundError extends Error {
  constructor(readonly attachmentType: ReportAttachmentType) {
    super(`Report attachment not found: ${attachmentType}`);
    this.name = "ReportAttachmentNotFoundError";
  }
}

export class ReportAttachmentConflictError extends Error {
  constructor(readonly attachmentType: ReportAttachmentType) {
    super(`Report already has attachment type: ${attachmentType}`);
    this.name = "ReportAttachmentConflictError";
  }
}

export class ReportAttachmentRepositoryUnsupportedError extends Error {
  constructor() {
    super("Report repository does not support attachments.");
    this.name = "ReportAttachmentRepositoryUnsupportedError";
  }
}

export class ResolutionPhotoNotAllowedError extends Error {
  constructor(message = "La foto di risoluzione e disponibile solo per segnalazioni Comunicate o Risolte.") {
    super(message);
    this.name = "ResolutionPhotoNotAllowedError";
  }
}

export type AddResolutionPhotoInput = {
  publicCode: string;
  photo: { buffer: Buffer; mimeType?: string };
};

export type AddResolutionPhotoUseCaseDependencies = {
  reportRepository: ReportRepository;
  storageProvider: StorageProvider;
  now?: () => Date;
  createId?: () => string;
};

export class AddResolutionPhotoUseCase {
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(private readonly dependencies: AddResolutionPhotoUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.createId = dependencies.createId ?? randomUUID;
  }

  async execute(input: AddResolutionPhotoInput): Promise<void> {
    const publicCode = parseAttachmentPublicCode(input.publicCode);
    const report = await this.dependencies.reportRepository.findByPublicCode(publicCode);

    if (!report) {
      throw new ReportForAttachmentNotFoundError(publicCode.toString());
    }

    const snapshot = report.toSnapshot();
    assertResolutionPhotoAllowed(snapshot.moderationStatus, snapshot.publicStatus);

    const findAttachmentByReportAndType = this.dependencies.reportRepository.findAttachmentByReportAndType;
    const saveAttachment = this.dependencies.reportRepository.saveAttachment;

    if (!findAttachmentByReportAndType || !saveAttachment) {
      throw new ReportAttachmentRepositoryUnsupportedError();
    }

    const existingAttachment = await findAttachmentByReportAndType.call(
      this.dependencies.reportRepository,
      snapshot.id,
      "resolution_photo",
    );

    if (existingAttachment) {
      throw new ReportAttachmentConflictError("resolution_photo");
    }

    const processedPhoto = await processReportImage({
      buffer: input.photo.buffer,
      declaredMimeType: input.photo.mimeType,
    });
    let savedStorageKey: string | undefined;

    try {
      const storedPhoto = await this.dependencies.storageProvider.save({
        buffer: processedPhoto.buffer,
        extension: processedPhoto.extension,
      });
      savedStorageKey = storedPhoto.storageKey;
      const attachmentId = this.createId();
      const occurredAt = this.now();

      await saveAttachment.call(
        this.dependencies.reportRepository,
        {
          id: attachmentId,
          reportId: snapshot.id,
          type: "resolution_photo",
          storageKey: storedPhoto.storageKey,
          mimeType: processedPhoto.mimeType,
          size: storedPhoto.size,
          reviewStatus: "pending_review",
          createdAt: occurredAt,
        },
        [createAttachmentEvent("ReportAttachmentAdded", snapshot.id, occurredAt, attachmentId, "resolution_photo")],
      );
    } catch (error) {
      if (savedStorageKey) {
        await this.dependencies.storageProvider.delete(savedStorageKey);
      }

      throw error;
    }
  }
}

export type ReviewReportAttachmentInput = {
  publicCode: string;
  attachmentType: ReportAttachmentType;
};

export type ReviewReportAttachmentUseCaseDependencies = {
  reportRepository: ReportRepository;
  now?: () => Date;
};

export class ApproveReportAttachmentUseCase {
  private readonly now: () => Date;

  constructor(private readonly dependencies: ReviewReportAttachmentUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async execute(input: ReviewReportAttachmentInput): Promise<void> {
    await reviewAttachment({
      ...input,
      reportRepository: this.dependencies.reportRepository,
      now: this.now,
      reviewStatus: "approved",
      eventType: "ReportAttachmentApproved",
    });
  }
}

export class RejectReportAttachmentUseCase {
  private readonly now: () => Date;

  constructor(private readonly dependencies: ReviewReportAttachmentUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async execute(input: ReviewReportAttachmentInput): Promise<void> {
    await reviewAttachment({
      ...input,
      reportRepository: this.dependencies.reportRepository,
      now: this.now,
      reviewStatus: "rejected",
      eventType: "ReportAttachmentRejected",
    });
  }
}

export function parseReportAttachmentType(value: string): ReportAttachmentType | null {
  return value === "report_photo" || value === "resolution_photo" ? value : null;
}

export function mapReportAttachmentErrorToMessage(error: unknown): string {
  if (error instanceof ResolutionPhotoNotAllowedError) {
    return error.message;
  }

  if (error instanceof ReportAttachmentConflictError) {
    return "Esiste gia una foto per questa sezione.";
  }

  if (error instanceof ReportAttachmentNotFoundError) {
    return "La foto richiesta non e disponibile.";
  }

  if (error instanceof ReportForAttachmentNotFoundError || error instanceof InvalidAttachmentPublicCodeError) {
    return "Segnalazione non trovata.";
  }

  return mapReportImageErrorToMessage(error);
}

function parseAttachmentPublicCode(value: string): PublicCode {
  try {
    return PublicCode.create(value.trim().toUpperCase());
  } catch (error) {
    if (error instanceof InvalidPublicCodeError) {
      throw new InvalidAttachmentPublicCodeError(value);
    }

    throw error;
  }
}

function assertResolutionPhotoAllowed(
  moderationStatus: string,
  publicStatus: PublicReportStatus | undefined,
): void {
  if (moderationStatus !== "approved") {
    throw new ResolutionPhotoNotAllowedError();
  }

  if (publicStatus !== "communicated" && publicStatus !== "resolved") {
    throw new ResolutionPhotoNotAllowedError();
  }
}

async function reviewAttachment(input: ReviewReportAttachmentInput & {
  reportRepository: ReportRepository;
  now: () => Date;
  reviewStatus: "approved" | "rejected";
  eventType: "ReportAttachmentApproved" | "ReportAttachmentRejected";
}): Promise<void> {
  const publicCode = parseAttachmentPublicCode(input.publicCode);
  const report = await input.reportRepository.findByPublicCode(publicCode);

  if (!report) {
    throw new ReportForAttachmentNotFoundError(publicCode.toString());
  }

  const snapshot = report.toSnapshot();
  const findAttachmentByReportAndType = input.reportRepository.findAttachmentByReportAndType;
  const updateAttachmentReview = input.reportRepository.updateAttachmentReview;

  if (!findAttachmentByReportAndType || !updateAttachmentReview) {
    throw new ReportAttachmentRepositoryUnsupportedError();
  }

  const attachment = await findAttachmentByReportAndType.call(
    input.reportRepository,
    snapshot.id,
    input.attachmentType,
  );

  if (!attachment) {
    throw new ReportAttachmentNotFoundError(input.attachmentType);
  }

  const occurredAt = input.now();
  await updateAttachmentReview.call(
    input.reportRepository,
    {
      reportId: snapshot.id,
      attachmentType: input.attachmentType,
      reviewStatus: input.reviewStatus,
      reviewedAt: occurredAt,
    },
    [createAttachmentEvent(input.eventType, snapshot.id, occurredAt, attachment.id, input.attachmentType)],
  );
}

function createAttachmentEvent(
  type: "ReportAttachmentAdded" | "ReportAttachmentApproved" | "ReportAttachmentRejected",
  reportId: string,
  occurredAt: Date,
  attachmentId: string,
  attachmentType: ReportAttachmentType,
): ReportDomainEvent {
  return {
    type,
    reportId,
    occurredAt,
    visibility: "internal",
    metadata: { attachmentId, attachmentType },
  };
}

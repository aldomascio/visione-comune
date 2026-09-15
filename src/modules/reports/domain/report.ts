import {
  InconsistentReportStateError,
  InvalidReportDataError,
  InvalidReportTransitionError,
} from "./errors";
import { Location, type LocationSnapshot } from "./location";
import { PublicCode } from "./public-code";
import type { ReportDomainEvent } from "./report-events";
import type { ReportSource } from "./report-source";
import type { ModerationStatus, PublicReportStatus } from "./report-status";

export type ReportId = string;
export type CategoryId = string;

export type ReportSnapshot = {
  id: ReportId;
  publicCode: string;
  title: string;
  description: string;
  categoryId: CategoryId;
  source: ReportSource;
  createdByAdminId?: string;
  duplicateOfReportId?: ReportId;
  location: LocationSnapshot;
  publicStatus?: PublicReportStatus;
  moderationStatus: ModerationStatus;
  createdAt: Date;
  publishedAt?: Date;
  communicatedAt?: Date;
  resolvedAt?: Date;
};

export type CreateReportInput = {
  id: ReportId;
  publicCode: PublicCode;
  title: string;
  description: string;
  categoryId: CategoryId;
  source?: ReportSource;
  createdByAdminId?: string;
  location: Location;
  createdAt?: Date;
};

export class Report {
  private readonly events: ReportDomainEvent[];

  private constructor(
    private state: ReportSnapshot,
    events: ReportDomainEvent[] = [],
  ) {
    this.events = events;
    this.ensureStateIsConsistent();
  }

  static create(input: CreateReportInput): Report {
    const createdAt = input.createdAt ?? new Date();
    const report = new Report(
      {
        id: requireText(input.id, "Report id"),
        publicCode: input.publicCode.toString(),
        title: requireText(input.title, "Report title"),
        description: requireText(input.description, "Report description"),
        categoryId: requireText(input.categoryId, "Report category"),
        source: input.source ?? "platform",
        ...(input.createdByAdminId
          ? {
              createdByAdminId: requireText(
                input.createdByAdminId,
                "Report creator admin id",
              ),
            }
          : {}),
        location: input.location.toSnapshot(),
        moderationStatus: "pending_review",
        createdAt,
      },
      [
        {
          type: "ReportCreated",
          reportId: input.id,
          occurredAt: createdAt,
          visibility: "internal",
          metadata: {
            source: input.source ?? "platform",
            ...(input.createdByAdminId
              ? { createdByAdminId: input.createdByAdminId }
              : {}),
          },
        },
      ],
    );

    return report;
  }

  static restore(snapshot: ReportSnapshot): Report {
    return new Report({
      ...snapshot,
      title: requireText(snapshot.title, "Report title"),
      description: requireText(snapshot.description, "Report description"),
      categoryId: requireText(snapshot.categoryId, "Report category"),
      source: snapshot.source,
      ...(snapshot.createdByAdminId
        ? {
            createdByAdminId: requireText(
              snapshot.createdByAdminId,
              "Report creator admin id",
            ),
          }
        : {}),
      ...(snapshot.duplicateOfReportId
        ? {
            duplicateOfReportId: requireText(
              snapshot.duplicateOfReportId,
              "Primary report id",
            ),
          }
        : {}),
      publicCode: PublicCode.create(snapshot.publicCode).toString(),
      location: Location.create(snapshot.location).toSnapshot(),
    });
  }

  approve(approvedAt: Date = new Date()): void {
    if (this.state.moderationStatus === "approved") {
      throw new InvalidReportTransitionError("Report is already approved.");
    }

    if (this.state.moderationStatus === "rejected") {
      throw new InvalidReportTransitionError(
        "Rejected reports cannot be approved.",
      );
    }

    this.state = {
      ...this.state,
      moderationStatus: "approved",
      publicStatus: "reported",
      publishedAt: approvedAt,
    };
    this.recordEvent("ReportApproved", approvedAt, "public", "reported");
  }

  reject(rejectedAt: Date = new Date()): void {
    if (this.state.moderationStatus === "approved") {
      throw new InvalidReportTransitionError(
        "Approved reports cannot be rejected.",
      );
    }

    if (this.state.moderationStatus === "rejected") {
      throw new InvalidReportTransitionError("Report is already rejected.");
    }

    this.state = {
      ...this.state,
      moderationStatus: "rejected",
    };
    this.recordEvent("ReportRejected", rejectedAt, "internal");
  }

  markCommunicated(communicatedAt: Date = new Date()): void {
    if (
      this.state.moderationStatus !== "approved" ||
      this.state.publicStatus !== "reported"
    ) {
      throw new InvalidReportTransitionError(
        "Only approved reports in Segnalata status can become Comunicata.",
      );
    }

    this.state = {
      ...this.state,
      publicStatus: "communicated",
      communicatedAt,
    };
    this.recordEvent(
      "ReportCommunicated",
      communicatedAt,
      "public",
      "communicated",
    );
  }

  markResolved(resolvedAt: Date = new Date()): void {
    if (
      this.state.moderationStatus !== "approved" ||
      this.state.publicStatus !== "communicated"
    ) {
      throw new InvalidReportTransitionError(
        "Only communicated reports can become Risolta.",
      );
    }

    this.state = {
      ...this.state,
      publicStatus: "resolved",
      resolvedAt,
    };
    this.recordEvent("ReportResolved", resolvedAt, "public", "resolved");
  }

  markAsDuplicateOf(
    primaryReportId: ReportId,
    markedAt: Date = new Date(),
    primaryPublicCode?: string,
  ): void {
    const normalizedPrimaryReportId = requireText(
      primaryReportId,
      "Primary report id",
    );

    if (normalizedPrimaryReportId === this.state.id) {
      throw new InvalidReportTransitionError(
        "A report cannot be marked as duplicate of itself.",
      );
    }

    if (this.state.duplicateOfReportId === normalizedPrimaryReportId) {
      throw new InvalidReportTransitionError(
        "Report is already linked to this primary report.",
      );
    }

    this.state = {
      ...this.state,
      duplicateOfReportId: normalizedPrimaryReportId,
    };
    this.events.push({
      type: "ReportMarkedAsDuplicate",
      reportId: this.state.id,
      occurredAt: markedAt,
      visibility: "internal",
      metadata: {
        primaryReportId: normalizedPrimaryReportId,
        ...(primaryPublicCode ? { primaryPublicCode } : {}),
      },
    });
  }

  removeDuplicateLink(
    removedAt: Date = new Date(),
    previousPrimaryReportId?: ReportId,
    previousPrimaryPublicCode?: string,
  ): void {
    const existingPrimaryReportId = this.state.duplicateOfReportId;

    if (!existingPrimaryReportId) {
      throw new InvalidReportTransitionError(
        "Report is not linked as duplicate.",
      );
    }

    this.state = {
      ...this.state,
      duplicateOfReportId: undefined,
    };
    this.events.push({
      type: "ReportDuplicateLinkRemoved",
      reportId: this.state.id,
      occurredAt: removedAt,
      visibility: "internal",
      metadata: {
        primaryReportId: previousPrimaryReportId ?? existingPrimaryReportId,
        ...(previousPrimaryPublicCode
          ? { primaryPublicCode: previousPrimaryPublicCode }
          : {}),
      },
    });
  }

  isDuplicate(): boolean {
    return this.state.duplicateOfReportId !== undefined;
  }

  isPublic(): boolean {
    return (
      this.state.moderationStatus === "approved" &&
      this.state.publicStatus !== undefined
    );
  }

  pullDomainEvents(): ReportDomainEvent[] {
    const pendingEvents = [...this.events];
    this.events.length = 0;

    return pendingEvents;
  }

  toSnapshot(): ReportSnapshot {
    return {
      ...this.state,
      location: { ...this.state.location },
    };
  }

  private recordEvent(
    type: ReportDomainEvent["type"],
    occurredAt: Date,
    visibility: ReportDomainEvent["visibility"],
    publicStatus?: PublicReportStatus,
  ): void {
    this.events.push({
      type,
      reportId: this.state.id,
      occurredAt,
      visibility,
      ...(publicStatus ? { publicStatus } : {}),
    });
  }

  private ensureStateIsConsistent(): void {
    if (this.state.duplicateOfReportId === this.state.id) {
      throw new InconsistentReportStateError(
        "A report cannot be duplicate of itself.",
      );
    }

    if (
      this.state.moderationStatus !== "approved" &&
      this.state.publicStatus !== undefined
    ) {
      throw new InconsistentReportStateError(
        "Only approved reports can have a public status.",
      );
    }

    if (
      this.state.moderationStatus === "approved" &&
      this.state.publicStatus === undefined
    ) {
      throw new InconsistentReportStateError(
        "Approved reports must have a public status.",
      );
    }

    if (
      this.state.publicStatus === "reported" &&
      this.state.publishedAt === undefined
    ) {
      throw new InconsistentReportStateError(
        "Published reports must have a published date.",
      );
    }

    if (
      this.state.publicStatus === "communicated" &&
      this.state.communicatedAt === undefined
    ) {
      throw new InconsistentReportStateError(
        "Communicated reports must have a communicated date.",
      );
    }

    if (
      this.state.publicStatus === "resolved" &&
      this.state.resolvedAt === undefined
    ) {
      throw new InconsistentReportStateError(
        "Resolved reports must have a resolved date.",
      );
    }
  }
}

function requireText(value: string, fieldName: string): string {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new InvalidReportDataError(`${fieldName} is required.`);
  }

  return normalizedValue;
}

import { describe, expect, it } from "vitest";
import {
  InconsistentReportStateError,
  InvalidLocationError,
  InvalidPublicCodeError,
  InvalidReportDataError,
  InvalidReportTransitionError,
  Location,
  PublicCode,
  Report
} from ".";

const createdAt = new Date("2026-01-01T10:00:00.000Z");
const approvedAt = new Date("2026-01-02T10:00:00.000Z");
const communicatedAt = new Date("2026-01-03T10:00:00.000Z");
const resolvedAt = new Date("2026-01-04T10:00:00.000Z");

function createReport(): Report {
  return Report.create({
    id: "report-1",
    publicCode: PublicCode.create("VC-ABC12345"),
    title: "Buche in strada",
    description: "Sono presenti buche profonde vicino alla scuola.",
    categoryId: "roads",
    location: Location.create({
      latitude: 41.4821,
      longitude: 14.0474,
      address: "Via Roma, Venafro"
    }),
    createdAt
  });
}

describe("Report domain", () => {
  it("creates a new report as pending review and not public", () => {
    const report = createReport();

    expect(report.toSnapshot()).toMatchObject({
      id: "report-1",
      publicCode: "VC-ABC12345",
      title: "Buche in strada",
      description: "Sono presenti buche profonde vicino alla scuola.",
      categoryId: "roads",
      source: "platform",
      moderationStatus: "pending_review",
      createdAt
    });
    expect(report.toSnapshot().publicStatus).toBeUndefined();
    expect(report.toSnapshot().createdByAdminId).toBeUndefined();
    expect(report.toSnapshot().publishedAt).toBeUndefined();
    expect(report.isPublic()).toBe(false);
  });

  it("records a creation event for future timeline use", () => {
    const report = createReport();

    expect(report.pullDomainEvents()).toEqual([
      {
        type: "ReportCreated",
        reportId: "report-1",
        occurredAt: createdAt,
        visibility: "internal",
        metadata: { source: "platform" }
      }
    ]);
    expect(report.pullDomainEvents()).toEqual([]);
  });

  it("preserves the admin creator id for manually created reports", () => {
    const report = Report.create({
      id: "report-1",
      publicCode: PublicCode.create("VC-ABC12345"),
      title: "Buche in strada",
      description: "Sono presenti buche profonde vicino alla scuola.",
      categoryId: "roads",
      source: "email",
      createdByAdminId: "admin-1",
      location: Location.create({
        latitude: 41.4821,
        longitude: 14.0474,
        address: "Via Roma, Venafro"
      }),
      createdAt
    });

    expect(report.toSnapshot()).toMatchObject({
      source: "email",
      createdByAdminId: "admin-1",
      moderationStatus: "pending_review"
    });
    expect(report.pullDomainEvents()).toMatchObject([
      {
        type: "ReportCreated",
        visibility: "internal",
        metadata: { source: "email", createdByAdminId: "admin-1" }
      }
    ]);
  });

  it("approves a pending report and publishes it as Segnalata", () => {
    const report = createReport();
    report.pullDomainEvents();

    report.approve(approvedAt);

    expect(report.toSnapshot()).toMatchObject({
      moderationStatus: "approved",
      publicStatus: "reported",
      publishedAt: approvedAt
    });
    expect(report.isPublic()).toBe(true);
    expect(report.pullDomainEvents()).toEqual([
      {
        type: "ReportApproved",
        reportId: "report-1",
        occurredAt: approvedAt,
        visibility: "public",
        publicStatus: "reported"
      }
    ]);
  });

  it("rejects a pending report without making it public", () => {
    const report = createReport();
    report.pullDomainEvents();

    report.reject(approvedAt);

    expect(report.toSnapshot()).toMatchObject({
      moderationStatus: "rejected"
    });
    expect(report.toSnapshot().publicStatus).toBeUndefined();
    expect(report.isPublic()).toBe(false);
    expect(report.pullDomainEvents()).toEqual([
      {
        type: "ReportRejected",
        reportId: "report-1",
        occurredAt: approvedAt,
        visibility: "internal"
      }
    ]);
  });

  it("moves from Segnalata to Comunicata only after approval", () => {
    const report = createReport();

    expect(() => report.markCommunicated(communicatedAt)).toThrow(
      InvalidReportTransitionError
    );

    report.approve(approvedAt);
    report.markCommunicated(communicatedAt);

    expect(report.toSnapshot()).toMatchObject({
      moderationStatus: "approved",
      publicStatus: "communicated",
      communicatedAt
    });
  });

  it("moves from Comunicata to Risolta", () => {
    const report = createReport();

    report.approve(approvedAt);
    report.markCommunicated(communicatedAt);
    report.pullDomainEvents();
    report.markResolved(resolvedAt);

    expect(report.toSnapshot()).toMatchObject({
      publicStatus: "resolved",
      resolvedAt
    });
    expect(report.pullDomainEvents()).toEqual([
      {
        type: "ReportResolved",
        reportId: "report-1",
        occurredAt: resolvedAt,
        visibility: "public",
        publicStatus: "resolved"
      }
    ]);
  });

  it("does not allow resolving a report before it is communicated", () => {
    const report = createReport();

    report.approve(approvedAt);

    expect(() => report.markResolved(resolvedAt)).toThrow(InvalidReportTransitionError);
  });

  it("does not allow rejected reports to become public", () => {
    const report = createReport();

    report.reject(approvedAt);

    expect(() => report.approve(communicatedAt)).toThrow(InvalidReportTransitionError);
    expect(() => report.markCommunicated(communicatedAt)).toThrow(
      InvalidReportTransitionError
    );
    expect(report.isPublic()).toBe(false);
  });

  it("does not allow impossible moderation transitions", () => {
    const approvedReport = createReport();
    approvedReport.approve(approvedAt);

    expect(() => approvedReport.reject(communicatedAt)).toThrow(
      InvalidReportTransitionError
    );

    const rejectedReport = createReport();
    rejectedReport.reject(approvedAt);

    expect(() => rejectedReport.reject(communicatedAt)).toThrow(
      InvalidReportTransitionError
    );
  });


  it("marks and unlinks duplicate reports without changing public status", () => {
    const report = createReport();
    report.approve(approvedAt);
    report.pullDomainEvents();

    report.markAsDuplicateOf("primary-report", communicatedAt, "VC-PRIMARY1");

    expect(report.toSnapshot()).toMatchObject({
      duplicateOfReportId: "primary-report",
      publicStatus: "reported"
    });
    expect(report.pullDomainEvents()).toEqual([
      {
        type: "ReportMarkedAsDuplicate",
        reportId: "report-1",
        occurredAt: communicatedAt,
        visibility: "internal",
        metadata: {
          primaryReportId: "primary-report",
          primaryPublicCode: "VC-PRIMARY1"
        }
      }
    ]);

    report.removeDuplicateLink(resolvedAt, "primary-report", "VC-PRIMARY1");

    expect(report.toSnapshot().duplicateOfReportId).toBeUndefined();
    expect(report.pullDomainEvents()).toEqual([
      {
        type: "ReportDuplicateLinkRemoved",
        reportId: "report-1",
        occurredAt: resolvedAt,
        visibility: "internal",
        metadata: {
          primaryReportId: "primary-report",
          primaryPublicCode: "VC-PRIMARY1"
        }
      }
    ]);
  });

  it("does not allow a report to duplicate itself", () => {
    const report = createReport();

    expect(() => report.markAsDuplicateOf("report-1", communicatedAt)).toThrow(
      InvalidReportTransitionError
    );
  });

  it("restores consistent report snapshots", () => {
    const report = Report.restore({
      id: "report-2",
      publicCode: "VC-XYZ98765",
      title: "Lampione spento",
      description: "Il lampione non funziona da giorni.",
      categoryId: "lighting",
      source: "platform",
      location: {
        latitude: 41,
        longitude: 14
      },
      moderationStatus: "approved",
      publicStatus: "reported",
      createdAt,
      publishedAt: approvedAt
    });

    expect(report.toSnapshot().publicCode).toBe("VC-XYZ98765");
    expect(report.isPublic()).toBe(true);
    expect(report.pullDomainEvents()).toEqual([]);
  });

  it("rejects inconsistent restored state", () => {
    expect(() =>
      Report.restore({
        id: "report-2",
        publicCode: "VC-XYZ98765",
        title: "Lampione spento",
        description: "Il lampione non funziona da giorni.",
        categoryId: "lighting",
        source: "platform",
        location: {
          latitude: 41,
          longitude: 14
        },
        moderationStatus: "pending_review",
        publicStatus: "reported",
        createdAt,
        publishedAt: approvedAt
      })
    ).toThrow(InconsistentReportStateError);
  });

  it("requires core report text fields", () => {
    expect(() =>
      Report.create({
        id: "report-1",
        publicCode: PublicCode.create("VC-ABC12345"),
        title: " ",
        description: "Sono presenti buche profonde vicino alla scuola.",
        categoryId: "roads",
        location: Location.create({ latitude: 41, longitude: 14 }),
        createdAt
      })
    ).toThrow(InvalidReportDataError);
  });
});

describe("PublicCode", () => {
  it("normalizes and validates a stable public code format", () => {
    const publicCode = PublicCode.create(" vc-abc12345 ");

    expect(publicCode.toString()).toBe("VC-ABC12345");
    expect(PublicCode.isValid("VC-ABC12345")).toBe(true);
  });

  it("does not create invalid public codes", () => {
    expect(() => PublicCode.create("ABC12345")).toThrow(InvalidPublicCodeError);
    expect(() => PublicCode.create("VC-123")).toThrow(InvalidPublicCodeError);
    expect(() => PublicCode.create("VC-abc_1234")).toThrow(InvalidPublicCodeError);
  });
});

describe("Location", () => {
  it("stores valid coordinates and optional address", () => {
    const location = Location.create({
      latitude: 41.4821,
      longitude: 14.0474,
      address: "  Via Roma, Venafro  "
    });

    expect(location.toSnapshot()).toEqual({
      latitude: 41.4821,
      longitude: 14.0474,
      address: "Via Roma, Venafro"
    });
  });

  it("allows a location without an address", () => {
    const location = Location.create({
      latitude: 41.4821,
      longitude: 14.0474
    });

    expect(location.toSnapshot()).toEqual({
      latitude: 41.4821,
      longitude: 14.0474
    });
  });

  it("rejects invalid coordinates", () => {
    expect(() => Location.create({ latitude: 91, longitude: 14 })).toThrow(
      InvalidLocationError
    );
    expect(() => Location.create({ latitude: 41, longitude: 181 })).toThrow(
      InvalidLocationError
    );
    expect(() => Location.create({ latitude: Number.NaN, longitude: 14 })).toThrow(
      InvalidLocationError
    );
  });
});


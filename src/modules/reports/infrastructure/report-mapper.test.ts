import { describe, expect, it } from "vitest";
import { Location, PublicCode, Report } from "../domain";
import {
  recordToReport,
  recordToReportEvent,
  reportEventToRecord,
  reportToRecord
} from "./report-mapper";

const createdAt = new Date("2026-01-01T10:00:00.000Z");
const approvedAt = new Date("2026-01-02T10:00:00.000Z");
const communicatedAt = new Date("2026-01-03T10:00:00.000Z");

function createPendingReport(): Report {
  return Report.create({
    id: "report-1",
    publicCode: PublicCode.create("VC-ABC12345"),
    title: "Buche in strada",
    description: "Sono presenti buche profonde vicino alla scuola.",
    categoryId: "roads",
    location: Location.create({
      latitude: 41.4821,
      longitude: 14.0474,
      address: "Via Roma"
    }),
    createdAt
  });
}

describe("report mapper", () => {
  it("maps a domain report to a database record", () => {
    const report = createPendingReport();

    expect(reportToRecord(report)).toEqual({
      id: "report-1",
      publicCode: "VC-ABC12345",
      title: "Buche in strada",
      description: "Sono presenti buche profonde vicino alla scuola.",
      categoryId: "roads",
      source: "platform",
      createdByAdminId: null,
      duplicateOfReportId: null,
      latitude: 41.4821,
      longitude: 14.0474,
      address: "Via Roma",
      publicStatus: null,
      moderationStatus: "pending_review",
      createdAt,
      publishedAt: null,
      communicatedAt: null,
      resolvedAt: null
    });
  });

  it("maps approved and communicated state with dates", () => {
    const report = createPendingReport();

    report.approve(approvedAt);
    report.markCommunicated(communicatedAt);

    expect(reportToRecord(report)).toMatchObject({
      publicStatus: "communicated",
      moderationStatus: "approved",
      publishedAt: approvedAt,
      communicatedAt
    });
  });

  it("maps a database record back to a domain report", () => {
    const report = recordToReport({
      id: "report-1",
      publicCode: "VC-ABC12345",
      title: "Buche in strada",
      description: "Sono presenti buche profonde vicino alla scuola.",
      categoryId: "roads",
      source: "platform",
      createdByAdminId: null,
      duplicateOfReportId: null,
      latitude: 41.4821,
      longitude: 14.0474,
      address: null,
      publicStatus: null,
      moderationStatus: "pending_review",
      createdAt,
      publishedAt: null,
      communicatedAt: null,
      resolvedAt: null
    });

    expect(report.toSnapshot()).toEqual({
      id: "report-1",
      publicCode: "VC-ABC12345",
      title: "Buche in strada",
      description: "Sono presenti buche profonde vicino alla scuola.",
      categoryId: "roads",
      source: "platform",
      location: {
        latitude: 41.4821,
        longitude: 14.0474
      },
      moderationStatus: "pending_review",
      createdAt
    });
  });

  it("maps domain events to database records and back", () => {
    const report = createPendingReport();
    const [event] = report.pullDomainEvents();

    if (!event) {
      throw new Error("Expected ReportCreated event.");
    }

    const record = reportEventToRecord(event);

    expect(record).toMatchObject({
      reportId: "report-1",
      type: "ReportCreated",
      visibility: "internal",
      publicStatus: null,
      metadata: { source: "platform" },
      createdAt
    });
    expect(record.id.length).toBeGreaterThan(0);
    expect(
      recordToReportEvent({
        ...record,
        publicStatus: record.publicStatus ?? null,
        metadata: record.metadata ?? null
      })
    ).toEqual(event);
  });
});

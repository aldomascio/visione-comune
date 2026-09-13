import { randomUUID } from "node:crypto";
import {
  Location,
  PublicCode,
  Report,
  type ReportDomainEvent,
  type ReportSnapshot
} from "../domain";
import type {
  NewReportEventRecord,
  NewReportRecord,
  ReportEventRecord,
  ReportRecord
} from "@/shared/db/schema";

export function reportToRecord(report: Report): NewReportRecord {
  const snapshot = report.toSnapshot();

  return {
    id: snapshot.id,
    publicCode: snapshot.publicCode,
    title: snapshot.title,
    description: snapshot.description,
    categoryId: snapshot.categoryId,
    latitude: snapshot.location.latitude,
    longitude: snapshot.location.longitude,
    address: snapshot.location.address ?? null,
    publicStatus: snapshot.publicStatus ?? null,
    moderationStatus: snapshot.moderationStatus,
    createdAt: snapshot.createdAt,
    publishedAt: snapshot.publishedAt ?? null,
    communicatedAt: snapshot.communicatedAt ?? null,
    resolvedAt: snapshot.resolvedAt ?? null
  };
}

export function recordToReport(record: ReportRecord): Report {
  return Report.restore(recordToReportSnapshot(record));
}

export function recordToReportSnapshot(record: ReportRecord): ReportSnapshot {
  return {
    id: record.id,
    publicCode: PublicCode.create(record.publicCode).toString(),
    title: record.title,
    description: record.description,
    categoryId: record.categoryId,
    location: Location.create({
      latitude: record.latitude,
      longitude: record.longitude,
      ...(record.address ? { address: record.address } : {})
    }).toSnapshot(),
    ...(record.publicStatus ? { publicStatus: record.publicStatus } : {}),
    moderationStatus: record.moderationStatus,
    createdAt: record.createdAt,
    ...(record.publishedAt ? { publishedAt: record.publishedAt } : {}),
    ...(record.communicatedAt ? { communicatedAt: record.communicatedAt } : {}),
    ...(record.resolvedAt ? { resolvedAt: record.resolvedAt } : {})
  };
}

export function reportEventToRecord(event: ReportDomainEvent): NewReportEventRecord {
  return {
    id: randomUUID(),
    reportId: event.reportId,
    type: event.type,
    visibility: event.visibility,
    publicStatus: event.publicStatus ?? null,
    metadata: null,
    createdAt: event.occurredAt
  };
}

export function recordToReportEvent(record: ReportEventRecord): ReportDomainEvent {
  return {
    type: record.type,
    reportId: record.reportId,
    occurredAt: record.createdAt,
    visibility: record.visibility,
    ...(record.publicStatus ? { publicStatus: record.publicStatus } : {})
  };
}


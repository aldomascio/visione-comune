import { describe, expect, it } from "vitest";
import { PublicCode, type PublicReportStatus, type ReportEventMetadata, type ReportEventType, type ReportEventVisibility } from "../domain";
import {
  GetAdminReportTimelineUseCase,
  GetPublicReportTimelineUseCase,
  presentAdminTimelineEvent,
  presentPublicTimelineEvent,
  sortTimelineEvents,
  type ReportTimelineEvent,
  type ReportTimelineRepository
} from "./report-timeline";

const reportId = "report-timeline-1";

describe("report timeline", () => {
  it("maps a public approval event to an Italian public item without metadata", () => {
    const item = presentPublicTimelineEvent(
      createTimelineEvent({
        id: "event-approved",
        type: "ReportApproved",
        visibility: "public",
        metadata: { internalNote: "Non deve uscire" }
      })
    );

    expect(item).toEqual({
      id: "event-approved",
      occurredAt: new Date("2026-01-01T10:00:00.000Z"),
      label: "Segnalazione pubblicata",
      description: "Visione Comune ha verificato la segnalazione e l'ha resa pubblica."
    });
    expect(item).not.toHaveProperty("metadata");
  });

  it("does not present internal or rejected events in the public timeline", () => {
    expect(
      presentPublicTimelineEvent(createTimelineEvent({ type: "ReportCreated", visibility: "internal" }))
    ).toBeNull();
    expect(
      presentPublicTimelineEvent(createTimelineEvent({ type: "ReportRejected", visibility: "internal" }))
    ).toBeNull();
  });

  it("presents ReportResolved publicly without exposing internal note metadata", () => {
    const publicItem = presentPublicTimelineEvent(
      createTimelineEvent({
        id: "resolved",
        type: "ReportResolved",
        visibility: "public",
        publicStatus: "resolved",
        metadata: { internalNote: "Sopralluogo completato" }
      })
    );

    expect(publicItem).toEqual({
      id: "resolved",
      occurredAt: new Date("2026-01-01T10:00:00.000Z"),
      label: "Problema risolto",
      description: "Visione Comune ha verificato la risoluzione del problema."
    });
    expect(publicItem).not.toHaveProperty("metadata");

    expect(
      presentAdminTimelineEvent(
        createTimelineEvent({
          type: "ReportResolved",
          visibility: "public",
          publicStatus: "resolved",
          metadata: { internalNote: "Sopralluogo completato" }
        })
      )
    ).toMatchObject({
      label: "Problema risolto",
      visibility: "public",
      note: "Sopralluogo completato"
    });
  });

  it("presents internal notes and known metadata only in the admin timeline", () => {
    const item = presentAdminTimelineEvent(
      createTimelineEvent({
        type: "ReportRejected",
        visibility: "internal",
        metadata: {
          internalNote: "Foto non pertinente",
          recipientName: "Ufficio tecnico",
          unknownTechnicalValue: "non mostrato"
        }
      })
    );

    expect(item).toMatchObject({
      visibility: "internal",
      label: "Segnalazione rifiutata",
      note: "Foto non pertinente",
      metadataItems: [{ label: "Destinatario", value: "Ufficio tecnico" }]
    });
    expect(item.metadataItems).not.toContainEqual({ label: "unknownTechnicalValue", value: "non mostrato" });
  });

  it("orders events by date and then by id for stable timelines", () => {
    const events = [
      createTimelineEvent({ id: "b", occurredAt: new Date("2026-01-01T10:00:00.000Z") }),
      createTimelineEvent({ id: "a", occurredAt: new Date("2026-01-01T10:00:00.000Z") }),
      createTimelineEvent({ id: "c", occurredAt: new Date("2026-01-01T09:00:00.000Z") })
    ];

    expect(sortTimelineEvents(events).map((event) => event.id)).toEqual(["c", "a", "b"]);
  });

  it("returns only safe public items from the public use case", async () => {
    const repository = new InMemoryTimelineRepository([
      createTimelineEvent({ id: "created", type: "ReportCreated", visibility: "internal" }),
      createTimelineEvent({ id: "approved", type: "ReportApproved", visibility: "public" }),
      createTimelineEvent({ id: "rejected", type: "ReportRejected", visibility: "internal", metadata: { internalNote: "No" } })
    ]);
    const useCase = new GetPublicReportTimelineUseCase({ timelineRepository: repository });

    await expect(useCase.execute({ publicCode: "VC-ABC12345" })).resolves.toEqual([
      {
        id: "approved",
        occurredAt: new Date("2026-01-01T10:00:00.000Z"),
        label: "Segnalazione pubblicata",
        description: "Visione Comune ha verificato la segnalazione e l'ha resa pubblica."
      }
    ]);
  });

  it("returns all items from the admin use case", async () => {
    const repository = new InMemoryTimelineRepository([
      createTimelineEvent({ id: "approved", type: "ReportApproved", visibility: "public" }),
      createTimelineEvent({ id: "created", type: "ReportCreated", visibility: "internal", occurredAt: new Date("2026-01-01T09:00:00.000Z") })
    ]);
    const useCase = new GetAdminReportTimelineUseCase({ timelineRepository: repository });

    await expect(useCase.execute({ reportId })).resolves.toMatchObject([
      { id: "created", label: "Segnalazione ricevuta", visibility: "internal" },
      { id: "approved", label: "Segnalazione pubblicata", visibility: "public" }
    ]);
  });
});

class InMemoryTimelineRepository implements ReportTimelineRepository {
  constructor(private readonly events: ReportTimelineEvent[]) {}

  async listTimelineByReportId(inputReportId: string): Promise<ReportTimelineEvent[]> {
    return this.events.filter((event) => event.reportId === inputReportId);
  }

  async listPublicTimelineByPublicCode(publicCode: PublicCode): Promise<ReportTimelineEvent[]> {
    if (publicCode.toString() !== "VC-ABC12345") {
      return [];
    }

    return this.events.filter((event) => event.visibility === "public");
  }
}

function createTimelineEvent(input: {
  id?: string;
  type?: ReportEventType;
  visibility?: ReportEventVisibility;
  publicStatus?: PublicReportStatus;
  metadata?: ReportEventMetadata;
  occurredAt?: Date;
}): ReportTimelineEvent {
  return {
    id: input.id ?? "event-1",
    reportId,
    type: input.type ?? "ReportApproved",
    visibility: input.visibility ?? "public",
    ...(input.publicStatus ? { publicStatus: input.publicStatus } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
    occurredAt: input.occurredAt ?? new Date("2026-01-01T10:00:00.000Z")
  };
}

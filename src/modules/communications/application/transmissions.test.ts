import { describe, expect, it } from "vitest";
import type { NewRecipient, Recipient, RecipientListItem, RecipientRepository, RecipientUpdate } from "@/modules/recipients/application/recipient-repository";
import type { ReportRepository } from "@/modules/reports/application/report-repository";
import { Location, PublicCode, Report, type ReportDomainEvent } from "@/modules/reports/domain";
import type { EligibleTransmissionReport, NewTransmission, Transmission, TransmissionReportSummary, TransmissionRepository } from "./transmission-repository";
import {
  AddReportToTransmissionUseCase,
  CreateTransmissionUseCase,
  MarkTransmissionDeliveredUseCase,
  MarkTransmissionFailedUseCase,
  MarkTransmissionSentUseCase,
  RemoveReportFromTransmissionUseCase,
  buildTransmissionTemplate
} from "./transmissions";

const fixedNow = new Date("2026-02-03T10:00:00.000Z");

describe("transmissions", () => {
  it("builds a deterministic template for multiple reports", () => {
    const template = buildTransmissionTemplate([
      eligibleReport("report-1", "VC-TRNS0001"),
      eligibleReport("report-2", "VC-TRNS0002", { title: "Lampione spento" })
    ], "https://visione.example.test/");

    expect(template.subject).toBe("2 segnalazioni civiche da trasmettere a Visione Comune");
    expect(template.body).toContain("1. VC-TRNS0001 — Buca in strada");
    expect(template.body).toContain("2. VC-TRNS0002 — Lampione spento");
    expect(template.body).toContain("https://visione.example.test/segnalazioni/VC-TRNS0001");
  });

  it("creates a draft transmission with one or more eligible reports", async () => {
    const fixture = createFixture();
    const transmission = await new CreateTransmissionUseCase({
      recipientRepository: fixture.recipients,
      transmissionRepository: fixture.transmissions,
      createId: () => "transmission-1",
      now: () => fixedNow
    }).execute({
      recipientId: "recipient-1",
      channel: "pec",
      reportIds: ["report-1", "report-2"],
      subject: "Oggetto",
      body: "Corpo"
    });

    expect(transmission).toMatchObject({
      id: "transmission-1",
      primaryReportId: "report-1",
      reportIds: ["report-1", "report-2"],
      reportCount: 2,
      status: "draft",
      recipientAddressSnapshot: "tecnico@pec.example.test"
    });
    expect(fixture.transmissions.events.map((event) => event.type)).toEqual(["ReportAddedToTransmission", "ReportAddedToTransmission"]);
  });

  it("rejects ineligible or duplicate report selections", async () => {
    const fixture = createFixture();

    await expect(new CreateTransmissionUseCase({
      recipientRepository: fixture.recipients,
      transmissionRepository: fixture.transmissions
    }).execute({ recipientId: "recipient-1", channel: "pec", reportIds: ["duplicate-report"], subject: "Oggetto", body: "Corpo" })).rejects.toThrow("approvate, pubbliche, non duplicate");
  });

  it("adds and removes reports only while draft", async () => {
    const fixture = createFixture();
    const transmission = await fixture.transmissions.createTransmission(baseTransmission({ reportIds: ["report-1"] }));

    await new AddReportToTransmissionUseCase({ transmissionRepository: fixture.transmissions, now: () => fixedNow }).execute({ transmissionId: transmission.id, reportId: "report-2" });
    expect((await fixture.transmissions.findTransmissionById(transmission.id))?.reportIds).toEqual(["report-1", "report-2"]);

    await new RemoveReportFromTransmissionUseCase({ transmissionRepository: fixture.transmissions, now: () => fixedNow }).execute({ transmissionId: transmission.id, reportId: "report-2" });
    expect((await fixture.transmissions.findTransmissionById(transmission.id))?.reportIds).toEqual(["report-1"]);
  });

  it("marks sent without changing public report status", async () => {
    const fixture = createFixture();
    const transmission = await fixture.transmissions.createTransmission(baseTransmission({ reportIds: ["report-1"] }));

    await new MarkTransmissionSentUseCase({ transmissionRepository: fixture.transmissions, now: () => fixedNow }).execute({ transmissionId: transmission.id });

    expect(fixture.reports.reports.get("report-1")?.toSnapshot().publicStatus).toBe("reported");
    expect(fixture.transmissions.events.map((event) => event.type)).toContain("TransmissionSent");
  });

  it("marks failed without changing public report status", async () => {
    const fixture = createFixture();
    const transmission = await fixture.transmissions.createTransmission(baseTransmission({ reportIds: ["report-1"] }));

    await new MarkTransmissionFailedUseCase({ transmissionRepository: fixture.transmissions, now: () => fixedNow }).execute({ transmissionId: transmission.id });

    expect(fixture.reports.reports.get("report-1")?.toSnapshot().publicStatus).toBe("reported");
    expect(fixture.transmissions.events.map((event) => event.type)).toContain("TransmissionFailed");
  });

  it("marks delivered, updates all reported reports, skips already communicated reports, and is idempotent", async () => {
    const fixture = createFixture();
    fixture.reports.reports.get("report-3")?.markCommunicated(new Date("2026-02-01T10:00:00.000Z"));
    fixture.reports.reports.get("report-3")?.pullDomainEvents();
    const transmission = await fixture.transmissions.createTransmission(baseTransmission({ reportIds: ["report-1", "report-2", "report-3"] }));
    const useCase = new MarkTransmissionDeliveredUseCase({
      reportRepository: fixture.reports,
      transmissionRepository: fixture.transmissions,
      now: () => fixedNow
    });

    await useCase.execute({ transmissionId: transmission.id });
    await useCase.execute({ transmissionId: transmission.id });

    expect(fixture.reports.reports.get("report-1")?.toSnapshot()).toMatchObject({ publicStatus: "communicated", communicatedAt: fixedNow });
    expect(fixture.reports.reports.get("report-2")?.toSnapshot()).toMatchObject({ publicStatus: "communicated", communicatedAt: fixedNow });
    expect(fixture.reports.reports.get("report-3")?.toSnapshot().communicatedAt).toEqual(new Date("2026-02-01T10:00:00.000Z"));
    expect(fixture.transmissions.events.filter((event) => event.type === "ReportCommunicated")).toHaveLength(2);
    expect(fixture.transmissions.events.filter((event) => event.type === "TransmissionDelivered")).toHaveLength(3);
  });
});

function createFixture() {
  const reports = new InMemoryReportRepository();
  const recipients = new InMemoryRecipientRepository();
  const transmissions = new InMemoryTransmissionRepository();
  return { reports, recipients, transmissions };
}

function baseTransmission(overrides: Partial<NewTransmission> = {}): NewTransmission {
  const reportIds = overrides.reportIds ?? ["report-1"];
  return {
    id: overrides.id ?? "transmission-1",
    primaryReportId: overrides.primaryReportId ?? reportIds[0]!,
    reportIds,
    recipientId: "recipient-1",
    recipientNameSnapshot: "Ufficio Tecnico",
    recipientOrganizationSnapshot: "Comune di Venafro",
    recipientAddressSnapshot: "tecnico@pec.example.test",
    channel: "pec",
    subject: "Oggetto",
    body: "Corpo",
    status: "draft",
    createdAt: new Date("2026-02-02T10:00:00.000Z"),
    ...overrides
  };
}

class InMemoryTransmissionRepository implements TransmissionRepository {
  readonly events: ReportDomainEvent[] = [];
  private readonly transmissions = new Map<string, Transmission>();
  private readonly eligibleReports = [eligibleReport("report-1", "VC-TRNS0001"), eligibleReport("report-2", "VC-TRNS0002"), eligibleReport("report-3", "VC-TRNS0003")];

  async createTransmission(transmission: NewTransmission, events: ReportDomainEvent[] = []): Promise<Transmission> {
    const created = { ...transmission, reportCount: transmission.reportIds.length };
    this.transmissions.set(created.id, created);
    this.events.push(...events);
    return created;
  }

  async findTransmissionById(transmissionId: string): Promise<Transmission | null> { return this.transmissions.get(transmissionId) ?? null; }
  async listTransmissions(): Promise<Transmission[]> { return [...this.transmissions.values()]; }
  async listTransmissionsByReportId(reportId: string): Promise<Transmission[]> { return [...this.transmissions.values()].filter((transmission) => transmission.reportIds.includes(reportId)); }
  async listEligibleReportsForRecipient(recipientId: string): Promise<EligibleTransmissionReport[]> { return recipientId === "recipient-1" ? this.eligibleReports : []; }
  async listTransmissionReports(transmissionId: string): Promise<TransmissionReportSummary[]> {
    const transmission = this.transmissions.get(transmissionId);
    if (!transmission) return [];
    return this.eligibleReports.filter((report) => transmission.reportIds.includes(report.id)).map((report) => ({ ...report, publicStatus: "reported" as const }));
  }

  async addReportToTransmission(transmissionId: string, reportId: string, events: ReportDomainEvent[] = []): Promise<void> {
    const transmission = this.transmissions.get(transmissionId);
    if (!transmission) return;
    const reportIds = [...transmission.reportIds, reportId];
    this.transmissions.set(transmissionId, { ...transmission, reportIds, reportCount: reportIds.length });
    this.events.push(...events);
  }

  async removeReportFromTransmission(transmissionId: string, reportId: string, events: ReportDomainEvent[] = []): Promise<void> {
    const transmission = this.transmissions.get(transmissionId);
    if (!transmission) return;
    const reportIds = transmission.reportIds.filter((id) => id !== reportId);
    this.transmissions.set(transmissionId, { ...transmission, reportIds, reportCount: reportIds.length });
    this.events.push(...events);
  }

  async saveTransmissionStatusWithReports(transmission: Transmission, reports: Report[], events: ReportDomainEvent[] = []): Promise<Transmission> {
    this.transmissions.set(transmission.id, transmission);
    this.events.push(...events);
    void reports;
    return transmission;
  }
}

class InMemoryReportRepository implements ReportRepository {
  reports = new Map<string, Report>();

  constructor() {
    for (const [id, code] of [["report-1", "VC-TRNS0001"], ["report-2", "VC-TRNS0002"], ["report-3", "VC-TRNS0003"]] as const) {
      const report = Report.create({ id, publicCode: PublicCode.create(code), title: "Buca in strada", description: "Descrizione", categoryId: "category-1", location: Location.create({ latitude: 41.48, longitude: 14.04 }), createdAt: new Date("2026-02-01T10:00:00.000Z") });
      report.pullDomainEvents();
      report.approve(new Date("2026-02-02T10:00:00.000Z"));
      report.pullDomainEvents();
      this.reports.set(id, report);
    }
  }

  async save(report: Report): Promise<void> { this.reports.set(report.toSnapshot().id, report); }
  async saveWithAttachment(): Promise<void> {}
  async findByPublicCode(publicCode: PublicCode): Promise<Report | null> { return [...this.reports.values()].find((report) => report.toSnapshot().publicCode === publicCode.toString()) ?? null; }
  async findById(reportId: string): Promise<Report | null> { return this.reports.get(reportId) ?? null; }
  async findAttachmentForModeration(): Promise<null> { return null; }
  async findPublicAttachmentByPublicCode(): Promise<null> { return null; }
  async listForModeration(): Promise<[]> { return []; }
  async countByModerationStatus(): Promise<number> { return 0; }
  async findPublicByPublicCode(): Promise<null> { return null; }
  async listPublicForMap(): Promise<[]> { return []; }
  async findPotentialDuplicates(): Promise<[]> { return []; }
  async listTimelineByReportId(): Promise<[]> { return []; }
  async listPublicTimelineByPublicCode(): Promise<[]> { return []; }
  async listPublicEventsByPublicCode(): Promise<[]> { return []; }
}

class InMemoryRecipientRepository implements RecipientRepository {
  private readonly recipient: Recipient = {
    id: "recipient-1",
    name: "Ufficio Tecnico",
    organization: "Comune di Venafro",
    email: "tecnico@example.test",
    pec: "tecnico@pec.example.test",
    active: true,
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    updatedAt: new Date("2026-02-01T10:00:00.000Z")
  };

  async listAll(): Promise<RecipientListItem[]> { return [{ ...this.recipient, categories: [] }]; }
  async findById(recipientId: string): Promise<Recipient | null> { return recipientId === this.recipient.id ? this.recipient : null; }
  async findByEmail(): Promise<Recipient | null> { return null; }
  async findByPec(): Promise<Recipient | null> { return null; }
  async create(input: NewRecipient): Promise<Recipient> { return input; }
  async update(input: RecipientUpdate): Promise<Recipient | null> { return { ...this.recipient, ...input }; }
  async findActiveByCategory(): Promise<[]> { return []; }
}

function eligibleReport(id: string, publicCode: string, overrides: Partial<EligibleTransmissionReport> = {}): EligibleTransmissionReport {
  return {
    id,
    publicCode,
    title: "Buca in strada",
    description: "Descrizione della segnalazione.",
    categoryId: "category-1",
    categoryName: "Strade",
    address: "Via Roma, Venafro",
    publishedAt: new Date("2026-02-02T10:00:00.000Z"),
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    ...overrides
  };
}

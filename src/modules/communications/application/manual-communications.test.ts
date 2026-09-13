import { describe, expect, it } from "vitest";
import type { CategoryDetails, CategoryListItem, CategoryOption, CategoryRepository, CategoryUpdate, NewCategory } from "@/modules/categories/application/category-repository";
import type { CategoryRecipient, NewRecipient, Recipient, RecipientListItem, RecipientRepository, RecipientUpdate } from "@/modules/recipients/application/recipient-repository";
import type { ReportRepository } from "@/modules/reports/application/report-repository";
import { Location, PublicCode, Report, type ReportDomainEvent } from "@/modules/reports/domain";
import type { NewOutboundCommunication, OutboundCommunication, OutboundCommunicationRepository } from "./communication-repository";
import {
  CreateManualCommunicationUseCase,
  MarkCommunicationDeliveredUseCase,
  MarkCommunicationFailedUseCase,
  buildCommunicationTemplate
} from "./manual-communications";

describe("manual communications", () => {
  it("builds a deterministic subject and body without personal data", () => {
    const template = buildCommunicationTemplate({
      publicCode: "VC-ABC12345",
      categoryName: "Strade / Buche",
      address: "Via Roma, Venafro",
      createdAt: new Date("2026-01-02T10:00:00.000Z"),
      description: "Buca pericolosa.",
      appUrl: "https://visione.example.test/"
    });

    expect(template.subject).toBe("Segnalazione civica VC-ABC12345 | Strade / Buche | Via Roma, Venafro");
    expect(template.body).toContain("Codice segnalazione: VC-ABC12345");
    expect(template.body).toContain("Scheda pubblica: https://visione.example.test/segnalazioni/VC-ABC12345");
    expect(template.body).not.toContain("email");
  });

  it("creates a sent communication with recipient snapshot and does not change report status", async () => {
    const { communications, reports, recipients } = createFixture();
    const useCase = new CreateManualCommunicationUseCase({
      reportRepository: reports,
      recipientRepository: recipients,
      categoryRepository: new InMemoryCategoryRepository(),
      communicationRepository: communications,
      createId: () => "communication-1",
      now: () => new Date("2026-01-03T10:00:00.000Z")
    });

    const result = await useCase.execute({
      publicCode: "VC-ABC12345",
      recipientId: "recipient-1",
      channel: "pec",
      subject: "Oggetto",
      body: "Corpo",
      status: "sent"
    });

    expect(result).toMatchObject({
      id: "communication-1",
      recipientNameSnapshot: "Ufficio Tecnico",
      recipientOrganizationSnapshot: "Comune di Venafro",
      recipientAddressSnapshot: "tecnico@pec.example.test",
      channel: "pec",
      status: "sent",
      sentAt: new Date("2026-01-03T10:00:00.000Z")
    });
    expect(reports.report.toSnapshot().publicStatus).toBe("reported");
    expect(communications.events.map((event) => event.type)).toEqual(["CommunicationSent"]);
  });

  it("keeps communication snapshot unchanged after recipient changes", async () => {
    const { communications, reports, recipients } = createFixture();
    await new CreateManualCommunicationUseCase({
      reportRepository: reports,
      recipientRepository: recipients,
      categoryRepository: new InMemoryCategoryRepository(),
      communicationRepository: communications,
      createId: () => "communication-1",
      now: () => new Date("2026-01-03T10:00:00.000Z")
    }).execute({
      publicCode: "VC-ABC12345",
      recipientId: "recipient-1",
      channel: "pec",
      subject: "Oggetto",
      body: "Corpo",
      status: "sent"
    });

    await recipients.update({
      id: "recipient-1",
      name: "Nome modificato",
      organization: "Organizzazione modificata",
      pec: "nuova@pec.example.test",
      email: "nuova@example.test",
      active: true,
      updatedAt: new Date("2026-01-04T10:00:00.000Z")
    });

    await expect(communications.listByReportId(reports.report.toSnapshot().id)).resolves.toMatchObject([
      {
        recipientNameSnapshot: "Ufficio Tecnico",
        recipientOrganizationSnapshot: "Comune di Venafro",
        recipientAddressSnapshot: "tecnico@pec.example.test"
      }
    ]);
  });

  it("marks a sent communication as delivered and moves the report to Comunicata once", async () => {
    const { communications, reports, recipients } = createFixture();
    const communication = await new CreateManualCommunicationUseCase({
      reportRepository: reports,
      recipientRepository: recipients,
      categoryRepository: new InMemoryCategoryRepository(),
      communicationRepository: communications,
      createId: () => "communication-1",
      now: () => new Date("2026-01-03T10:00:00.000Z")
    }).execute({ publicCode: "VC-ABC12345", recipientId: "recipient-1", channel: "pec", subject: "Oggetto", body: "Corpo", status: "sent" });

    const useCase = new MarkCommunicationDeliveredUseCase({
      reportRepository: reports,
      communicationRepository: communications,
      now: () => new Date("2026-01-04T10:00:00.000Z")
    });

    await useCase.execute({ communicationId: communication.id });
    await useCase.execute({ communicationId: communication.id });

    expect(reports.report.toSnapshot()).toMatchObject({
      publicStatus: "communicated",
      communicatedAt: new Date("2026-01-04T10:00:00.000Z")
    });
    expect(communications.events.map((event) => event.type)).toEqual([
      "CommunicationSent",
      "CommunicationDelivered",
      "ReportCommunicated"
    ]);
  });

  it("marks a communication as failed without changing the public report status", async () => {
    const { communications, reports, recipients } = createFixture();
    const communication = await new CreateManualCommunicationUseCase({
      reportRepository: reports,
      recipientRepository: recipients,
      categoryRepository: new InMemoryCategoryRepository(),
      communicationRepository: communications,
      createId: () => "communication-1",
      now: () => new Date("2026-01-03T10:00:00.000Z")
    }).execute({ publicCode: "VC-ABC12345", recipientId: "recipient-1", channel: "pec", subject: "Oggetto", body: "Corpo", status: "sent" });

    await new MarkCommunicationFailedUseCase({
      communicationRepository: communications,
      now: () => new Date("2026-01-04T10:00:00.000Z")
    }).execute({ communicationId: communication.id });

    expect(reports.report.toSnapshot().publicStatus).toBe("reported");
    expect(communications.events.map((event) => event.type)).toEqual(["CommunicationSent", "CommunicationFailed"]);
  });
});

function createFixture() {
  const reports = new InMemoryReportRepository();
  const recipients = new InMemoryRecipientRepository();
  const communications = new InMemoryCommunicationRepository();
  return { reports, recipients, communications };
}

class InMemoryReportRepository implements ReportRepository {
  report: Report;

  constructor() {
    this.report = Report.create({
      id: "report-1",
      publicCode: PublicCode.create("VC-ABC12345"),
      title: "Buche in strada",
      description: "Sono presenti buche profonde vicino alla scuola.",
      categoryId: "category-1",
      location: Location.create({ latitude: 41.4821, longitude: 14.0474, address: "Via Roma" }),
      createdAt: new Date("2026-01-01T10:00:00.000Z")
    });
    this.report.pullDomainEvents();
    this.report.approve(new Date("2026-01-02T10:00:00.000Z"));
    this.report.pullDomainEvents();
  }

  async save(report: Report): Promise<void> { this.report = report; }
  async saveWithAttachment(): Promise<void> {}
  async findByPublicCode(publicCode: PublicCode): Promise<Report | null> { return publicCode.toString() === "VC-ABC12345" ? this.report : null; }
  async findById(reportId: string): Promise<Report | null> { return reportId === this.report.toSnapshot().id ? this.report : null; }
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
  private readonly recipients = new Map<string, Recipient>([["recipient-1", recipient()]]);

  async listAll(): Promise<RecipientListItem[]> { return [...this.recipients.values()].map((item) => ({ ...item, categories: [] })); }
  async findById(recipientId: string): Promise<Recipient | null> { return this.recipients.get(recipientId) ?? null; }
  async findByEmail(): Promise<Recipient | null> { return null; }
  async findByPec(): Promise<Recipient | null> { return null; }
  async create(input: NewRecipient): Promise<Recipient> { this.recipients.set(input.id, input); return input; }
  async update(input: RecipientUpdate): Promise<Recipient | null> { const existing = this.recipients.get(input.id); if (!existing) return null; const next = { ...existing, ...input }; this.recipients.set(input.id, next); return next; }
  async findActiveByCategory(categoryId: string): Promise<CategoryRecipient[]> { return categoryId === "category-1" ? [...this.recipients.values()].filter((item) => item.active).map((item, index) => ({ ...item, sortOrder: index })) : []; }
}

class InMemoryCategoryRepository implements CategoryRepository {
  async listActive(): Promise<CategoryOption[]> { return []; }
  async listAll(): Promise<CategoryListItem[]> { return []; }
  async findActiveById(): Promise<CategoryOption | null> { return null; }
  async findById(): Promise<CategoryDetails> { return { id: "category-1", name: "Strade", slug: "strade", active: true, createdAt: new Date("2026-01-01T10:00:00.000Z"), updatedAt: new Date("2026-01-01T10:00:00.000Z") }; }
  async findBySlug(): Promise<CategoryDetails | null> { return null; }
  async create(category: NewCategory): Promise<CategoryDetails> { return category; }
  async update(category: CategoryUpdate): Promise<CategoryDetails> { return { id: category.id, name: category.name, slug: category.slug, active: category.active, createdAt: new Date("2026-01-01T10:00:00.000Z"), updatedAt: category.updatedAt }; }
}

class InMemoryCommunicationRepository implements OutboundCommunicationRepository {
  readonly events: ReportDomainEvent[] = [];
  private readonly communications = new Map<string, OutboundCommunication>();

  async create(communication: NewOutboundCommunication, events: ReportDomainEvent[] = []): Promise<OutboundCommunication> {
    this.communications.set(communication.id, communication);
    this.events.push(...events);
    return communication;
  }

  async findById(communicationId: string): Promise<OutboundCommunication | null> { return this.communications.get(communicationId) ?? null; }
  async listByReportId(reportId: string): Promise<OutboundCommunication[]> { return [...this.communications.values()].filter((communication) => communication.reportId === reportId); }

  async saveFailure(communication: OutboundCommunication, events: ReportDomainEvent[] = []): Promise<OutboundCommunication> {
    this.communications.set(communication.id, communication);
    this.events.push(...events);
    return communication;
  }

  async saveDeliveryWithReport(communication: OutboundCommunication, report: Report, events: ReportDomainEvent[] = []): Promise<OutboundCommunication> {
    this.communications.set(communication.id, communication);
    this.events.push(...events);
    return communication;
  }
}

function recipient(overrides: Partial<Recipient> = {}): Recipient {
  const now = new Date("2026-01-01T10:00:00.000Z");
  return {
    id: "recipient-1",
    name: "Ufficio Tecnico",
    organization: "Comune di Venafro",
    email: "tecnico@example.test",
    pec: "tecnico@pec.example.test",
    active: true,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

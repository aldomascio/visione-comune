import { describe, expect, it } from "vitest";
import type { CategoryRepository } from "@/modules/categories/application/category-repository";
import type { Transmission } from "@/modules/communications/application/transmission-repository";
import { Location, PublicCode, Report, type ReportDomainEvent } from "../domain";
import type { ReportRepository } from "./report-repository";
import {
  AddInternalReportNoteUseCase,
  ChangeReportCategoryUseCase,
  ReportCategoryChangeError,
  ReportInternalNoteError,
  deriveReportOperationalState,
} from "./operational-registry";

describe("deriveReportOperationalState", () => {
  it("gives duplicate state precedence over every other state", () => {
    expect(deriveReportOperationalState({
      report: { moderationStatus: "approved", publicStatus: "resolved", duplicateOfReportId: "primary" },
      transmissions: [transmission("sent")],
    }).label).toBe("Duplicata");
  });

  it("derives rejected, pending, to transmit, transmitting, communicated and resolved labels", () => {
    expect(deriveReportOperationalState({ report: { moderationStatus: "rejected" } }).label).toBe("Respinta");
    expect(deriveReportOperationalState({ report: { moderationStatus: "pending_review" } }).label).toBe("Da verificare");
    expect(deriveReportOperationalState({ report: { moderationStatus: "approved", publicStatus: "reported" } }).label).toBe("Da trasmettere");
    expect(deriveReportOperationalState({
      report: { moderationStatus: "approved", publicStatus: "reported" },
      transmissions: [transmission("sent")],
    }).label).toBe("In trasmissione");
    expect(deriveReportOperationalState({ report: { moderationStatus: "approved", publicStatus: "communicated" } }).label).toBe("Comunicata");
    expect(deriveReportOperationalState({ report: { moderationStatus: "approved", publicStatus: "resolved" } }).label).toBe("Risolta");
  });
});

describe("operational registry use cases", () => {
  it("changes category and stores an internal event with admin actor", async () => {
    const report = createReport();
    report.pullDomainEvents();
    const reportRepository = createInMemoryReportRepository(report);
    const categoryRepository = createCategoryRepository();

    await new ChangeReportCategoryUseCase({
      reportRepository,
      categoryRepository,
      now: () => new Date("2026-01-05T10:00:00.000Z"),
    }).execute({
      publicCode: "VC-OPREG001",
      categoryId: "lighting",
      actorAdminId: "admin-1",
      actorAdminEmail: "admin@example.test",
    });

    expect(report.toSnapshot().categoryId).toBe("lighting");
    expect(reportRepository.events).toContainEqual(expect.objectContaining({
      type: "ReportCategoryChanged",
      visibility: "internal",
      metadata: {
        previousCategoryId: "roads",
        previousCategoryName: "Strade",
        newCategoryId: "lighting",
        newCategoryName: "Illuminazione",
        actorAdminId: "admin-1",
        actorAdminEmail: "admin@example.test",
      },
    }));
  });

  it("rejects unchanged or inactive categories", async () => {
    const reportRepository = createInMemoryReportRepository(createReport());
    const categoryRepository = createCategoryRepository();
    const useCase = new ChangeReportCategoryUseCase({ reportRepository, categoryRepository });

    await expect(useCase.execute({ publicCode: "VC-OPREG001", categoryId: "roads" })).rejects.toThrow(ReportCategoryChangeError);
    await expect(useCase.execute({ publicCode: "VC-OPREG001", categoryId: "inactive" })).rejects.toThrow(ReportCategoryChangeError);
  });

  it("adds an immutable internal note event and never marks it public", async () => {
    const reportRepository = createInMemoryReportRepository(createReport());

    await new AddInternalReportNoteUseCase({
      reportRepository,
      now: () => new Date("2026-01-06T10:00:00.000Z"),
    }).execute({
      publicCode: "VC-OPREG001",
      note: "Verificare telefonicamente con ufficio tecnico.",
      actorAdminId: "admin-1",
      actorAdminEmail: "admin@example.test",
    });

    expect(reportRepository.events).toContainEqual(expect.objectContaining({
      type: "InternalNoteAdded",
      visibility: "internal",
      metadata: {
        internalNote: "Verificare telefonicamente con ufficio tecnico.",
        actorAdminId: "admin-1",
        actorAdminEmail: "admin@example.test",
      },
    }));
    expect(reportRepository.events.every((event) => event.visibility === "internal")).toBe(true);
  });

  it("rejects empty internal notes", async () => {
    const useCase = new AddInternalReportNoteUseCase({ reportRepository: createInMemoryReportRepository(createReport()) });

    await expect(useCase.execute({ publicCode: "VC-OPREG001", note: "   " })).rejects.toThrow(ReportInternalNoteError);
  });
});

function createReport(): Report {
  return Report.create({
    id: "report-1",
    publicCode: PublicCode.create("VC-OPREG001"),
    title: "Buca in strada",
    description: "Descrizione sufficientemente lunga per il dominio.",
    categoryId: "roads",
    location: Location.create({ latitude: 41.4821, longitude: 14.0474 }),
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
  });
}

function createInMemoryReportRepository(report: Report): ReportRepository & { events: ReportDomainEvent[] } {
  const events: ReportDomainEvent[] = [];

  return {
    events,
    async save(_report, newEvents = []) { events.push(...newEvents); },
    async saveWithAttachment() { throw new Error("Not used"); },
    async findByPublicCode(publicCode) { return publicCode.toString() === report.toSnapshot().publicCode ? report : null; },
    async findAttachmentForModeration() { return null; },
    async findPublicAttachmentByPublicCode() { return null; },
    async listForModeration() { return []; },
    async countByModerationStatus() { return 0; },
    async findPublicByPublicCode() { return null; },
    async listPublicForMap() { return []; },
    async findPotentialDuplicates() { return []; },
    async listPublicEventsByPublicCode() { return []; },
  };
}

function createCategoryRepository(): CategoryRepository {
  const categories = [
    { id: "roads", name: "Strade", slug: "strade", active: true, createdAt: new Date(), updatedAt: new Date() },
    { id: "lighting", name: "Illuminazione", slug: "illuminazione", active: true, createdAt: new Date(), updatedAt: new Date() },
    { id: "inactive", name: "Inattiva", slug: "inattiva", active: false, createdAt: new Date(), updatedAt: new Date() },
  ];

  return {
    async listActive() { return categories.filter((category) => category.active).map(({ id, name, slug }) => ({ id, name, slug })); },
    async listAll() { return categories.map((category) => ({ ...category, reportCount: 0 })); },
    async findActiveById(categoryId) {
      const category = categories.find((item) => item.id === categoryId && item.active);
      return category ? { id: category.id, name: category.name, slug: category.slug } : null;
    },
    async findById(categoryId) { return categories.find((item) => item.id === categoryId) ?? null; },
    async findBySlug(slug) { return categories.find((item) => item.slug === slug) ?? null; },
    async create() { throw new Error("Not used"); },
    async update() { throw new Error("Not used"); },
  };
}

function transmission(status: Transmission["status"]): Pick<Transmission, "status"> {
  return { status };
}

import { randomUUID } from "node:crypto";
import type { RecipientRepository } from "@/modules/recipients/application/recipient-repository";
import { InvalidReportTransitionError, type Report, type ReportDomainEvent } from "@/modules/reports/domain";
import type { ReportRepository } from "@/modules/reports/application/report-repository";
import {
  COMMUNICATION_BODY_MAX_LENGTH,
  COMMUNICATION_SUBJECT_MAX_LENGTH,
  CommunicationRecipientNotEligibleError,
  CommunicationReportNotEligibleError,
  CommunicationValidationError,
  InvalidCommunicationTransitionError,
  mapCommunicationErrorToMessage
} from "./manual-communications";
import type { OutboundCommunicationChannel, OutboundCommunicationStatus } from "./communication-repository";
import type {
  EligibleTransmissionReport,
  NewTransmission,
  Transmission,
  TransmissionRepository,
  TransmissionReportSummary
} from "./transmission-repository";

export type CreateTransmissionInput = {
  recipientId: string;
  channel: string;
  reportIds: string[];
  subject: string;
  body: string;
};

export type TransmissionTemplate = {
  subject: string;
  body: string;
};

export class TransmissionNotFoundError extends Error {
  constructor(readonly transmissionId: string) {
    super(`Transmission not found: ${transmissionId}`);
    this.name = "TransmissionNotFoundError";
  }
}

export class TransmissionReportSelectionError extends Error {
  constructor(message = "Seleziona almeno una segnalazione eleggibile per la trasmissione.") {
    super(message);
    this.name = "TransmissionReportSelectionError";
  }
}

export class CreateTransmissionUseCase {
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(private readonly dependencies: {
    recipientRepository: RecipientRepository;
    transmissionRepository: TransmissionRepository;
    createId?: () => string;
    now?: () => Date;
  }) {
    this.createId = dependencies.createId ?? (() => randomUUID());
    this.now = dependencies.now ?? (() => new Date());
  }

  async execute(input: CreateTransmissionInput): Promise<Transmission> {
    const values = validateTransmissionInput(input);
    const recipient = await this.dependencies.recipientRepository.findById(values.recipientId);

    if (!recipient?.active) {
      throw new CommunicationRecipientNotEligibleError("Il destinatario selezionato non e attivo.");
    }

    const recipientAddressSnapshot = getRecipientAddressForChannel(recipient, values.channel);
    const eligibleReports = await this.dependencies.transmissionRepository.listEligibleReportsForRecipient(values.recipientId, 100);
    const eligibleIds = new Set(eligibleReports.map((report) => report.id));

    for (const reportId of values.reportIds) {
      if (!eligibleIds.has(reportId)) {
        throw new CommunicationReportNotEligibleError("La trasmissione puo includere solo segnalazioni approvate, pubbliche, non duplicate e ancora Segnalate compatibili con il destinatario.");
      }
    }

    const now = this.now();
    const transmission: NewTransmission = {
      id: this.createId(),
      primaryReportId: values.reportIds[0]!,
      reportIds: values.reportIds,
      recipientId: recipient.id,
      recipientNameSnapshot: recipient.name,
      recipientOrganizationSnapshot: recipient.organization,
      recipientAddressSnapshot,
      channel: values.channel,
      subject: values.subject,
      body: values.body,
      status: "draft",
      createdAt: now
    };

    return this.dependencies.transmissionRepository.createTransmission(
      transmission,
      values.reportIds.map((reportId) => createTransmissionReportEvent({ transmission, reportId, type: "ReportAddedToTransmission", occurredAt: now }))
    );
  }
}

export class AddReportToTransmissionUseCase {
  private readonly now: () => Date;

  constructor(private readonly dependencies: { transmissionRepository: TransmissionRepository; now?: () => Date }) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async execute(input: { transmissionId: string; reportId: string }): Promise<void> {
    const transmission = await this.dependencies.transmissionRepository.findTransmissionById(input.transmissionId);
    if (!transmission) throw new TransmissionNotFoundError(input.transmissionId);
    if (transmission.status !== "draft") throw new InvalidCommunicationTransitionError("Solo una trasmissione in bozza puo essere modificata.");
    if (transmission.reportIds.includes(input.reportId)) return;

    const eligible = transmission.recipientId ? await this.dependencies.transmissionRepository.listEligibleReportsForRecipient(transmission.recipientId, 100) : [];
    if (!eligible.some((report) => report.id === input.reportId)) {
      throw new CommunicationReportNotEligibleError("La segnalazione non e eleggibile per questa trasmissione.");
    }

    await this.dependencies.transmissionRepository.addReportToTransmission(input.transmissionId, input.reportId, [
      createTransmissionReportEvent({ transmission, reportId: input.reportId, type: "ReportAddedToTransmission", occurredAt: this.now() })
    ]);
  }
}

export class RemoveReportFromTransmissionUseCase {
  private readonly now: () => Date;

  constructor(private readonly dependencies: { transmissionRepository: TransmissionRepository; now?: () => Date }) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async execute(input: { transmissionId: string; reportId: string }): Promise<void> {
    const transmission = await this.dependencies.transmissionRepository.findTransmissionById(input.transmissionId);
    if (!transmission) throw new TransmissionNotFoundError(input.transmissionId);
    if (transmission.status !== "draft") throw new InvalidCommunicationTransitionError("Solo una trasmissione in bozza puo essere modificata.");
    if (!transmission.reportIds.includes(input.reportId)) return;
    if (transmission.reportIds.length <= 1) throw new TransmissionReportSelectionError("Una trasmissione deve contenere almeno una segnalazione.");

    await this.dependencies.transmissionRepository.removeReportFromTransmission(input.transmissionId, input.reportId, [
      createTransmissionReportEvent({ transmission, reportId: input.reportId, type: "ReportRemovedFromTransmission", occurredAt: this.now() })
    ]);
  }
}

export class MarkTransmissionSentUseCase {
  private readonly now: () => Date;

  constructor(private readonly dependencies: { transmissionRepository: TransmissionRepository; now?: () => Date }) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async execute(input: { transmissionId: string }): Promise<Transmission> {
    const transmission = await getTransmissionOrThrow(this.dependencies.transmissionRepository, input.transmissionId);
    if (transmission.status === "sent" || transmission.status === "delivered") return transmission;
    if (transmission.status === "failed") throw new InvalidCommunicationTransitionError("Una trasmissione fallita non puo essere marcata come inviata.");

    const sentAt = this.now();
    const next = { ...transmission, status: "sent" as const, sentAt };
    return this.dependencies.transmissionRepository.saveTransmissionStatusWithReports(
      next,
      [],
      transmission.reportIds.map((reportId) => createTransmissionReportEvent({ transmission: next, reportId, type: "TransmissionSent", occurredAt: sentAt }))
    );
  }
}

export class MarkTransmissionDeliveredUseCase {
  private readonly now: () => Date;

  constructor(private readonly dependencies: {
    reportRepository: ReportRepository & { findById(reportId: string): Promise<Report | null> };
    transmissionRepository: TransmissionRepository;
    now?: () => Date;
  }) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async execute(input: { transmissionId: string }): Promise<Transmission> {
    const transmission = await getTransmissionOrThrow(this.dependencies.transmissionRepository, input.transmissionId);
    if (transmission.status === "delivered") return transmission;
    if (transmission.status === "failed") throw new InvalidCommunicationTransitionError("Una trasmissione fallita non puo essere marcata come consegnata.");

    const deliveredAt = this.now();
    const changedReports: Report[] = [];
    const events: ReportDomainEvent[] = [];
    const next = { ...transmission, status: "delivered" as const, sentAt: transmission.sentAt ?? deliveredAt, deliveredAt };

    for (const reportId of transmission.reportIds) {
      const report = await this.dependencies.reportRepository.findById(reportId);
      if (!report) continue;
      const snapshot = report.toSnapshot();

      events.push(createTransmissionReportEvent({ transmission: next, reportId, type: "TransmissionDelivered", occurredAt: deliveredAt }));

      if (snapshot.moderationStatus === "approved" && snapshot.publicStatus === "reported") {
        try {
          report.markCommunicated(deliveredAt);
          changedReports.push(report);
          events.push(...report.pullDomainEvents());
        } catch (error) {
          if (error instanceof InvalidReportTransitionError) {
            throw new InvalidCommunicationTransitionError(error.message);
          }
          throw error;
        }
      }
    }

    return this.dependencies.transmissionRepository.saveTransmissionStatusWithReports(next, changedReports, events);
  }
}

export class MarkTransmissionFailedUseCase {
  private readonly now: () => Date;

  constructor(private readonly dependencies: { transmissionRepository: TransmissionRepository; now?: () => Date }) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async execute(input: { transmissionId: string }): Promise<Transmission> {
    const transmission = await getTransmissionOrThrow(this.dependencies.transmissionRepository, input.transmissionId);
    if (transmission.status === "failed") return transmission;
    if (transmission.status === "delivered") throw new InvalidCommunicationTransitionError("Una trasmissione consegnata non puo essere marcata come fallita.");

    const failedAt = this.now();
    const next = { ...transmission, status: "failed" as const, failedAt };
    return this.dependencies.transmissionRepository.saveTransmissionStatusWithReports(
      next,
      [],
      transmission.reportIds.map((reportId) => createTransmissionReportEvent({ transmission: next, reportId, type: "TransmissionFailed", occurredAt: failedAt }))
    );
  }
}

export class GetTransmissionUseCase {
  constructor(private readonly dependencies: { transmissionRepository: TransmissionRepository }) {}

  async execute(input: { transmissionId: string }): Promise<{ transmission: Transmission; reports: TransmissionReportSummary[] }> {
    const transmission = await getTransmissionOrThrow(this.dependencies.transmissionRepository, input.transmissionId);
    const reports = await this.dependencies.transmissionRepository.listTransmissionReports(input.transmissionId);
    return { transmission, reports };
  }
}

export class ListTransmissionsUseCase {
  constructor(private readonly dependencies: { transmissionRepository: TransmissionRepository }) {}

  async execute(input: { status?: string; recipientId?: string } = {}): Promise<Transmission[]> {
    return this.dependencies.transmissionRepository.listTransmissions({
      ...(isTransmissionStatus(input.status) ? { status: input.status } : {}),
      ...(input.recipientId ? { recipientId: input.recipientId } : {})
    });
  }
}

export class ListReportTransmissionsUseCase {
  constructor(private readonly dependencies: { transmissionRepository: TransmissionRepository }) {}

  async execute(input: { reportId: string }): Promise<Transmission[]> {
    return this.dependencies.transmissionRepository.listTransmissionsByReportId(input.reportId);
  }
}

export class ListEligibleTransmissionReportsUseCase {
  constructor(private readonly dependencies: { transmissionRepository: TransmissionRepository }) {}

  async execute(input: { recipientId: string; limit?: number }): Promise<EligibleTransmissionReport[]> {
    if (!input.recipientId.trim()) return [];
    return this.dependencies.transmissionRepository.listEligibleReportsForRecipient(input.recipientId.trim(), input.limit ?? 50);
  }
}

export class GenerateTransmissionTemplateUseCase {
  constructor(private readonly dependencies: { transmissionRepository: TransmissionRepository; appUrl?: string }) {}

  async execute(input: { recipientId: string; reportIds: string[] }): Promise<TransmissionTemplate> {
    const eligibleReports = await this.dependencies.transmissionRepository.listEligibleReportsForRecipient(input.recipientId, 100);
    const selectedIds = new Set(normalizeReportIds(input.reportIds));
    return buildTransmissionTemplate(eligibleReports.filter((report) => selectedIds.has(report.id)), this.dependencies.appUrl);
  }
}

export function buildTransmissionTemplate(reports: EligibleTransmissionReport[], appUrl?: string): TransmissionTemplate {
  if (reports.length === 0) {
    return { subject: "Segnalazioni civiche da trasmettere", body: "" };
  }

  const subject = reports.length === 1
    ? `Segnalazione civica ${reports[0]!.publicCode} | ${reports[0]!.categoryName}`
    : `${reports.length} segnalazioni civiche da trasmettere a Visione Comune`;

  const body = [
    "Buongiorno,",
    "",
    reports.length === 1
      ? "trasmettiamo la seguente segnalazione verificata da Visione Comune:"
      : "trasmettiamo le seguenti segnalazioni verificate da Visione Comune:",
    "",
    ...reports.flatMap((report, index) => [
      `${index + 1}. ${report.publicCode} — ${report.title}`,
      `Categoria: ${report.categoryName}`,
      `Luogo: ${report.address?.trim() || "Luogo non indicato"}`,
      `Data pubblicazione: ${formatDate(report.publishedAt)}`,
      `Scheda pubblica: ${normalizeAppUrl(appUrl)}/segnalazioni/${report.publicCode}`,
      "Descrizione:",
      report.description,
      ""
    ]),
    "Cordiali saluti,",
    "Visione Comune"
  ].join("\n");

  return {
    subject: subject.slice(0, COMMUNICATION_SUBJECT_MAX_LENGTH),
    body: body.slice(0, COMMUNICATION_BODY_MAX_LENGTH)
  };
}

export function mapTransmissionErrorToMessage(error: unknown): string {
  if (error instanceof TransmissionReportSelectionError) return error.message;
  if (error instanceof TransmissionNotFoundError) return "Trasmissione non trovata.";
  return mapCommunicationErrorToMessage(error);
}

function validateTransmissionInput(input: CreateTransmissionInput): {
  recipientId: string;
  channel: OutboundCommunicationChannel;
  reportIds: string[];
  subject: string;
  body: string;
} {
  const fieldErrors: Record<string, string> = {};
  const recipientId = input.recipientId.trim();
  const channel = parseChannel(input.channel);
  const reportIds = normalizeReportIds(input.reportIds);
  const subject = normalizeMultiline(input.subject);
  const body = normalizeMultiline(input.body);

  if (!recipientId) fieldErrors.recipientId = "Seleziona un destinatario.";
  if (!channel) fieldErrors.channel = "Seleziona un canale valido.";
  if (reportIds.length === 0) fieldErrors.reportIds = "Seleziona almeno una segnalazione.";
  if (!subject) fieldErrors.subject = "Inserisci l'oggetto.";
  else if (subject.length > COMMUNICATION_SUBJECT_MAX_LENGTH) fieldErrors.subject = `L'oggetto non puo superare ${COMMUNICATION_SUBJECT_MAX_LENGTH} caratteri.`;
  if (!body) fieldErrors.body = "Inserisci il testo della trasmissione.";
  else if (body.length > COMMUNICATION_BODY_MAX_LENGTH) fieldErrors.body = `Il testo non puo superare ${COMMUNICATION_BODY_MAX_LENGTH} caratteri.`;

  if (Object.keys(fieldErrors).length > 0 || !channel) {
    throw new CommunicationValidationError(fieldErrors);
  }

  return { recipientId, channel, reportIds, subject, body };
}

function normalizeReportIds(reportIds: string[]): string[] {
  return [...new Set(reportIds.map((reportId) => reportId.trim()).filter(Boolean))];
}

function parseChannel(value: string): OutboundCommunicationChannel | null {
  return value === "email" || value === "pec" ? value : null;
}

function isTransmissionStatus(value: string | undefined): value is OutboundCommunicationStatus {
  return value === "draft" || value === "sent" || value === "delivered" || value === "failed";
}

function getRecipientAddressForChannel(recipient: { email?: string; pec?: string }, channel: OutboundCommunicationChannel): string {
  const value = channel === "pec" ? recipient.pec : recipient.email;
  if (!value) {
    throw new CommunicationRecipientNotEligibleError(
      channel === "pec" ? "Il destinatario selezionato non ha un indirizzo PEC." : "Il destinatario selezionato non ha un indirizzo email."
    );
  }
  return value;
}

async function getTransmissionOrThrow(repository: TransmissionRepository, transmissionId: string): Promise<Transmission> {
  const transmission = await repository.findTransmissionById(transmissionId);
  if (!transmission) throw new TransmissionNotFoundError(transmissionId);
  return transmission;
}

function createTransmissionReportEvent(input: {
  transmission: Pick<Transmission, "id" | "status" | "recipientNameSnapshot" | "recipientOrganizationSnapshot" | "recipientAddressSnapshot" | "channel" | "reportIds">;
  reportId: string;
  type: "ReportAddedToTransmission" | "ReportRemovedFromTransmission" | "TransmissionSent" | "TransmissionDelivered" | "TransmissionFailed";
  occurredAt: Date;
}): ReportDomainEvent {
  return {
    type: input.type,
    reportId: input.reportId,
    occurredAt: input.occurredAt,
    visibility: "internal",
    metadata: {
      transmissionId: input.transmission.id,
      transmissionStatus: input.transmission.status,
      transmissionReportCount: input.transmission.reportIds.length,
      recipientName: input.transmission.recipientNameSnapshot,
      recipientOrganization: input.transmission.recipientOrganizationSnapshot,
      recipientAddress: input.transmission.recipientAddressSnapshot,
      communicationChannel: input.transmission.channel
    }
  };
}

function normalizeMultiline(value: string): string {
  return value.trim().replace(/\r\n/g, "\n");
}

function normalizeAppUrl(value: string | undefined): string {
  return (value?.trim() || "http://localhost:3000").replace(/\/+$/, "");
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeZone: "Europe/Rome" }).format(date);
}

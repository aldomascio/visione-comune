import { randomUUID } from "node:crypto";
import type { CategoryRepository } from "@/modules/categories/application/category-repository";
import type { CategoryRecipient, RecipientRepository } from "@/modules/recipients/application/recipient-repository";
import { InvalidPublicCodeError, InvalidReportTransitionError, PublicCode, type Report, type ReportDomainEvent } from "@/modules/reports/domain";
import type { ReportRepository } from "@/modules/reports/application/report-repository";
import { formatStreetAddress } from "@/shared/format/address";
import type {
  NewOutboundCommunication,
  OutboundCommunication,
  OutboundCommunicationChannel,
  OutboundCommunicationRepository
} from "./communication-repository";

export const COMMUNICATION_SUBJECT_MAX_LENGTH = 240;
export const COMMUNICATION_BODY_MAX_LENGTH = 6000;

export type CommunicationTemplate = {
  subject: string;
  body: string;
};

export type CommunicationFormInput = {
  publicCode: string;
  recipientId: string;
  channel: string;
  subject: string;
  body: string;
  status: string;
};

export type ReportCommunicationListItem = OutboundCommunication;

export class CommunicationValidationError extends Error {
  constructor(readonly fieldErrors: Record<string, string>) {
    super("Communication validation failed.");
    this.name = "CommunicationValidationError";
  }
}

export class CommunicationReportNotFoundError extends Error {
  constructor(readonly publicCode: string) {
    super(`Report not found for communication: ${publicCode}`);
    this.name = "CommunicationReportNotFoundError";
  }
}

export class CommunicationReportNotEligibleError extends Error {
  constructor(message = "La segnalazione deve essere approvata e pubblica prima di registrare comunicazioni.") {
    super(message);
    this.name = "CommunicationReportNotEligibleError";
  }
}

export class CommunicationRecipientNotEligibleError extends Error {
  constructor(message = "Destinatario non valido per questa segnalazione.") {
    super(message);
    this.name = "CommunicationRecipientNotEligibleError";
  }
}

export class CommunicationNotFoundError extends Error {
  constructor(readonly communicationId: string) {
    super(`Communication not found: ${communicationId}`);
    this.name = "CommunicationNotFoundError";
  }
}

export class InvalidCommunicationTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCommunicationTransitionError";
  }
}

export class GenerateManualCommunicationTemplateUseCase {
  constructor(private readonly dependencies: { reportRepository: ReportRepository; categoryRepository: CategoryRepository; appUrl?: string }) {}

  async execute(input: { publicCode: string; recipientId?: string; channel?: string }): Promise<CommunicationTemplate> {
    const publicCode = parseCommunicationPublicCode(input.publicCode);
    const report = await this.dependencies.reportRepository.findByPublicCode(publicCode);

    if (!report) {
      throw new CommunicationReportNotFoundError(publicCode.toString());
    }

    const snapshot = report.toSnapshot();
    const category = await this.dependencies.categoryRepository.findById(snapshot.categoryId);
    return buildCommunicationTemplate({
      publicCode: snapshot.publicCode,
      categoryName: category?.name ?? snapshot.categoryId,
      address: snapshot.location.address,
      createdAt: snapshot.createdAt,
      description: snapshot.description,
      appUrl: this.dependencies.appUrl
    });
  }
}

export class ListReportCommunicationsUseCase {
  constructor(private readonly dependencies: { reportRepository: ReportRepository; communicationRepository: OutboundCommunicationRepository }) {}

  async execute(input: { publicCode: string }): Promise<ReportCommunicationListItem[]> {
    const publicCode = parseCommunicationPublicCode(input.publicCode);
    const report = await this.dependencies.reportRepository.findByPublicCode(publicCode);

    if (!report) {
      throw new CommunicationReportNotFoundError(publicCode.toString());
    }

    return this.dependencies.communicationRepository.listByReportId(report.toSnapshot().id);
  }
}

export class CreateManualCommunicationUseCase {
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(private readonly dependencies: {
    reportRepository: ReportRepository;
    recipientRepository: RecipientRepository;
    communicationRepository: OutboundCommunicationRepository;
    categoryRepository: CategoryRepository;
    createId?: () => string;
    now?: () => Date;
  }) {
    this.createId = dependencies.createId ?? (() => randomUUID());
    this.now = dependencies.now ?? (() => new Date());
  }

  async execute(input: CommunicationFormInput): Promise<OutboundCommunication> {
    const publicCode = parseCommunicationPublicCode(input.publicCode);
    const report = await this.dependencies.reportRepository.findByPublicCode(publicCode);

    if (!report) {
      throw new CommunicationReportNotFoundError(publicCode.toString());
    }

    const snapshot = report.toSnapshot();
    ensureReportCanHaveCommunications(snapshot);

    const values = validateCreateCommunicationInput(input);
    const recipient = await findEligibleRecipient(this.dependencies.recipientRepository, snapshot.categoryId, values.recipientId);
    const recipientAddressSnapshot = getRecipientAddressForChannel(recipient, values.channel);
    const now = this.now();
    const communication: NewOutboundCommunication = {
      id: this.createId(),
      reportId: snapshot.id,
      recipientId: recipient.id,
      recipientNameSnapshot: recipient.name,
      recipientOrganizationSnapshot: recipient.organization,
      recipientAddressSnapshot,
      channel: values.channel,
      subject: values.subject,
      body: values.body,
      status: values.status,
      createdAt: now,
      ...(values.status === "sent" ? { sentAt: now } : {})
    };

    const event: ReportDomainEvent = {
      type: values.status === "sent" ? "CommunicationSent" : "CommunicationRecorded",
      reportId: snapshot.id,
      occurredAt: now,
      visibility: "internal",
      metadata: {
        communicationId: communication.id,
        communicationStatus: communication.status,
        recipientName: communication.recipientNameSnapshot,
        recipientOrganization: communication.recipientOrganizationSnapshot,
        recipientAddress: communication.recipientAddressSnapshot,
        communicationChannel: communication.channel
      }
    };

    return this.dependencies.communicationRepository.create(communication, [event]);
  }
}

export class MarkCommunicationDeliveredUseCase {
  private readonly now: () => Date;

  constructor(private readonly dependencies: {
    reportRepository: ReportRepository & { findById(reportId: string): Promise<Report | null> };
    communicationRepository: OutboundCommunicationRepository;
    now?: () => Date;
  }) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async execute(input: { communicationId: string }): Promise<OutboundCommunication> {
    const communication = await this.dependencies.communicationRepository.findById(input.communicationId);

    if (!communication) {
      throw new CommunicationNotFoundError(input.communicationId);
    }

    if (communication.status === "delivered") {
      return communication;
    }

    if (communication.status === "failed") {
      throw new InvalidCommunicationTransitionError("Una comunicazione fallita non puo essere marcata come consegnata.");
    }

    const report = await this.dependencies.reportRepository.findById(communication.reportId);

    if (!report) {
      throw new CommunicationReportNotFoundError(communication.reportId);
    }

    const deliveredAt = this.now();
    const nextCommunication = {
      ...communication,
      status: "delivered" as const,
      sentAt: communication.sentAt ?? deliveredAt,
      deliveredAt
    };
    const events: ReportDomainEvent[] = [createCommunicationEvent(nextCommunication, "CommunicationDelivered", deliveredAt)];
    const reportSnapshot = report.toSnapshot();

    if (reportSnapshot.moderationStatus === "approved" && reportSnapshot.publicStatus === "reported") {
      try {
        report.markCommunicated(deliveredAt);
        events.push(...report.pullDomainEvents());
      } catch (error) {
        if (error instanceof InvalidReportTransitionError) {
          throw new InvalidCommunicationTransitionError(error.message);
        }
        throw error;
      }
    }

    return this.dependencies.communicationRepository.saveDeliveryWithReport(nextCommunication, report, events);
  }
}

export class MarkCommunicationFailedUseCase {
  private readonly now: () => Date;

  constructor(private readonly dependencies: { communicationRepository: OutboundCommunicationRepository; now?: () => Date }) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async execute(input: { communicationId: string }): Promise<OutboundCommunication> {
    const communication = await this.dependencies.communicationRepository.findById(input.communicationId);

    if (!communication) {
      throw new CommunicationNotFoundError(input.communicationId);
    }

    if (communication.status === "failed") {
      return communication;
    }

    if (communication.status === "delivered") {
      throw new InvalidCommunicationTransitionError("Una comunicazione consegnata non puo essere marcata come fallita.");
    }

    const failedAt = this.now();
    const nextCommunication = { ...communication, status: "failed" as const, failedAt };
    return this.dependencies.communicationRepository.saveFailure(nextCommunication, [
      createCommunicationEvent(nextCommunication, "CommunicationFailed", failedAt)
    ]);
  }
}

export function buildCommunicationTemplate(input: {
  publicCode: string;
  categoryName: string;
  address?: string;
  createdAt: Date;
  description: string;
  appUrl?: string;
}): CommunicationTemplate {
  const place = formatStreetAddress(input.address);
  const reportUrl = `${normalizeAppUrl(input.appUrl)}/segnalazioni/${input.publicCode}`;

  return {
    subject: `Segnalazione civica ${input.publicCode} | ${input.categoryName} | ${place}`.slice(0, COMMUNICATION_SUBJECT_MAX_LENGTH),
    body: [
      `Codice segnalazione: ${input.publicCode}`,
      `Categoria: ${input.categoryName}`,
      `Luogo: ${place}`,
      `Data segnalazione: ${formatDate(input.createdAt)}`,
      "",
      "Descrizione:",
      input.description,
      "",
      `Scheda pubblica: ${reportUrl}`
    ].join("\n").slice(0, COMMUNICATION_BODY_MAX_LENGTH)
  };
}

export function mapCommunicationErrorToMessage(error: unknown): string {
  if (error instanceof CommunicationValidationError) return "Controlla i campi della comunicazione.";
  if (error instanceof CommunicationReportNotFoundError) return "Segnalazione non trovata.";
  if (error instanceof CommunicationReportNotEligibleError) return error.message;
  if (error instanceof CommunicationRecipientNotEligibleError) return error.message;
  if (error instanceof CommunicationNotFoundError) return "Comunicazione non trovata.";
  if (error instanceof InvalidCommunicationTransitionError) return error.message;
  return "Non e stato possibile aggiornare la comunicazione.";
}

function validateCreateCommunicationInput(input: CommunicationFormInput): {
  recipientId: string;
  channel: OutboundCommunicationChannel;
  subject: string;
  body: string;
  status: "draft" | "sent";
} {
  const fieldErrors: Record<string, string> = {};
  const recipientId = input.recipientId.trim();
  const channel = parseChannel(input.channel);
  const status = parseInitialStatus(input.status);
  const subject = normalizeMultiline(input.subject);
  const body = normalizeMultiline(input.body);

  if (!recipientId) fieldErrors.recipientId = "Seleziona un destinatario.";
  if (!channel) fieldErrors.channel = "Seleziona un canale valido.";
  if (!status) fieldErrors.status = "Seleziona uno stato iniziale valido.";
  if (!subject) fieldErrors.subject = "Inserisci l'oggetto.";
  else if (subject.length > COMMUNICATION_SUBJECT_MAX_LENGTH) fieldErrors.subject = `L'oggetto non puo superare ${COMMUNICATION_SUBJECT_MAX_LENGTH} caratteri.`;
  if (!body) fieldErrors.body = "Inserisci il testo della comunicazione.";
  else if (body.length > COMMUNICATION_BODY_MAX_LENGTH) fieldErrors.body = `Il testo non puo superare ${COMMUNICATION_BODY_MAX_LENGTH} caratteri.`;

  if (Object.keys(fieldErrors).length > 0 || !channel || !status) {
    throw new CommunicationValidationError(fieldErrors);
  }

  return { recipientId, channel, status, subject, body };
}

function parseChannel(value: string): OutboundCommunicationChannel | null {
  return value === "email" || value === "pec" ? value : null;
}

function parseInitialStatus(value: string): "draft" | "sent" | null {
  return value === "draft" || value === "sent" ? value : null;
}

function ensureReportCanHaveCommunications(snapshot: { moderationStatus: string; publicStatus?: string }) {
  if (snapshot.moderationStatus !== "approved" || !snapshot.publicStatus) {
    throw new CommunicationReportNotEligibleError();
  }
}

async function findEligibleRecipient(
  repository: RecipientRepository,
  categoryId: string,
  recipientId: string
): Promise<CategoryRecipient> {
  const recipients = await repository.findActiveByCategory(categoryId);
  const recipient = recipients.find((candidate) => candidate.id === recipientId);

  if (!recipient) {
    throw new CommunicationRecipientNotEligibleError();
  }

  return recipient;
}

function getRecipientAddressForChannel(recipient: CategoryRecipient, channel: OutboundCommunicationChannel): string {
  const value = channel === "pec" ? recipient.pec : recipient.email;

  if (!value) {
    throw new CommunicationRecipientNotEligibleError(
      channel === "pec" ? "Il destinatario selezionato non ha un indirizzo PEC." : "Il destinatario selezionato non ha un indirizzo email."
    );
  }

  return value;
}

function createCommunicationEvent(
  communication: OutboundCommunication,
  type: "CommunicationDelivered" | "CommunicationFailed",
  occurredAt: Date
): ReportDomainEvent {
  return {
    type,
    reportId: communication.reportId,
    occurredAt,
    visibility: "internal",
    metadata: {
      communicationId: communication.id,
      communicationStatus: communication.status,
      recipientName: communication.recipientNameSnapshot,
      recipientOrganization: communication.recipientOrganizationSnapshot,
      recipientAddress: communication.recipientAddressSnapshot,
      communicationChannel: communication.channel,
      ...(communication.externalMessageId ? { externalMessageId: communication.externalMessageId } : {})
    }
  };
}

function parseCommunicationPublicCode(value: string): PublicCode {
  try {
    return PublicCode.create(value.trim().toUpperCase());
  } catch (error) {
    if (error instanceof InvalidPublicCodeError) {
      throw new CommunicationReportNotFoundError(value);
    }
    throw error;
  }
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

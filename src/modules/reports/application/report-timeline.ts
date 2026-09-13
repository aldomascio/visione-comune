import { InvalidPublicCodeError, PublicCode, type PublicReportStatus, type ReportDomainEvent, type ReportEventMetadata, type ReportEventType, type ReportEventVisibility } from "../domain";

export type ReportTimelineEvent = {
  id: string;
  reportId: string;
  type: ReportEventType;
  visibility: ReportEventVisibility;
  publicStatus?: PublicReportStatus;
  metadata?: ReportEventMetadata;
  occurredAt: Date;
};

export type ReportTimelineRepository = {
  listTimelineByReportId(reportId: string): Promise<ReportTimelineEvent[]>;
  listPublicTimelineByPublicCode(publicCode: PublicCode): Promise<ReportTimelineEvent[]>;
};

export type PublicTimelineItem = {
  id: string;
  occurredAt: Date;
  label: string;
  description: string;
};

export type AdminTimelineItem = PublicTimelineItem & {
  visibility: ReportEventVisibility;
  note?: string;
  metadataItems: Array<{ label: string; value: string }>;
};

type TimelinePresentation = {
  label: string;
  adminDescription: string;
  publicDescription?: string;
  defaultVisibility: ReportEventVisibility;
};

export const REPORT_TIMELINE_EVENT_PRESENTATION: Record<ReportEventType, TimelinePresentation> = {
  ReportCreated: {
    label: "Segnalazione ricevuta",
    adminDescription: "La segnalazione e stata registrata ed e in attesa di verifica.",
    defaultVisibility: "internal"
  },
  ReportApproved: {
    label: "Segnalazione pubblicata",
    adminDescription: "La segnalazione e stata approvata e pubblicata come Segnalata.",
    publicDescription: "Visione Comune ha verificato la segnalazione e l'ha resa pubblica.",
    defaultVisibility: "public"
  },
  ReportRejected: {
    label: "Segnalazione rifiutata",
    adminDescription: "La segnalazione e stata rifiutata e non verra pubblicata.",
    defaultVisibility: "internal"
  },
  ReportCommunicated: {
    label: "Segnalazione comunicata all'ente competente",
    adminDescription: "La segnalazione risulta comunicata all'ente competente.",
    publicDescription: "La segnalazione e stata comunicata all'ente competente.",
    defaultVisibility: "public"
  },
  ReportResolved: {
    label: "Problema risolto",
    adminDescription: "Visione Comune ha verificato la risoluzione del problema.",
    publicDescription: "Visione Comune ha verificato la risoluzione del problema.",
    defaultVisibility: "public"
  },
  CommunicationRecorded: {
    label: "Comunicazione registrata",
    adminDescription: "Una comunicazione manuale e stata registrata nel backoffice.",
    defaultVisibility: "internal"
  },
  CommunicationSent: {
    label: "Comunicazione segnata come inviata",
    adminDescription: "La comunicazione manuale risulta inviata secondo registrazione admin.",
    defaultVisibility: "internal"
  },
  CommunicationDelivered: {
    label: "Consegna comunicazione confermata",
    adminDescription: "La consegna della comunicazione e stata confermata manualmente.",
    defaultVisibility: "internal"
  },
  CommunicationFailed: {
    label: "Comunicazione non riuscita",
    adminDescription: "La comunicazione e stata marcata come non riuscita.",
    defaultVisibility: "internal"
  }
};

const ADMIN_METADATA_LABELS: Record<string, string> = {
  recipientName: "Destinatario",
  recipientOrganization: "Ente",
  recipientAddress: "Indirizzo destinatario",
  communicationChannel: "Canale",
  externalMessageId: "ID esterno",
  communicationId: "Comunicazione",
  communicationStatus: "Stato comunicazione"
};

export type GetPublicReportTimelineUseCaseDependencies = {
  timelineRepository: ReportTimelineRepository;
};

export class GetPublicReportTimelineUseCase {
  constructor(private readonly dependencies: GetPublicReportTimelineUseCaseDependencies) {}

  async execute(input: { publicCode: string }): Promise<PublicTimelineItem[]> {
    const publicCode = parsePublicCode(input.publicCode);

    if (!publicCode) {
      return [];
    }

    const events = await this.dependencies.timelineRepository.listPublicTimelineByPublicCode(publicCode);

    return sortTimelineEvents(events).flatMap((event) => {
      const item = presentPublicTimelineEvent(event);
      return item ? [item] : [];
    });
  }
}

export type GetAdminReportTimelineUseCaseDependencies = {
  timelineRepository: ReportTimelineRepository;
};

export class GetAdminReportTimelineUseCase {
  constructor(private readonly dependencies: GetAdminReportTimelineUseCaseDependencies) {}

  async execute(input: { reportId: string }): Promise<AdminTimelineItem[]> {
    const events = await this.dependencies.timelineRepository.listTimelineByReportId(input.reportId);

    return sortTimelineEvents(events).map(presentAdminTimelineEvent);
  }
}

export function presentPublicTimelineEvent(event: ReportTimelineEvent): PublicTimelineItem | null {
  if (event.visibility !== "public") {
    return null;
  }

  const presentation = REPORT_TIMELINE_EVENT_PRESENTATION[event.type];

  if (!presentation.publicDescription) {
    return null;
  }

  return {
    id: event.id,
    occurredAt: event.occurredAt,
    label: presentation.label,
    description: presentation.publicDescription
  };
}

export function presentAdminTimelineEvent(event: ReportTimelineEvent): AdminTimelineItem {
  const presentation = REPORT_TIMELINE_EVENT_PRESENTATION[event.type];
  const note = readMetadataText(event.metadata, "internalNote");

  return {
    id: event.id,
    occurredAt: event.occurredAt,
    visibility: event.visibility,
    label: presentation.label,
    description: presentation.adminDescription,
    ...(note ? { note } : {}),
    metadataItems: mapAdminMetadataItems(event.metadata)
  };
}

export function sortTimelineEvents(events: ReportTimelineEvent[]): ReportTimelineEvent[] {
  return [...events].sort((left, right) => {
    const timeDifference = left.occurredAt.getTime() - right.occurredAt.getTime();

    if (timeDifference !== 0) {
      return timeDifference;
    }

    return left.id.localeCompare(right.id);
  });
}

function mapAdminMetadataItems(metadata: ReportEventMetadata | undefined): Array<{ label: string; value: string }> {
  if (!metadata) {
    return [];
  }

  return Object.entries(ADMIN_METADATA_LABELS).flatMap(([key, label]) => {
    const value = readMetadataText(metadata, key);

    return value ? [{ label, value }] : [];
  });
}

function readMetadataText(metadata: ReportEventMetadata | undefined, key: string): string | null {
  const value = metadata?.[key];

  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function parsePublicCode(value: string): PublicCode | null {
  try {
    return PublicCode.create(value);
  } catch (error) {
    if (error instanceof InvalidPublicCodeError) {
      return null;
    }

    throw error;
  }
}

export function domainEventToTimelineEvent(event: ReportDomainEvent, id: string): ReportTimelineEvent {
  return {
    id,
    reportId: event.reportId,
    type: event.type,
    visibility: event.visibility,
    ...(event.publicStatus ? { publicStatus: event.publicStatus } : {}),
    ...(event.metadata ? { metadata: event.metadata } : {}),
    occurredAt: event.occurredAt
  };
}

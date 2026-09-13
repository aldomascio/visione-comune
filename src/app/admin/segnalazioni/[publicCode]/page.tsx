import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActiveAdmin } from "../../admin-auth";
import {
  GenerateManualCommunicationTemplateUseCase,
  ListReportCommunicationsUseCase,
  type CommunicationTemplate
} from "@/modules/communications/application/manual-communications";
import type { OutboundCommunication } from "@/modules/communications/application/communication-repository";
import { DrizzleOutboundCommunicationRepository } from "@/modules/communications/infrastructure/drizzle-outbound-communication-repository";
import type { CategoryRecipient } from "@/modules/recipients/application/recipient-repository";
import { readBaseEnv } from "@/shared/config/env";
import {
  GetReportForModerationUseCase,
  InvalidModerationPublicCodeError,
  ReportForModerationNotFoundError
} from "@/modules/reports/application/moderate-report";
import { GetAdminReportTimelineUseCase, type AdminTimelineItem } from "@/modules/reports/application/report-timeline";
import { DrizzleCategoryRepository } from "@/modules/categories/infrastructure/drizzle-category-repository";
import { DrizzleReportRepository } from "@/modules/reports/infrastructure/drizzle-report-repository";
import { DrizzleRecipientRepository } from "@/modules/recipients/infrastructure/drizzle-recipient-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Select, Textarea } from "@/shared/ui";
import { approveReportAction, createManualCommunicationAction, markCommunicationDeliveredAction, markCommunicationFailedAction, rejectReportAction } from "../actions";
import { formatAdminDate } from "../format";
import { ModerationStatusBadge, PublicStatusBadge } from "../status-badge";

type ReportDetailPageProps = {
  params: Promise<{ publicCode: string }>;
  searchParams?: Promise<{ error?: string; moderation?: string; communication?: string; communicationError?: string }>;
};

export const dynamic = "force-dynamic";

export default async function AdminReportDetailPage({ params, searchParams }: ReportDetailPageProps) {
  await requireActiveAdmin();
  const { publicCode } = await params;
  const query = await searchParams;
  const { report, recipients, communications, communicationTemplate, timeline } = await getReportPageData(publicCode);
  const canModerate = report.moderationStatus === "pending_review";

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <section className="grid gap-3">
          <Link className="text-sm font-semibold text-primary hover:underline" href="/admin/segnalazioni">
            ← Torna alle segnalazioni
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-sm font-semibold text-muted-foreground">{report.publicCode}</p>
            <ModerationStatusBadge status={report.moderationStatus} />
            <PublicStatusBadge status={report.publicStatus} />
          </div>
          <h1 className="font-serif text-4xl font-semibold tracking-normal">{report.title}</h1>
        </section>

        {query?.moderation ? <SuccessMessage type={query.moderation} /> : null}
        {query?.communication ? <CommunicationSuccessMessage type={query.communication} /> : null}
        {query?.error ? <ErrorMessage code={query.error} /> : null}
        {query?.communicationError ? <CommunicationErrorMessage message={query.communicationError} /> : null}

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Verifica segnalazione</CardTitle>
              <CardDescription>Controlla descrizione, categoria e posizione prima di moderare.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <section className="grid gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Descrizione</h2>
                <p className="whitespace-pre-wrap rounded-lg border border-border bg-background p-4 leading-7">
                  {report.description}
                </p>
              </section>


              {report.attachment ? (
                <section className="grid gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Foto allegata</h2>
                  <div className="overflow-hidden rounded-lg border border-border bg-background">
                    <img
                      alt={`Foto allegata alla segnalazione ${report.publicCode}`}
                      className="h-auto w-full object-cover"
                      src={report.attachment.url}
                    />
                  </div>
                </section>
              ) : null}

              <section className="grid gap-4 sm:grid-cols-2">
                <InfoBlock label="Categoria" value={report.categoryName ?? report.categoryId} />
                <InfoBlock label="Data invio" value={formatAdminDate(report.createdAt)} />
                <InfoBlock label="Indirizzo" value={report.location.address ?? "Non indicato"} />
                <InfoBlock label="Coordinate" value={`${report.location.latitude}, ${report.location.longitude}`} />
              </section>
              <section className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Smistamento suggerito</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">Configurazione letta dalla matrice categoria → destinatari. Nessuna comunicazione viene inviata da questa schermata.</p>
                </div>
                {recipients.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">Nessun destinatario configurato per questa categoria.</p>
                ) : (
                  <div className="grid gap-3">
                    <p className="rounded-md border border-primary/30 bg-primary/10 p-4 text-sm font-medium">
                      Destinatario suggerito: {recipients[0].name} — {recipients[0].organization}
                    </p>
                    {recipients.length > 1 ? (
                      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        {recipients.slice(1).map((recipient) => (
                          <li key={recipient.id}>{recipient.name} — {recipient.organization}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                )}
              </section>

              <CommunicationsSection
                communications={communications}
                publicCode={report.publicCode}
                recipients={recipients}
                reportCanHaveCommunications={report.moderationStatus === "approved" && Boolean(report.publicStatus)}
                template={communicationTemplate}
              />

            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Timeline completa</CardTitle>
                <CardDescription>Eventi pubblici e interni della segnalazione, ordinati cronologicamente.</CardDescription>
              </CardHeader>
              <CardContent>
                {timeline.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-muted/40 p-5 text-sm leading-6 text-muted-foreground">
                    Nessun evento registrato per questa segnalazione.
                  </div>
                ) : (
                  <ol className="grid gap-4">
                    {timeline.map((event) => (
                      <AdminTimelineListItem event={event} key={event.id} />
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>

            <Card>
            <CardHeader>
              <CardTitle>Moderazione</CardTitle>
              <CardDescription>
                {canModerate
                  ? "Approva per pubblicare come Segnalata oppure rifiuta se non pubblicabile."
                  : "Questa segnalazione e gia stata moderata."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <InfoBlock label="Stato moderazione" value={statusText(report.moderationStatus)} />
              <InfoBlock label="Stato pubblico" value={report.publicStatus ? statusText(report.publicStatus) : "Non pubblica"} />
              {report.publishedAt ? <InfoBlock label="Pubblicata il" value={formatAdminDate(report.publishedAt)} /> : null}

              {canModerate ? (
                <div className="grid gap-4">
                  <form action={approveReportAction}>
                    <input name="publicCode" type="hidden" value={report.publicCode} />
                    <Button className="w-full" type="submit">
                      Approva
                    </Button>
                  </form>

                  <form action={rejectReportAction} className="grid gap-3">
                    <input name="publicCode" type="hidden" value={report.publicCode} />
                    <label className="grid gap-2 text-sm font-medium" htmlFor="internalNote">
                      Nota interna opzionale
                      <Textarea
                        id="internalNote"
                        maxLength={1000}
                        name="internalNote"
                        placeholder="Motivo sintetico del rifiuto, visibile solo internamente."
                      />
                    </label>
                    <Button className="w-full" type="submit" variant="destructive">
                      Rifiuta
                    </Button>
                  </form>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
                  Le azioni non sono piu disponibili per evitare una doppia moderazione incoerente.
                </div>
              )}
            </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

async function getReportPageData(publicCode: string) {
  let connection;

  try {
    connection = createDatabaseConnection();
    const reportRepository = new DrizzleReportRepository(connection.db);
    const report = await new GetReportForModerationUseCase({
      reportRepository,
      categoryRepository: new DrizzleCategoryRepository(connection.db)
    }).execute({ publicCode });
    const recipientRepository = new DrizzleRecipientRepository(connection.db);
    const communicationRepository = new DrizzleOutboundCommunicationRepository(connection.db);
    const [recipients, communications, communicationTemplate, timeline] = await Promise.all([
      recipientRepository.findActiveByCategory(report.categoryId),
      new ListReportCommunicationsUseCase({ reportRepository, communicationRepository }).execute({ publicCode }),
      new GenerateManualCommunicationTemplateUseCase({
        reportRepository,
        categoryRepository: new DrizzleCategoryRepository(connection.db),
        appUrl: readBaseEnv().appUrl
      }).execute({ publicCode }),
      new GetAdminReportTimelineUseCase({ timelineRepository: reportRepository }).execute({ reportId: report.id })
    ]);

    return { report, recipients, communications, communicationTemplate, timeline };
  } catch (error) {
    if (error instanceof ReportForModerationNotFoundError || error instanceof InvalidModerationPublicCodeError) {
      notFound();
    }

    throw error;
  } finally {
    await connection?.close();
  }
}

function CommunicationsSection({
  communications,
  publicCode,
  recipients,
  reportCanHaveCommunications,
  template
}: {
  communications: OutboundCommunication[];
  publicCode: string;
  recipients: CategoryRecipient[];
  reportCanHaveCommunications: boolean;
  template: CommunicationTemplate;
}) {
  const suggestedRecipient = recipients[0];

  return (
    <section className="grid gap-4 rounded-lg border border-border bg-muted/30 p-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Comunicazioni</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Registra comunicazioni manuali verso destinatari configurati. Nessuna PEC o email viene inviata automaticamente.
        </p>
      </div>

      {suggestedRecipient ? (
        <div className="rounded-md border border-primary/30 bg-primary/10 p-4 text-sm">
          <p className="font-medium">Destinatario per comunicazione: {suggestedRecipient.name} — {suggestedRecipient.organization}</p>
          {recipients.length > 1 ? (
            <p className="mt-1 text-muted-foreground">Alternative: {recipients.slice(1).map((recipient) => `${recipient.name} — ${recipient.organization}`).join(", ")}</p>
          ) : null}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
          Nessun destinatario attivo configurato per questa categoria. Configura la matrice di smistamento prima di registrare una comunicazione.
        </p>
      )}

      <div className="grid gap-3">
        <h3 className="text-sm font-semibold">Comunicazioni registrate</h3>
        {communications.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
            Non ci sono ancora comunicazioni registrate per questa segnalazione.
          </p>
        ) : (
          <div className="grid gap-3">
            {communications.map((communication) => (
              <CommunicationListItem communication={communication} key={communication.id} publicCode={publicCode} />
            ))}
          </div>
        )}
      </div>

      <details className="rounded-md border border-border bg-background p-4" open={communications.length === 0 && reportCanHaveCommunications && recipients.length > 0}>
        <summary className="cursor-pointer text-sm font-semibold">Registra comunicazione</summary>
        {!reportCanHaveCommunications ? (
          <p className="mt-3 text-sm leading-6 text-muted-foreground">La segnalazione deve essere approvata e pubblica prima di registrare comunicazioni.</p>
        ) : recipients.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Configura almeno un destinatario attivo per questa categoria.</p>
        ) : (
          <form action={createManualCommunicationAction} className="mt-4 grid gap-4">
            <input name="publicCode" type="hidden" value={publicCode} />
            <label className="grid gap-2 text-sm font-medium" htmlFor="recipientId">
              Destinatario
              <Select id="recipientId" name="recipientId" required>
                {recipients.map((recipient) => (
                  <option key={recipient.id} value={recipient.id}>
                    {recipient.name} — {recipient.organization}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-2 text-sm font-medium" htmlFor="channel">
              Canale
              <Select id="channel" name="channel" required>
                <option value="pec">PEC</option>
                <option value="email">Email</option>
              </Select>
            </label>
            <label className="grid gap-2 text-sm font-medium" htmlFor="status">
              Stato iniziale
              <Select id="status" name="status" required>
                <option value="sent">Inviata</option>
                <option value="draft">Bozza</option>
              </Select>
            </label>
            <label className="grid gap-2 text-sm font-medium" htmlFor="subject">
              Oggetto
              <Input defaultValue={template.subject} id="subject" maxLength={240} name="subject" required />
            </label>
            <label className="grid gap-2 text-sm font-medium" htmlFor="body">
              Testo
              <Textarea defaultValue={template.body} id="body" maxLength={6000} name="body" required rows={10} />
            </label>
            <Button type="submit">Registra comunicazione</Button>
          </form>
        )}
      </details>
    </section>
  );
}

function CommunicationListItem({ communication, publicCode }: { communication: OutboundCommunication; publicCode: string }) {
  const canChangeStatus = communication.status !== "delivered" && communication.status !== "failed";

  return (
    <article className="rounded-md border border-border bg-background p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{communication.recipientNameSnapshot} — {communication.recipientOrganizationSnapshot}</p>
          <p className="mt-1 text-muted-foreground">{communication.channel.toUpperCase()} · {communication.recipientAddressSnapshot}</p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
          {communicationStatusLabel(communication.status)}
        </span>
      </div>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <InfoBlock label="Registrata il" value={formatAdminDate(communication.createdAt)} />
        {communication.sentAt ? <InfoBlock label="Inviata il" value={formatAdminDate(communication.sentAt)} /> : null}
        {communication.deliveredAt ? <InfoBlock label="Consegnata il" value={formatAdminDate(communication.deliveredAt)} /> : null}
        {communication.failedAt ? <InfoBlock label="Fallita il" value={formatAdminDate(communication.failedAt)} /> : null}
      </dl>
      <details className="mt-3 rounded-md border border-border bg-muted/30 p-3">
        <summary className="cursor-pointer font-medium">Oggetto e testo registrati</summary>
        <p className="mt-3 font-medium">{communication.subject}</p>
        <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{communication.body}</p>
      </details>
      {canChangeStatus ? (
        <div className="mt-3 flex flex-wrap gap-3">
          <form action={markCommunicationDeliveredAction}>
            <input name="publicCode" type="hidden" value={publicCode} />
            <input name="communicationId" type="hidden" value={communication.id} />
            <Button type="submit">Marca consegnata</Button>
          </form>
          <form action={markCommunicationFailedAction}>
            <input name="publicCode" type="hidden" value={publicCode} />
            <input name="communicationId" type="hidden" value={communication.id} />
            <Button type="submit" variant="outline">Marca fallita</Button>
          </form>
        </div>
      ) : null}
    </article>
  );
}

function AdminTimelineListItem({ event }: { event: AdminTimelineItem }) {
  return (
    <li className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{event.label}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{event.description}</p>
        </div>
        <TimelineVisibilityBadge visibility={event.visibility} />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{formatAdminDate(event.occurredAt)}</p>
      {event.note ? (
        <div className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-sm leading-6">
          <p className="font-medium">Nota interna</p>
          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{event.note}</p>
        </div>
      ) : null}
      {event.metadataItems.length > 0 ? (
        <dl className="mt-3 grid gap-2 text-sm">
          {event.metadataItems.map((item) => (
            <div className="rounded-md border border-border bg-muted/30 p-3" key={item.label}>
              <dt className="text-muted-foreground">{item.label}</dt>
              <dd className="mt-1 font-medium">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </li>
  );
}

function TimelineVisibilityBadge({ visibility }: { visibility: AdminTimelineItem["visibility"] }) {
  const isPublic = visibility === "public";

  return (
    <span className={isPublic ? "rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground" : "rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground"}>
      {isPublic ? "Pubblico" : "Interno"}
    </span>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function CommunicationSuccessMessage({ type }: { type: string }) {
  const messages: Record<string, string> = {
    created: "Comunicazione registrata.",
    delivered: "Comunicazione marcata come consegnata.",
    failed: "Comunicazione marcata come fallita."
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium" role="status">
      {messages[type] ?? "Comunicazione aggiornata."}
    </div>
  );
}

function CommunicationErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium" role="alert">
      {message}
    </div>
  );
}

function communicationStatusLabel(status: OutboundCommunication["status"]): string {
  const labels: Record<OutboundCommunication["status"], string> = {
    draft: "Bozza",
    sent: "Inviata",
    delivered: "Consegnata",
    failed: "Fallita"
  };

  return labels[status];
}

function SuccessMessage({ type }: { type: string }) {
  const text = type === "rejected" ? "Segnalazione rifiutata." : "Segnalazione approvata e pubblicata come Segnalata.";

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium" role="status">
      {text}
    </div>
  );
}

function ErrorMessage({ code }: { code: string }) {
  const messages: Record<string, string> = {
    "already-moderated": "La segnalazione e gia stata moderata.",
    conflict: "La segnalazione e stata modificata da un altro amministratore. Aggiorna la pagina.",
    "not-found": "Segnalazione non trovata.",
    generic: "Non e stato possibile completare la moderazione. Riprova."
  };

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium" role="alert">
      {messages[code] ?? messages.generic}
    </div>
  );
}

function statusText(status: string): string {
  const labels: Record<string, string> = {
    pending_review: "Da verificare",
    approved: "Approvata",
    rejected: "Rifiutata",
    reported: "Segnalata",
    communicated: "Comunicata",
    resolved: "Risolta"
  };

  return labels[status] ?? status;
}

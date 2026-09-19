import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActiveAdmin } from "../../admin-auth";
import {
  GenerateManualCommunicationTemplateUseCase,
  ListReportCommunicationsUseCase,
  type CommunicationTemplate
} from "@/modules/communications/application/manual-communications";
import type { OutboundCommunication } from "@/modules/communications/application/communication-repository";
import { ListReportTransmissionsUseCase } from "@/modules/communications/application/transmissions";
import type { Transmission } from "@/modules/communications/application/transmission-repository";
import { DrizzleOutboundCommunicationRepository } from "@/modules/communications/infrastructure/drizzle-outbound-communication-repository";
import type { CategoryOption } from "@/modules/categories/application/category-repository";
import type { CategoryRecipient } from "@/modules/recipients/application/recipient-repository";
import { readBaseEnv } from "@/shared/config/env";
import {
  GetReportForModerationUseCase,
  InvalidModerationPublicCodeError,
  ReportForModerationNotFoundError
} from "@/modules/reports/application/moderate-report";
import { ListReportDuplicatesUseCase, SearchPotentialPrimaryReportsUseCase } from "@/modules/reports/application/report-duplicates";
import type { DuplicateReportSummary, ModerationReportAttachment, PotentialPrimaryReport } from "@/modules/reports/application/report-repository";
import { deriveReportOperationalState, type DerivedReportOperationalState } from "@/modules/reports/application/operational-registry";
import { GetAdminReportTimelineUseCase, type AdminTimelineItem } from "@/modules/reports/application/report-timeline";
import { REPORT_SOURCE_LABELS } from "@/modules/reports/domain";
import { DrizzleCategoryRepository } from "@/modules/categories/infrastructure/drizzle-category-repository";
import { DrizzleReportRepository } from "@/modules/reports/infrastructure/drizzle-report-repository";
import { DrizzleRecipientRepository } from "@/modules/recipients/infrastructure/drizzle-recipient-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Select, Textarea } from "@/shared/ui";
import { addInternalReportNoteAction, addResolutionPhotoAction, approveReportAction, approveReportAttachmentAction, changeReportCategoryAction, createManualCommunicationAction, markCommunicationDeliveredAction, markCommunicationFailedAction, markReportDuplicateAction, rejectReportAction, rejectReportAttachmentAction, removeReportDuplicateLinkAction } from "../actions";
import { ResolveReportForm } from "./resolve-report-form";
import { formatAdminDate } from "../format";
import { ModerationStatusBadge, PublicStatusBadge } from "../status-badge";
import { transmissionStatusLabel } from "../../trasmissioni/status";

type ReportDetailPageProps = {
  params: Promise<{ publicCode: string }>;
  searchParams?: Promise<{ error?: string; moderation?: string; communication?: string; communicationError?: string; resolution?: string; resolutionError?: string; duplicate?: string; duplicateError?: string; duplicateQuery?: string; attachment?: string; attachmentError?: string; operational?: string; operationalError?: string }>;
};

export const dynamic = "force-dynamic";

export default async function AdminReportDetailPage({ params, searchParams }: ReportDetailPageProps) {
  await requireActiveAdmin();
  const { publicCode } = await params;
  const query = await searchParams;
  const { report, recipients, activeCategories, communications, transmissions, communicationTemplate, timeline, duplicateSearchResults, linkedDuplicates, operationalState } = await getReportPageData(publicCode, query?.duplicateQuery);
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
        {query?.resolution ? <ResolutionSuccessMessage type={query.resolution} /> : null}
        {query?.duplicate ? <DuplicateSuccessMessage type={query.duplicate} /> : null}
        {query?.attachment ? <AttachmentSuccessMessage type={query.attachment} /> : null}
        {query?.operational ? <OperationalSuccessMessage type={query.operational} /> : null}
        {query?.error ? <ErrorMessage code={query.error} /> : null}
        {query?.communicationError ? <CommunicationErrorMessage message={query.communicationError} /> : null}
        {query?.resolutionError ? <ResolutionErrorMessage code={query.resolutionError} /> : null}
        {query?.duplicateError ? <DuplicateErrorMessage code={query.duplicateError} /> : null}
        {query?.attachmentError ? <AttachmentErrorMessage message={query.attachmentError} /> : null}
        {query?.operationalError ? <OperationalErrorMessage message={query.operationalError} /> : null}

        <OperationalSummaryCard
          latestTransmission={transmissions[0]}
          operationalState={operationalState}
          report={report}
        />

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


              <AttachmentReviewSection
                attachment={report.attachments.find((attachment) => attachment.type === "report_photo")}
                publicCode={report.publicCode}
                type="report_photo"
              />

              <section className="grid gap-4 sm:grid-cols-2">
                <InfoBlock label="Categoria" value={report.categoryName ?? report.categoryId} />
                <InfoBlock label="Fonte" value={REPORT_SOURCE_LABELS[report.source]} />
                <InfoBlock label="Creato da" value={report.createdByAdmin ? report.createdByAdmin.email : "Form pubblico"} />
                <InfoBlock label="Data invio" value={formatAdminDate(report.createdAt)} />
                <InfoBlock label="Indirizzo" value={report.location.address ?? "Non indicato"} />
                <InfoBlock label="Coordinate" value={`${report.location.latitude}, ${report.location.longitude}`} />
              </section>

              <CategoryChangeSection
                activeCategories={activeCategories}
                currentCategoryId={report.categoryId}
                publicCode={report.publicCode}
              />

              <InternalNoteSection publicCode={report.publicCode} />

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

              <ReportTransmissionsSection transmissions={transmissions} />

            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Registro operativo</CardTitle>
                <CardDescription>Eventi pubblici, interni e tecnici visibili solo nel backoffice, ordinati cronologicamente.</CardDescription>
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

            <DuplicatesCard
              duplicateQuery={query?.duplicateQuery ?? ""}
              linkedDuplicates={linkedDuplicates}
              primaryCandidates={duplicateSearchResults}
              report={report}
            />

            <ResolutionCard
              attachment={report.attachments.find((attachment) => attachment.type === "resolution_photo")}
              communicatedAt={report.communicatedAt}
              publicCode={report.publicCode}
              publicStatus={report.publicStatus}
              resolvedAt={report.resolvedAt}
            />

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
              {report.communicatedAt ? <InfoBlock label="Comunicata il" value={formatAdminDate(report.communicatedAt)} /> : null}
              {report.resolvedAt ? <InfoBlock label="Risolta il" value={formatAdminDate(report.resolvedAt)} /> : null}

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

async function getReportPageData(publicCode: string, duplicateQuery = "") {
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
    const categoryRepository = new DrizzleCategoryRepository(connection.db);
    const [recipients, activeCategories, communications, transmissions, communicationTemplate, timeline, duplicateSearchResults, linkedDuplicates] = await Promise.all([
      recipientRepository.findActiveByCategory(report.categoryId),
      categoryRepository.listActive(),
      new ListReportCommunicationsUseCase({ reportRepository, communicationRepository }).execute({ publicCode }),
      new ListReportTransmissionsUseCase({ transmissionRepository: communicationRepository }).execute({ reportId: report.id }),
      new GenerateManualCommunicationTemplateUseCase({
        reportRepository,
        categoryRepository,
        appUrl: readBaseEnv().appUrl
      }).execute({ publicCode }),
      new GetAdminReportTimelineUseCase({ timelineRepository: reportRepository }).execute({ reportId: report.id }),
      new SearchPotentialPrimaryReportsUseCase({ reportRepository }).execute({ publicCode, query: duplicateQuery }),
      new ListReportDuplicatesUseCase({ reportRepository }).execute({ publicCode })
    ]);

    return {
      report,
      recipients,
      activeCategories,
      communications,
      transmissions,
      communicationTemplate,
      timeline,
      duplicateSearchResults,
      linkedDuplicates,
      operationalState: deriveReportOperationalState({
        report: {
          moderationStatus: report.moderationStatus,
          publicStatus: report.publicStatus,
          duplicateOfReportId: report.duplicateOf ? report.duplicateOf.publicCode : undefined
        },
        transmissions
      })
    };
  } catch (error) {
    if (error instanceof ReportForModerationNotFoundError || error instanceof InvalidModerationPublicCodeError) {
      notFound();
    }

    throw error;
  } finally {
    await connection?.close();
  }
}



function OperationalSummaryCard({
  latestTransmission,
  operationalState,
  report,
}: {
  latestTransmission?: Transmission;
  operationalState: DerivedReportOperationalState;
  report: Awaited<ReturnType<typeof getReportPageData>>["report"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quadro operativo</CardTitle>
        <CardDescription>Vista interna derivata dagli stati esistenti. Non introduce nuovi stati pubblici o workflow persistiti.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoBlock label="Stato operativo" value={operationalState.label} />
        <InfoBlock label="Dettaglio operativo" value={operationalState.description} />
        <InfoBlock label="Stato pubblico" value={report.publicStatus ? statusText(report.publicStatus) : "Non pubblica"} />
        <InfoBlock label="Moderazione" value={statusText(report.moderationStatus)} />
        <InfoBlock label="Fonte" value={REPORT_SOURCE_LABELS[report.source]} />
        <InfoBlock label="Categoria" value={report.categoryName ?? report.categoryId} />
        <InfoBlock label="Duplicato" value={report.duplicateOf ? `Di ${report.duplicateOf.publicCode}` : "No"} />
        <InfoBlock
          label="Ultima trasmissione"
          value={latestTransmission ? `${latestTransmission.recipientNameSnapshot} · ${transmissionStatusLabel(latestTransmission.status)}` : "Nessuna"}
        />
      </CardContent>
    </Card>
  );
}

function CategoryChangeSection({
  activeCategories,
  currentCategoryId,
  publicCode,
}: {
  activeCategories: CategoryOption[];
  currentCategoryId: string;
  publicCode: string;
}) {
  return (
    <section className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Categoria operativa</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Cambiare categoria aggiorna lo smistamento suggerito futuro e registra un evento interno. Le trasmissioni gia create non vengono modificate.
        </p>
      </div>
      <form action={changeReportCategoryAction} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <input name="publicCode" type="hidden" value={publicCode} />
        <label className="grid gap-2 text-sm font-medium" htmlFor="categoryId">
          Categoria
          <Select defaultValue={currentCategoryId} id="categoryId" name="categoryId" required>
            {activeCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </label>
        <Button type="submit" variant="outline">Aggiorna categoria</Button>
      </form>
    </section>
  );
}

function InternalNoteSection({ publicCode }: { publicCode: string }) {
  return (
    <section className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Note interne</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Le note sono immutabili, visibili solo agli amministratori e non entrano nella timeline pubblica.</p>
      </div>
      <form action={addInternalReportNoteAction} className="grid gap-3">
        <input name="publicCode" type="hidden" value={publicCode} />
        <label className="grid gap-2 text-sm font-medium" htmlFor="standaloneInternalNote">
          Nuova nota
          <Textarea
            id="standaloneInternalNote"
            maxLength={1000}
            name="internalNote"
            placeholder="Annotazione operativa interna, visibile solo nel backoffice."
            required
            rows={4}
          />
        </label>
        <Button className="w-fit" type="submit">Aggiungi nota</Button>
      </form>
    </section>
  );
}

function DuplicatesCard({
  duplicateQuery,
  linkedDuplicates,
  primaryCandidates,
  report
}: {
  duplicateQuery: string;
  linkedDuplicates: DuplicateReportSummary[];
  primaryCandidates: PotentialPrimaryReport[];
  report: Awaited<ReturnType<typeof getReportPageData>>["report"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Duplicati</CardTitle>
        <CardDescription>Collega questa segnalazione a una principale senza cancellare codice, storico o allegati.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {report.duplicateOf ? (
          <div className="grid gap-4 rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm">
            <div>
              <p className="font-semibold">Duplicata di {report.duplicateOf.publicCode}</p>
              <p className="mt-1 text-muted-foreground">{report.duplicateOf.title}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link className="text-sm font-semibold text-primary hover:underline" href={`/admin/segnalazioni/${report.duplicateOf.publicCode}`}>
                Apri principale
              </Link>
              <form action={removeReportDuplicateLinkAction}>
                <input name="publicCode" type="hidden" value={report.publicCode} />
                <input name="primaryPublicCode" type="hidden" value={report.duplicateOf.publicCode} />
                <Button type="submit" variant="outline">Rimuovi collegamento</Button>
              </form>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            <form className="grid gap-3" method="get">
              <label className="grid gap-2 text-sm font-medium" htmlFor="duplicateQuery">
                Cerca segnalazione principale
                <Input defaultValue={duplicateQuery} id="duplicateQuery" name="duplicateQuery" placeholder="VC-XXXXXXXX o titolo" />
              </label>
              <Button type="submit" variant="outline">Cerca principale</Button>
            </form>
            {primaryCandidates.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
                Nessuna principale pubblica disponibile per la ricerca corrente. Sono escluse la segnalazione stessa e le segnalazioni gia duplicate.
              </p>
            ) : (
              <div className="grid gap-3">
                {primaryCandidates.map((candidate) => (
                  <article className="rounded-md border border-border bg-background p-4 text-sm" key={candidate.publicCode}>
                    <div className="grid gap-1">
                      <p className="font-mono text-xs font-semibold text-muted-foreground">{candidate.publicCode}</p>
                      <p className="font-semibold">{candidate.title}</p>
                      <p className="text-muted-foreground">{candidate.categoryName} · {statusText(candidate.publicStatus ?? candidate.moderationStatus)} · {formatAdminDate(candidate.createdAt)}</p>
                    </div>
                    <form action={markReportDuplicateAction} className="mt-3">
                      <input name="publicCode" type="hidden" value={report.publicCode} />
                      <input name="primaryPublicCode" type="hidden" value={candidate.publicCode} />
                      <Button type="submit">Segna come duplicata di {candidate.publicCode}</Button>
                    </form>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid gap-3">
          <h3 className="text-sm font-semibold">Segnalazioni collegate</h3>
          {linkedDuplicates.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
              Nessuna segnalazione e stata collegata a questa come duplicata.
            </p>
          ) : (
            <div className="grid gap-3">
              {linkedDuplicates.map((duplicate) => (
                <article className="rounded-md border border-border bg-background p-4 text-sm" key={duplicate.publicCode}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs font-semibold text-muted-foreground">{duplicate.publicCode}</p>
                      <p className="mt-1 font-semibold">{duplicate.title}</p>
                      <p className="mt-1 text-muted-foreground">{REPORT_SOURCE_LABELS[duplicate.source]} · {formatAdminDate(duplicate.createdAt)} · {duplicate.confirmationsCount} conferme storiche</p>
                    </div>
                    <Link className="text-sm font-semibold text-primary hover:underline" href={`/admin/segnalazioni/${duplicate.publicCode}`}>Apri</Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ReportTransmissionsSection({ transmissions }: { transmissions: Transmission[] }) {
  return (
    <section className="grid gap-4 rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Trasmissioni</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Registro delle trasmissioni che includono questa segnalazione.</p>
        </div>
        <Link className="text-sm font-semibold text-primary hover:underline" href="/admin/trasmissioni/nuova">Nuova trasmissione</Link>
      </div>
      {transmissions.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
          Questa segnalazione non e ancora inclusa in nessuna trasmissione.
        </p>
      ) : (
        <div className="grid gap-3">
          {transmissions.map((transmission) => (
            <article className="rounded-md border border-border bg-background p-4 text-sm" key={transmission.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{transmission.recipientNameSnapshot} — {transmission.recipientOrganizationSnapshot}</p>
                  <p className="mt-1 text-muted-foreground">{formatAdminDate(transmission.createdAt)} · {transmission.channel.toUpperCase()} · {transmission.reportCount} segnalazioni · {transmissionStatusLabel(transmission.status)}</p>
                </div>
                <Link className="font-semibold text-primary hover:underline" href={`/admin/trasmissioni/${transmission.id}`}>Apri</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
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

function AttachmentReviewSection({
  attachment,
  publicCode,
  type
}: {
  attachment?: ModerationReportAttachment;
  publicCode: string;
  type: "report_photo" | "resolution_photo";
}) {
  const title = type === "report_photo" ? "Foto segnalazione" : "Foto risoluzione";
  const description = type === "report_photo"
    ? "Foto originale caricata insieme alla segnalazione. La pubblicazione richiede approvazione separata."
    : "Foto di verifica della risoluzione. Nasce da verificare anche se caricata da admin.";

  return (
    <section className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>

      {attachment ? (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-background px-3 py-1 font-semibold">{attachmentTypeLabel(attachment.type)}</span>
            <span className="rounded-full bg-background px-3 py-1 font-semibold">{attachmentReviewStatusLabel(attachment.reviewStatus)}</span>
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-background">
            <img
              alt={`${title} ${publicCode}`}
              className="h-auto w-full object-cover"
              src={attachment.url}
            />
          </div>
          <p className="text-xs text-muted-foreground">{attachment.mimeType} · {formatFileSize(attachment.size)}</p>
          {attachment.reviewStatus === "pending_review" ? (
            <div className="flex flex-wrap gap-3">
              <form action={approveReportAttachmentAction}>
                <input name="publicCode" type="hidden" value={publicCode} />
                <input name="attachmentType" type="hidden" value={type} />
                <Button type="submit">Approva foto</Button>
              </form>
              <form action={rejectReportAttachmentAction}>
                <input name="publicCode" type="hidden" value={publicCode} />
                <input name="attachmentType" type="hidden" value={type} />
                <Button type="submit" variant="destructive">Rifiuta foto</Button>
              </form>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
          Nessuna foto presente per questa sezione.
        </p>
      )}
    </section>
  );
}

function ResolutionCard({
  attachment,
  communicatedAt,
  publicCode,
  publicStatus,
  resolvedAt
}: {
  attachment?: ModerationReportAttachment;
  communicatedAt?: Date;
  publicCode: string;
  publicStatus?: string;
  resolvedAt?: Date;
}) {
  const canResolve = publicStatus === "communicated";
  const canUploadResolutionPhoto = publicStatus === "communicated" || publicStatus === "resolved";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risoluzione</CardTitle>
        <CardDescription>
          La risoluzione viene impostata solo dopo verifica di Visione Comune. La foto di risoluzione e opzionale.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {communicatedAt ? <InfoBlock label="Comunicata il" value={formatAdminDate(communicatedAt)} /> : null}
        {resolvedAt ? <InfoBlock label="Risolta il" value={formatAdminDate(resolvedAt)} /> : null}

        <AttachmentReviewSection attachment={attachment} publicCode={publicCode} type="resolution_photo" />

        {canUploadResolutionPhoto && !attachment ? (
          <form action={addResolutionPhotoAction} className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4">
            <input name="publicCode" type="hidden" value={publicCode} />
            <div className="grid gap-2 text-sm font-medium">
              <span>Carica foto di risoluzione</span>
              <input accept="image/*" className="sr-only" id="resolutionPhoto" name="resolutionPhoto" type="file" />
              <label className="inline-flex min-h-10 w-fit cursor-pointer items-center justify-center rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background" htmlFor="resolutionPhoto">
                Scegli foto
              </label>
            </div>
            <Button type="submit">Carica foto risoluzione</Button>
          </form>
        ) : null}

        {canResolve ? (
          <ResolveReportForm publicCode={publicCode} />
        ) : publicStatus === "resolved" ? (
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm leading-6">
            Stato finale raggiunto: questa segnalazione e gia marcata come Risolta.
          </div>
        ) : publicStatus === "reported" ? (
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
            La CTA di risoluzione sara disponibile dopo che una comunicazione sara marcata come consegnata e la segnalazione diventera Comunicata.
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
            La risoluzione e disponibile solo per segnalazioni approvate, pubbliche e gia Comunicate.
          </div>
        )}
      </CardContent>
    </Card>
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



function OperationalSuccessMessage({ type }: { type: string }) {
  const messages: Record<string, string> = {
    "category-changed": "Categoria aggiornata e registrata nel registro operativo.",
    "note-added": "Nota interna aggiunta al registro operativo."
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium" role="status">
      {messages[type] ?? "Registro operativo aggiornato."}
    </div>
  );
}

function OperationalErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium" role="alert">
      {message}
    </div>
  );
}

function AttachmentSuccessMessage({ type }: { type: string }) {
  const messages: Record<string, string> = {
    "resolution-added": "Foto di risoluzione caricata e in attesa di verifica.",
    approved: "Foto approvata.",
    rejected: "Foto rifiutata."
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium" role="status">
      {messages[type] ?? "Foto aggiornata."}
    </div>
  );
}

function AttachmentErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium" role="alert">
      {message}
    </div>
  );
}

function DuplicateSuccessMessage({ type }: { type: string }) {
  const messages: Record<string, string> = {
    linked: "Segnalazione collegata come duplicata.",
    removed: "Collegamento duplicato rimosso."
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium" role="status">
      {messages[type] ?? "Collegamento duplicati aggiornato."}
    </div>
  );
}

function DuplicateErrorMessage({ code }: { code: string }) {
  const messages: Record<string, string> = {
    "invalid-target": "La principale deve essere una segnalazione pubblica non duplicata e non puo coincidere con questa segnalazione.",
    conflict: "Il collegamento e stato modificato da un altro amministratore. Aggiorna la pagina.",
    "not-found": "Segnalazione non trovata.",
    generic: "Non e stato possibile aggiornare il collegamento duplicato. Riprova."
  };

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium" role="alert">
      {messages[code] ?? messages.generic}
    </div>
  );
}

function ResolutionSuccessMessage({ type }: { type: string }) {
  const messages: Record<string, string> = {
    resolved: "Segnalazione marcata come risolta."
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium" role="status">
      {messages[type] ?? "Risoluzione aggiornata."}
    </div>
  );
}

function ResolutionErrorMessage({ code }: { code: string }) {
  const messages: Record<string, string> = {
    "not-allowed": "La segnalazione puo essere risolta solo quando e Comunicata.",
    conflict: "La segnalazione e stata modificata da un altro amministratore. Aggiorna la pagina.",
    "not-found": "Segnalazione non trovata.",
    generic: "Non e stato possibile marcare la segnalazione come risolta. Riprova."
  };

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium" role="alert">
      {messages[code] ?? messages.generic}
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

function attachmentTypeLabel(type: "report_photo" | "resolution_photo"): string {
  return type === "report_photo" ? "Foto segnalazione" : "Foto risoluzione";
}

function attachmentReviewStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending_review: "Foto da verificare",
    approved: "Foto approvata",
    rejected: "Foto rifiutata"
  };

  return labels[status] ?? status;
}

function formatFileSize(size: number): string {
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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

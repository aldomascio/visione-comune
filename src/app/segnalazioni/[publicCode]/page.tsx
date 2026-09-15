import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import {
  createReportConfirmationAntiAbuseKey,
  isValidReportConfirmationCookieValue,
  REPORT_CONFIRMATION_COOKIE_NAME
} from "@/modules/reports/application/confirmations/anti-abuse-key";
import { GetReportConfirmationStateUseCase } from "@/modules/reports/application/confirmations/report-confirmations";
import { GetPublicReportUseCase, PublicReportNotFoundError } from "@/modules/reports/application/public-report";
import { GetPublicReportTimelineUseCase } from "@/modules/reports/application/report-timeline";
import { PUBLIC_REPORT_STATUS_LABELS } from "@/modules/reports/domain";
import { DrizzleReportConfirmationRepository } from "@/modules/reports/infrastructure/confirmations/drizzle-report-confirmation-repository";
import { DrizzleReportRepository } from "@/modules/reports/infrastructure/drizzle-report-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";
import { ConfirmReportForm } from "./confirm-report-form";

type PublicReportPageProps = {
  params: Promise<{ publicCode: string }>;
};

export const dynamic = "force-dynamic";

export default async function PublicReportPage({ params }: PublicReportPageProps) {
  const { publicCode } = await params;
  const { report, timeline, confirmationState } = await getPublicReportPageData(publicCode);

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <section className="grid gap-3">
          <Link className="text-sm font-semibold text-primary hover:underline" href="/segnalazione">
            ← Controlla un altro codice
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-sm font-semibold text-muted-foreground">{report.publicCode}</p>
            <Badge>{PUBLIC_REPORT_STATUS_LABELS[report.publicStatus]}</Badge>
          </div>
          <h1 className="font-serif text-4xl font-semibold tracking-normal">{report.title}</h1>
          <p className="max-w-6xl text-base leading-7 text-muted-foreground">
            Scheda pubblica della segnalazione verificata da Visione Comune.
          </p>
        </section>

        {report.duplicateOf ? (
          <Card className="border-primary/40 bg-primary/10">
            <CardHeader>
              <CardTitle>Questa segnalazione riguarda un problema gia segnalato.</CardTitle>
              <CardDescription>
                Segui la segnalazione principale {report.duplicateOf.publicCode} per gli aggiornamenti. Il codice originale resta valido e questa scheda rimane consultabile.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                href={`/segnalazioni/${report.duplicateOf.publicCode}`}
              >
                Vai alla segnalazione principale
              </Link>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Dettagli segnalazione</CardTitle>
              <CardDescription>Informazioni pubbliche disponibili.</CardDescription>
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
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Foto</h2>
                  <div className="overflow-hidden rounded-lg border border-border bg-background">
                    <img
                      alt={`Foto della segnalazione ${report.publicCode}`}
                      className="h-auto w-full object-cover"
                      src={report.attachment.url}
                    />
                  </div>
                </section>
              ) : null}

              <section className="grid gap-4 sm:grid-cols-2">
                <InfoBlock label="Categoria" value={report.categoryName} />
                <InfoBlock label="Stato" value={PUBLIC_REPORT_STATUS_LABELS[report.publicStatus]} />
                <InfoBlock label="Data segnalazione" value={formatPublicDate(report.createdAt)} />
                <InfoBlock label="Data pubblicazione" value={formatPublicDate(report.publishedAt)} />
                {report.communicatedAt ? <InfoBlock label="Data comunicazione" value={formatPublicDate(report.communicatedAt)} /> : null}
                {report.resolvedAt ? <InfoBlock label="Data risoluzione" value={formatPublicDate(report.resolvedAt)} /> : null}
                <InfoBlock label="Indirizzo" value={report.address ?? "Non indicato"} />
                <InfoBlock label="Posizione" value={`${report.latitude}, ${report.longitude}`} />
              </section>
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card id="conferma">
              <CardHeader>
                <CardTitle>Conferme ricevute</CardTitle>
                <CardDescription>
                  La conferma indica che lo stesso problema e stato riscontrato anche da altri. Non e un voto e non abilita commenti.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="rounded-lg border border-border bg-background p-4">
                  <p className="text-sm text-muted-foreground">Conferme aggiuntive</p>
                  <p className="mt-2 text-2xl font-semibold">{formatConfirmationCount(confirmationState.count)}</p>
                </div>
                <ConfirmReportForm
                  alreadyConfirmed={confirmationState.alreadyConfirmed}
                  confirmable={confirmationState.confirmable}
                  primaryPublicCode={report.duplicateOf?.publicCode}
                  publicCode={report.publicCode}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Timeline pubblica</CardTitle>
                <CardDescription>Mostra solo gli aggiornamenti pubblici della segnalazione.</CardDescription>
              </CardHeader>
              <CardContent>
                {timeline.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-muted/40 p-5 text-sm leading-6 text-muted-foreground">
                    Non ci sono ancora aggiornamenti pubblici oltre alla scheda della segnalazione.
                  </div>
                ) : (
                  <ol className="grid gap-4">
                    {timeline.map((event) => (
                      <li className="rounded-lg border border-border bg-background p-4" key={event.id}>
                        <p className="font-medium">{event.label}</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{event.description}</p>
                        <p className="mt-2 text-sm text-muted-foreground">{formatPublicDate(event.occurredAt)}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

async function getPublicReportPageData(publicCode: string) {
  let connection;

  try {
    connection = createDatabaseConnection();
    const reportRepository = new DrizzleReportRepository(connection.db);
    const confirmationRepository = new DrizzleReportConfirmationRepository(connection.db);
    const report = await new GetPublicReportUseCase({ reportRepository }).execute({ publicCode });
    const timeline = await new GetPublicReportTimelineUseCase({ timelineRepository: reportRepository }).execute({ publicCode });
    const cookieValue = (await cookies()).get(REPORT_CONFIRMATION_COOKIE_NAME)?.value;
    const antiAbuseKey = isValidReportConfirmationCookieValue(cookieValue)
      ? createReportConfirmationAntiAbuseKey(cookieValue)
      : undefined;
    const confirmationState = await new GetReportConfirmationStateUseCase({
      reportRepository,
      confirmationRepository
    }).execute({ publicCode, antiAbuseKey });

    return { report, timeline, confirmationState };
  } catch (error) {
    if (error instanceof PublicReportNotFoundError) {
      notFound();
    }

    throw error;
  } finally {
    await connection?.close();
  }
}


function formatConfirmationCount(count: number): string {
  if (count === 0) {
    return "Nessuna conferma ricevuta";
  }

  if (count === 1) {
    return "1 conferma ricevuta";
  }

  return `${count} conferme ricevute`;
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function formatPublicDate(date: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Rome"
  }).format(date);
}

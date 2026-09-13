import Link from "next/link";
import { notFound } from "next/navigation";
import { GetPublicReportTimelineUseCase, GetPublicReportUseCase, PublicReportNotFoundError } from "@/modules/reports/application/public-report";
import { PUBLIC_REPORT_STATUS_LABELS, type PublicReportStatus } from "@/modules/reports/domain";
import { DrizzleReportRepository } from "@/modules/reports/infrastructure/drizzle-report-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";

type PublicReportPageProps = {
  params: Promise<{ publicCode: string }>;
};

export const dynamic = "force-dynamic";

export default async function PublicReportPage({ params }: PublicReportPageProps) {
  const { publicCode } = await params;
  const { report, timeline } = await getPublicReportPageData(publicCode);

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-5xl gap-8">
        <section className="grid gap-3">
          <Link className="text-sm font-semibold text-primary hover:underline" href="/segnalazione">
            ← Controlla un altro codice
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-sm font-semibold text-muted-foreground">{report.publicCode}</p>
            <Badge>{PUBLIC_REPORT_STATUS_LABELS[report.publicStatus]}</Badge>
          </div>
          <h1 className="font-serif text-4xl font-semibold tracking-normal">{report.title}</h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground">
            Scheda pubblica della segnalazione verificata da Visione Comune.
          </p>
        </section>

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
                <InfoBlock label="Indirizzo" value={report.address ?? "Non indicato"} />
                <InfoBlock label="Posizione" value={`${report.latitude}, ${report.longitude}`} />
              </section>
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
                    <li className="rounded-lg border border-border bg-background p-4" key={`${event.type}-${event.occurredAt.toISOString()}`}>
                      <p className="font-medium">{publicEventLabel(event.type, event.publicStatus)}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{formatPublicDate(event.occurredAt)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
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
    const report = await new GetPublicReportUseCase({ reportRepository }).execute({ publicCode });
    const timeline = await new GetPublicReportTimelineUseCase({ reportRepository }).execute({ publicCode });

    return { report, timeline };
  } catch (error) {
    if (error instanceof PublicReportNotFoundError) {
      notFound();
    }

    throw error;
  } finally {
    await connection?.close();
  }
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

function publicEventLabel(type: string, publicStatus?: PublicReportStatus): string {
  if (type === "ReportApproved") {
    return "Segnalazione verificata e pubblicata";
  }

  if (type === "ReportCommunicated") {
    return "Segnalazione comunicata all'ente";
  }

  if (type === "ReportResolved") {
    return "Segnalazione risolta";
  }

  return publicStatus ? PUBLIC_REPORT_STATUS_LABELS[publicStatus] : "Aggiornamento pubblico";
}

import Link from "next/link";
import { cookies } from "next/headers";
import { MapPin } from "lucide-react";
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
import { readPublicMapConfig } from "@/shared/config/map";
import { createDatabaseConnection } from "@/shared/db/client";
import { Badge } from "@/shared/ui";
import { ConfirmReportForm } from "./confirm-report-form";
import { PublicReportLocationMap } from "./public-report-location-map";

type PublicReportPageProps = {
  params: Promise<{ publicCode: string }>;
};

export const dynamic = "force-dynamic";

export default async function PublicReportPage({ params }: PublicReportPageProps) {
  const { publicCode } = await params;
  const { report, timeline, confirmationState, mapConfig } = await getPublicReportPageData(publicCode);
  const publicStatusLabel = PUBLIC_REPORT_STATUS_LABELS[report.publicStatus];

  return (
    <main className="bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <article className="mx-auto grid w-full max-w-3xl gap-8">
        <header className="grid gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>{publicStatusLabel}</Badge>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{report.categoryName}</p>
          </div>

          <div className="grid gap-3">
            <h1 className="font-serif text-4xl font-semibold tracking-normal sm:text-5xl">{report.title}</h1>
            {report.address ? (
              <div className="flex items-start gap-1.5 text-sm leading-6 text-foreground sm:text-base sm:leading-7">
                <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-foreground sm:mt-1" />
                <p>{report.address}</p>
              </div>
            ) : null}
          </div>
        </header>

        {report.duplicateOf ? (
          <section className="grid gap-3 rounded-xl bg-muted/40 px-4 py-3 text-sm sm:flex sm:items-center sm:justify-between sm:gap-4">
            <p className="leading-6 text-foreground">
              Questa segnalazione riguarda un problema già segnalato nella stessa area.
            </p>
            <Link
              className="inline-flex w-fit items-center gap-2 font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              href={`/segnalazioni/${report.duplicateOf.publicCode}`}
            >
              Vai alla principale
              <span aria-hidden="true">→</span>
            </Link>
          </section>
        ) : null}

        <section className="grid gap-4">
          <p className="whitespace-pre-wrap text-base leading-8 text-foreground sm:text-lg">{report.description}</p>

          {report.reportPhoto ? (
            <figure className="grid gap-2">
              <div className="overflow-hidden rounded-xl bg-muted">
                <img
                  alt={`Foto della segnalazione ${report.publicCode}`}
                  className="max-h-[28rem] w-full object-cover"
                  src={report.reportPhoto.url}
                />
              </div>
              <figcaption className="text-sm text-muted-foreground">Foto segnalazione</figcaption>
            </figure>
          ) : null}

          {report.resolutionPhoto ? (
            <figure className="grid gap-2">
              <div className="overflow-hidden rounded-xl bg-muted">
                <img
                  alt={`Foto di verifica della risoluzione ${report.publicCode}`}
                  className="max-h-[28rem] w-full object-cover"
                  src={report.resolutionPhoto.url}
                />
              </div>
              <figcaption className="text-sm text-muted-foreground">Foto risoluzione</figcaption>
            </figure>
          ) : null}
        </section>

        <PublicReportLocationMap
          address={report.address}
          config={mapConfig}
          latitude={report.latitude}
          longitude={report.longitude}
          publicCode={report.publicCode}
        />

        <section className="grid gap-4 rounded-xl bg-muted/40 p-5 sm:grid-cols-[1fr_auto] sm:items-center" id="conferma">
          <div className="grid gap-1">
            <p className="text-2xl font-semibold text-foreground">{formatConfirmationCount(confirmationState.count)}</p>
            <p className="text-sm leading-6 text-muted-foreground">I cittadini hanno riscontrato questo problema.</p>
          </div>
          <ConfirmReportForm
            alreadyConfirmed={confirmationState.alreadyConfirmed}
            confirmable={confirmationState.confirmable}
            primaryPublicCode={report.duplicateOf?.publicCode}
            publicCode={report.publicCode}
          />
        </section>

        {timeline.length > 0 ? (
          <section className="grid gap-5 pt-6">
            <h2 className="font-serif text-3xl font-semibold tracking-normal">Aggiornamenti</h2>
            <ol className="grid gap-5">
              {timeline.map((event) => (
                <li className="grid grid-cols-[auto_1fr] gap-3" key={event.id}>
                  <span className="mt-1.5 size-2.5 rounded-full bg-primary" aria-hidden="true" />
                  <div className="grid gap-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <p className="font-medium">{event.label}</p>
                      <p className="text-sm text-muted-foreground">{formatPublicDate(event.occurredAt)}</p>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">{event.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </article>
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

    return {
      report,
      timeline,
      confirmationState,
      mapConfig: readPublicMapConfig()
    };
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


function formatPublicDate(date: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Rome"
  }).format(date);
}

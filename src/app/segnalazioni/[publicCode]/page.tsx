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
import { formatStreetAddress } from "@/shared/format/address";
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
      <article className="mx-auto grid w-full max-w-6xl gap-8">
        <header className="grid gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>{publicStatusLabel}</Badge>
            <p className="text-sm font-normal text-muted-foreground">{report.categoryName}</p>
          </div>

          <div className="grid gap-3">
            <h1 className="font-serif text-4xl font-semibold tracking-normal sm:text-5xl">{report.title}</h1>
            {report.address ? (
              <div className="flex items-start gap-1.5 text-sm leading-6 text-foreground sm:text-base sm:leading-7">
                <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-foreground sm:mt-1" />
                <p>{formatStreetAddress(report.address)}</p>
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

        <div className="grid gap-10 lg:grid-cols-3 lg:items-start">
          <div className="grid gap-8 lg:col-span-2">
            <section className="grid gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">Descrizione</h2>
              <p className="whitespace-pre-wrap text-base leading-8 text-foreground sm:text-lg">{report.description}</p>
            </section>

            {report.reportPhoto ? (
              <figure className="grid gap-2">
                <figcaption className="text-sm font-medium text-muted-foreground">Foto segnalazione</figcaption>
                <div className="overflow-hidden rounded-xl bg-foreground">
                  <img
                    alt={`Foto della segnalazione ${report.publicCode}`}
                    className="h-auto w-full object-contain sm:max-h-[28rem]"
                    src={report.reportPhoto.url}
                  />
                </div>
              </figure>
            ) : null}

            {report.resolutionPhoto ? (
              <figure className="grid gap-2">
                <figcaption className="text-sm font-medium text-muted-foreground">Foto risoluzione</figcaption>
                <div className="overflow-hidden rounded-xl bg-foreground">
                  <img
                    alt={`Foto di verifica della risoluzione ${report.publicCode}`}
                    className="h-auto w-full object-contain sm:max-h-[28rem]"
                    src={report.resolutionPhoto.url}
                  />
                </div>
              </figure>
            ) : null}

            <section className="grid gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">Posizione</h2>
              <PublicReportLocationMap
                address={report.address}
                config={mapConfig}
                latitude={report.latitude}
                longitude={report.longitude}
                publicCode={report.publicCode}
              />
            </section>

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
          </div>

          {timeline.length > 0 ? (
            <section className="grid gap-5 rounded-xl bg-muted/40 p-5 lg:sticky lg:top-36 lg:self-start">
              <h2 className="font-serif text-3xl font-semibold tracking-normal">Aggiornamenti</h2>
              <ol className="grid">
                {timeline.map((event, index) => (
                  <li className="grid grid-cols-[auto_1fr] gap-3" key={event.id}>
                    <div className="flex flex-col items-center" aria-hidden="true">
                      <span className={index > 0 ? "h-1.5 w-px shrink-0 bg-border" : "h-1.5 shrink-0"} />
                      <span className="size-2.5 shrink-0 rounded-full bg-primary" />
                      {index < timeline.length - 1 ? <span className="w-px grow bg-border" /> : null}
                    </div>
                    <div className={index < timeline.length - 1 ? "grid gap-1 pb-5" : "grid gap-1"}>
                      <div className="grid gap-1">
                        <p className="font-semibold">{event.label}</p>
                        <p className="text-sm text-muted-foreground">{formatPublicDate(event.occurredAt)}</p>
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">{event.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>
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

import Link from "next/link";
import { ListPublicReportsForMapUseCase } from "@/modules/reports/application/public-map";
import { DrizzleReportRepository } from "@/modules/reports/infrastructure/drizzle-report-repository";
import { readPublicMapConfig } from "@/shared/config/map";
import { createDatabaseConnection } from "@/shared/db/client";
import { PublicReportsMap } from "./public-reports-map";

export const dynamic = "force-dynamic";

export default async function PublicMapPage() {
  const { reports, mapConfig } = await getPublicMapPageData();

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <section className="grid gap-3">
          <Link className="text-sm font-semibold text-primary hover:underline" href="/">
            ← Torna alla home tecnica
          </Link>
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="grid gap-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Segnalazioni pubbliche
              </p>
              <h1 className="font-serif text-4xl font-semibold tracking-normal sm:text-5xl">
                Mappa delle segnalazioni
              </h1>
              <p className="max-w-6xl text-base leading-7 text-muted-foreground">
                Consulta le segnalazioni approvate da Visione Comune sul territorio di Venafro.
                Le segnalazioni ancora in verifica o rifiutate non sono mostrate.
              </p>
            </div>
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              href="/segnala"
            >
              Invia una segnalazione
            </Link>
          </div>
        </section>

        <PublicReportsMap config={mapConfig} reports={reports} />
      </div>
    </main>
  );
}

async function getPublicMapPageData() {
  let connection;

  try {
    connection = createDatabaseConnection();
    const reportRepository = new DrizzleReportRepository(connection.db);
    const reports = await new ListPublicReportsForMapUseCase({ reportRepository }).execute();

    return {
      reports,
      mapConfig: readPublicMapConfig()
    };
  } finally {
    await connection?.close();
  }
}

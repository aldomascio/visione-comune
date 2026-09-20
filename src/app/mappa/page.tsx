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
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="grid gap-3">
              <h1 className="font-serif text-4xl font-semibold tracking-normal sm:text-5xl">
                Mappa delle segnalazioni
              </h1>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground">
                Visualizza e monitora gli interventi sul territorio comunale.
              </p>
            </div>
            <p className="rounded-full bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground">
              {reports.length} segnalazioni pubblicate
            </p>
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

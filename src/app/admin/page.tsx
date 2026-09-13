import Link from "next/link";
import { GetAdminOperationalMetricsUseCase } from "@/modules/analytics/application/operational-metrics";
import { DrizzleOperationalMetricsRepository } from "@/modules/analytics/infrastructure/drizzle-operational-metrics-repository";
import { GetModerationDashboardUseCase } from "@/modules/reports/application/moderate-report";
import { DrizzleReportRepository } from "@/modules/reports/infrastructure/drizzle-report-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";
import { requireActiveAdmin } from "./admin-auth";
import { formatAdminDate } from "./segnalazioni/format";
import { ModerationStatusBadge } from "./segnalazioni/status-badge";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const activeAdmin = await requireActiveAdmin();
  const { dashboard, metrics } = await getAdminDashboardData();
  const maxMonthlyCount = Math.max(
    1,
    ...metrics.monthlyTrend.map((month) => Math.max(month.receivedCount, month.resolvedCount))
  );

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-3">
            <p className="text-sm font-semibold text-primary">Backoffice</p>
            <h1 className="font-serif text-4xl font-semibold tracking-normal">Area amministrativa</h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              Verifica le segnalazioni inviate dai cittadini prima della pubblicazione e monitora gli esiti operativi aggregati.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-[1fr_1fr_2fr]">
          <Card>
            <CardHeader>
              <CardTitle>Da verificare</CardTitle>
              <CardDescription>Segnalazioni in attesa di moderazione.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <p className="font-serif text-5xl font-semibold">{dashboard.pendingCount}</p>
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                href="/admin/segnalazioni"
              >
                Vai alla lista completa
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Categorie</CardTitle>
              <CardDescription>Gestisci categorie e matrice destinatari.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <p className="text-sm leading-6 text-muted-foreground">
                Attiva categorie e collega gli uffici competenti senza inviare comunicazioni automatiche.
              </p>
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                href="/admin/categorie"
              >
                Gestisci categorie
              </Link>
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                href="/admin/destinatari"
              >
                Gestisci destinatari
              </Link>
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                href="/admin/smistamento"
              >
                Matrice smistamento
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ultime segnalazioni da verificare</CardTitle>
              <CardDescription>Le segnalazioni piu recenti entrate nel flusso di moderazione.</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard.latestPendingReports.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/40 p-6 text-sm leading-6 text-muted-foreground">
                  Non ci sono segnalazioni da verificare in questo momento.
                </div>
              ) : (
                <div className="grid gap-3">
                  {dashboard.latestPendingReports.map((report) => (
                    <Link
                      className="grid gap-2 rounded-lg border border-border bg-background p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      href={`/admin/segnalazioni/${report.publicCode}`}
                      key={report.publicCode}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{report.publicCode}</span>
                        <ModerationStatusBadge status={report.moderationStatus} />
                      </div>
                      <p className="font-medium">{report.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {report.categoryName} · {formatAdminDate(report.createdAt)}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="metriche-operative" className="grid gap-4">
          <div className="grid gap-2">
            <p className="text-sm font-semibold text-primary">Metriche operative</p>
            <h2 id="metriche-operative" className="font-serif text-3xl font-semibold tracking-normal">
              Utilizzo e risultati
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Dati aggregati calcolati dal database. Le metriche pubblicabili restano aggregate e non espongono dati individuali o informazioni interne.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Totale ricevute" value={metrics.counts.totalReceived} hint="Tutte le segnalazioni create." testId="total-received" />
            <MetricCard label="Pubblicate" value={metrics.counts.published} hint="Approvate e visibili pubblicamente." testId="published" />
            <MetricCard label="Comunicate" value={metrics.counts.communicated} hint="Include anche quelle risolte." testId="communicated" />
            <MetricCard label="Risolte" value={metrics.counts.resolved} hint="Verificate come risolte." testId="resolved" />
            <MetricCard label="Rifiutate" value={metrics.counts.rejected} hint="Non pubblicate dopo moderazione." testId="rejected" />
            <MetricCard label="Conferme totali" value={metrics.counts.totalConfirmations} hint="Conferme cittadine aggregate." testId="total-confirmations" />
            <MetricCard
              label="Tasso di risoluzione"
              value={formatPercentage(metrics.resolutionRate.percentage)}
              hint="Risolte / pubblicate."
              testId="resolution-rate"
            />
            <MetricCard
              label="Mediana comunicazione"
              value={formatDuration(metrics.medianCommunicationTimeMs)}
              hint="Da pubblicazione a comunicazione."
              testId="median-communication"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Tempi mediani</CardTitle>
                <CardDescription>La mediana riduce l&apos;effetto di casi estremi.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-background p-4">
                  <p className="text-sm text-muted-foreground">Tempo di risoluzione</p>
                  <p className="mt-2 font-serif text-3xl font-semibold">{formatDuration(metrics.medianResolutionTimeMs)}</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">Da publishedAt a resolvedAt.</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <p className="text-sm text-muted-foreground">Tempo di comunicazione</p>
                  <p className="mt-2 font-serif text-3xl font-semibold">{formatDuration(metrics.medianCommunicationTimeMs)}</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">Da publishedAt a communicatedAt.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribuzione per categoria</CardTitle>
                <CardDescription>Segnalazioni pubblicate e risolte per categoria.</CardDescription>
              </CardHeader>
              <CardContent>
                {metrics.categories.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-muted/40 p-6 text-sm leading-6 text-muted-foreground">
                    Nessuna segnalazione pubblicata da aggregare per categoria.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-96 text-left text-sm">
                      <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                        <tr className="border-b border-border">
                          <th className="py-2 pr-3 font-semibold">Categoria</th>
                          <th className="px-3 py-2 text-right font-semibold">Pubblicate</th>
                          <th className="py-2 pl-3 text-right font-semibold">Risolte</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.categories.map((category) => (
                          <tr className="border-b border-border/70 last:border-0" key={category.categoryId}>
                            <td className="py-3 pr-3 font-medium">{category.categoryName}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{category.publishedCount}</td>
                            <td className="py-3 pl-3 text-right tabular-nums">{category.resolvedCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Andamento ultimi 6 mesi</CardTitle>
              <CardDescription>Ricevute per createdAt e risolte per resolvedAt.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {metrics.monthlyTrend.map((month) => (
                  <div className="grid gap-2" key={month.month}>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{formatMonth(month.month)}</span>
                      <span className="text-muted-foreground">
                        {month.receivedCount} ricevute · {month.resolvedCount} risolte
                      </span>
                    </div>
                    <div className="grid gap-1" aria-hidden="true">
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${Math.max(4, (month.receivedCount / maxMonthlyCount) * 100)}%` }}
                        />
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-chart-5"
                          style={{ width: `${Math.max(4, (month.resolvedCount / maxMonthlyCount) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-2"><span className="h-2 w-6 rounded-full bg-primary" /> Ricevute</span>
                <span className="inline-flex items-center gap-2"><span className="h-2 w-6 rounded-full bg-chart-5" /> Risolte</span>
              </div>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Sessione amministratore</CardTitle>
            <CardDescription>Accesso autenticato come amministratore attivo.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="mt-1 font-medium">{activeAdmin.email}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function MetricCard(props: { label: string; value: number | string; hint: string; testId?: string }) {
  return (
    <div data-testid={props.testId ? `metric-${props.testId}` : undefined}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{props.label}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-serif text-4xl font-semibold">{props.value}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{props.hint}</p>
        </CardContent>
      </Card>
    </div>
  );
}

async function getAdminDashboardData() {
  let connection;

  try {
    connection = createDatabaseConnection();
    const reportRepository = new DrizzleReportRepository(connection.db);
    const metricsRepository = new DrizzleOperationalMetricsRepository(connection.db);

    const [dashboard, metrics] = await Promise.all([
      new GetModerationDashboardUseCase({ reportRepository }).execute(),
      new GetAdminOperationalMetricsUseCase({ metricsRepository }).execute()
    ]);

    return { dashboard, metrics };
  } finally {
    await connection?.close();
  }
}

function formatPercentage(value: number | null): string {
  return value === null ? "Non disponibile" : `${value.toLocaleString("it-IT")}%`;
}

function formatDuration(valueMs: number | null): string {
  if (valueMs === null) {
    return "Non disponibile";
  }

  const days = valueMs / 86_400_000;

  if (days >= 1) {
    return `${roundDuration(days)} giorni`;
  }

  const hours = valueMs / 3_600_000;

  if (hours >= 1) {
    return `${roundDuration(hours)} ore`;
  }

  const minutes = valueMs / 60_000;
  return `${Math.max(1, Math.round(minutes))} min`;
}

function roundDuration(value: number): string {
  return (Math.round(value * 10) / 10).toLocaleString("it-IT");
}

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-");

  if (!year || !monthNumber) {
    return month;
  }

  const date = new Date(Date.UTC(Number(year), Number(monthNumber) - 1, 1));
  return new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

import Link from "next/link";
import { requireActiveAdmin } from "./admin-auth";
import { GetModerationDashboardUseCase } from "@/modules/reports/application/moderate-report";
import { DrizzleReportRepository } from "@/modules/reports/infrastructure/drizzle-report-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";
import { formatAdminDate } from "./segnalazioni/format";
import { ModerationStatusBadge } from "./segnalazioni/status-badge";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const activeAdmin = await requireActiveAdmin();
  const dashboard = await getModerationDashboard();

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-3">
            <p className="text-sm font-semibold text-primary">Backoffice</p>
            <h1 className="font-serif text-4xl font-semibold tracking-normal">Area amministrativa</h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              Verifica le segnalazioni inviate dai cittadini prima della pubblicazione.
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

async function getModerationDashboard() {
  let connection;

  try {
    connection = createDatabaseConnection();
    return await new GetModerationDashboardUseCase({
      reportRepository: new DrizzleReportRepository(connection.db)
    }).execute();
  } finally {
    await connection?.close();
  }
}

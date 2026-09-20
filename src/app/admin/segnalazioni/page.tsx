import Link from "next/link";
import { requireActiveAdmin } from "../admin-auth";
import { ListReportsForModerationUseCase } from "@/modules/reports/application/moderate-report";
import type { ReportModerationFilter } from "@/modules/reports/application/report-repository";
import { MODERATION_STATUS_LABELS } from "@/modules/reports/domain";
import { DrizzleReportRepository } from "@/modules/reports/infrastructure/drizzle-report-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { formatStreetAddress } from "@/shared/format/address";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";
import { formatAdminDate } from "./format";
import { ModerationStatusBadge, PublicStatusBadge } from "./status-badge";

export const dynamic = "force-dynamic";

type ReportsPageProps = {
  searchParams?: Promise<{ status?: string }>;
};

const filters: Array<{ label: string; value: ReportModerationFilter }> = [
  { label: "Da verificare", value: "pending_review" },
  { label: "Tutte", value: "all" },
  { label: "Approvate", value: "approved" },
  { label: "Rifiutate", value: "rejected" }
];

export default async function AdminReportsPage({ searchParams }: ReportsPageProps) {
  await requireActiveAdmin();
  const params = await searchParams;
  const status = parseStatusFilter(params?.status);
  const reports = await listReports(status);

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <section className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
          <div className="grid gap-3">
            <Link className="text-sm font-semibold text-primary hover:underline" href="/admin">
              ← Torna al backoffice
            </Link>
            <h1 className="font-serif text-4xl font-semibold tracking-normal">Segnalazioni</h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              La vista iniziale mostra le segnalazioni da verificare. Usa i filtri per consultare anche quelle già moderate.
            </p>
          </div>
          <Link className="inline-flex min-h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:w-auto" href="/admin/segnalazioni/nuova">
            Nuova segnalazione
          </Link>
        </section>

        <nav aria-label="Filtri segnalazioni" className="flex flex-wrap gap-2">
          {filters.map((filter) => {
            const active = filter.value === status;
            const href = filter.value === "pending_review" ? "/admin/segnalazioni" : `/admin/segnalazioni?status=${filter.value}`;

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                    : "rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent"
                }
                href={href}
                key={filter.value}
              >
                {filter.label}
              </Link>
            );
          })}
        </nav>

        <Card>
          <CardHeader>
            <CardTitle>{status === "all" ? "Tutte le segnalazioni" : MODERATION_STATUS_LABELS[status]}</CardTitle>
            <CardDescription>Elenco operativo per aprire il dettaglio e verificare i dati.</CardDescription>
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/40 p-8 text-sm leading-6 text-muted-foreground">
                {status === "pending_review"
                  ? "Non ci sono segnalazioni da verificare."
                  : "Non ci sono segnalazioni per questo filtro."}
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="hidden grid-cols-[8rem_1.4fr_1fr_10rem_9rem_6rem] gap-4 border-b border-border bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
                  <span>Codice</span>
                  <span>Titolo</span>
                  <span>Categoria</span>
                  <span>Invio</span>
                  <span>Stato</span>
                  <span>Azione</span>
                </div>
                <div className="divide-y divide-border">
                  {reports.map((report) => (
                    <article className="grid gap-3 px-4 py-4 md:grid-cols-[8rem_1.4fr_1fr_10rem_9rem_6rem] md:items-center md:gap-4" key={report.publicCode}>
                      <p className="font-mono text-sm font-semibold">{report.publicCode}</p>
                      <div>
                        <p className="font-medium">{report.title}</p>
                        {report.address ? <p className="mt-1 text-sm text-muted-foreground">{formatStreetAddress(report.address)}</p> : null}
                      </div>
                      <p className="text-sm text-muted-foreground md:text-foreground">{report.categoryName}</p>
                      <p className="text-sm text-muted-foreground">{formatAdminDate(report.createdAt)}</p>
                      {report.publicStatus ? (
                        <PublicStatusBadge status={report.publicStatus} />
                      ) : (
                        <ModerationStatusBadge status={report.moderationStatus} />
                      )}
                      <Link className="text-sm font-semibold text-primary hover:underline" href={`/admin/segnalazioni/${report.publicCode}`}>
                        Apri
                      </Link>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

async function listReports(status: ReportModerationFilter) {
  let connection;

  try {
    connection = createDatabaseConnection();
    return await new ListReportsForModerationUseCase({
      reportRepository: new DrizzleReportRepository(connection.db)
    }).execute({ status });
  } finally {
    await connection?.close();
  }
}

function parseStatusFilter(value: string | undefined): ReportModerationFilter {
  if (value === "approved" || value === "rejected" || value === "all") {
    return value;
  }

  return "pending_review";
}

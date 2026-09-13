import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActiveAdmin } from "../../admin-auth";
import {
  GetReportForModerationUseCase,
  InvalidModerationPublicCodeError,
  ReportForModerationNotFoundError
} from "@/modules/reports/application/moderate-report";
import { DrizzleCategoryRepository } from "@/modules/categories/infrastructure/drizzle-category-repository";
import { DrizzleReportRepository } from "@/modules/reports/infrastructure/drizzle-report-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Textarea } from "@/shared/ui";
import { approveReportAction, rejectReportAction } from "../actions";
import { formatAdminDate } from "../format";
import { ModerationStatusBadge, PublicStatusBadge } from "../status-badge";

type ReportDetailPageProps = {
  params: Promise<{ publicCode: string }>;
  searchParams?: Promise<{ error?: string; moderation?: string }>;
};

export const dynamic = "force-dynamic";

export default async function AdminReportDetailPage({ params, searchParams }: ReportDetailPageProps) {
  await requireActiveAdmin();
  const { publicCode } = await params;
  const query = await searchParams;
  const report = await getReport(publicCode);
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
        {query?.error ? <ErrorMessage code={query.error} /> : null}

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


              {report.attachment ? (
                <section className="grid gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Foto allegata</h2>
                  <div className="overflow-hidden rounded-lg border border-border bg-background">
                    <img
                      alt={`Foto allegata alla segnalazione ${report.publicCode}`}
                      className="h-auto w-full object-cover"
                      src={report.attachment.url}
                    />
                  </div>
                </section>
              ) : null}

              <section className="grid gap-4 sm:grid-cols-2">
                <InfoBlock label="Categoria" value={report.categoryName ?? report.categoryId} />
                <InfoBlock label="Data invio" value={formatAdminDate(report.createdAt)} />
                <InfoBlock label="Indirizzo" value={report.location.address ?? "Non indicato"} />
                <InfoBlock label="Coordinate" value={`${report.location.latitude}, ${report.location.longitude}`} />
              </section>
            </CardContent>
          </Card>

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
    </main>
  );
}

async function getReport(publicCode: string) {
  let connection;

  try {
    connection = createDatabaseConnection();
    return await new GetReportForModerationUseCase({
      reportRepository: new DrizzleReportRepository(connection.db),
      categoryRepository: new DrizzleCategoryRepository(connection.db)
    }).execute({ publicCode });
  } catch (error) {
    if (error instanceof ReportForModerationNotFoundError || error instanceof InvalidModerationPublicCodeError) {
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

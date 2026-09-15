import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActiveAdmin } from "../../admin-auth";
import { GetTransmissionUseCase } from "@/modules/communications/application/transmissions";
import { DrizzleOutboundCommunicationRepository } from "@/modules/communications/infrastructure/drizzle-outbound-communication-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";
import { formatAdminDate } from "../../segnalazioni/format";
import { markTransmissionDeliveredAction, markTransmissionFailedAction, markTransmissionSentAction } from "../actions";
import { transmissionStatusLabel } from "../status";

type PageProps = {
  params: Promise<{ transmissionId: string }>;
  searchParams?: Promise<{ transmission?: string; error?: string }>;
};

export const dynamic = "force-dynamic";

export default async function TransmissionDetailPage({ params, searchParams }: PageProps) {
  await requireActiveAdmin();
  const { transmissionId } = await params;
  const query = await searchParams;
  const { transmission, reports } = await getPageData(transmissionId);
  const canMarkSent = transmission.status === "draft";
  const canMarkDelivered = transmission.status === "draft" || transmission.status === "sent";
  const canMarkFailed = transmission.status === "draft" || transmission.status === "sent";

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <section className="grid gap-3">
          <Link className="text-sm font-semibold text-primary hover:underline" href="/admin/trasmissioni">← Torna alle trasmissioni</Link>
          <div>
            <p className="text-sm font-semibold text-primary">Trasmissione</p>
            <h1 className="font-serif text-4xl font-semibold tracking-normal">{transmission.subject}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Dettaglio operativo interno. La consegna confermata aggiorna le segnalazioni eleggibili a Comunicata.
            </p>
          </div>
        </section>

        {query?.transmission ? <SuccessMessage type={query.transmission} /> : null}
        {query?.error ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium" role="alert">{query.error}</div> : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_0.7fr]">
          <Card>
            <CardHeader>
              <CardTitle>Segnalazioni incluse</CardTitle>
              <CardDescription>{reports.length} segnalazioni collegate alla trasmissione.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {reports.map((report) => (
                <article className="rounded-lg border border-border bg-background p-4 text-sm" key={report.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="grid gap-1">
                      <p className="font-mono text-xs font-semibold text-muted-foreground">{report.publicCode}</p>
                      <p className="font-semibold">{report.title}</p>
                      <p className="text-muted-foreground">{report.categoryName} · {report.address ?? "Luogo non indicato"} · {formatAdminDate(report.publishedAt)}</p>
                    </div>
                    <Link className="font-semibold text-primary hover:underline" href={`/admin/segnalazioni/${report.publicCode}`}>Apri</Link>
                  </div>
                </article>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card>
              <CardHeader><CardTitle>Stato</CardTitle><CardDescription>Marcature manuali, nessun invio reale.</CardDescription></CardHeader>
              <CardContent className="grid gap-4 text-sm">
                <Info label="Stato" value={transmissionStatusLabel(transmission.status)} />
                <Info label="Destinatario" value={`${transmission.recipientNameSnapshot} — ${transmission.recipientOrganizationSnapshot}`} />
                <Info label="Indirizzo" value={transmission.recipientAddressSnapshot} />
                <Info label="Canale" value={transmission.channel.toUpperCase()} />
                <Info label="Creata il" value={formatAdminDate(transmission.createdAt)} />
                {transmission.sentAt ? <Info label="Inviata il" value={formatAdminDate(transmission.sentAt)} /> : null}
                {transmission.deliveredAt ? <Info label="Consegnata il" value={formatAdminDate(transmission.deliveredAt)} /> : null}
                {transmission.failedAt ? <Info label="Fallita il" value={formatAdminDate(transmission.failedAt)} /> : null}
                {canMarkSent || canMarkDelivered || canMarkFailed ? (
                  <div className="flex flex-wrap gap-3 pt-2">
                    {canMarkSent ? <StatusForm action={markTransmissionSentAction} label="Marca inviata" transmissionId={transmission.id} /> : null}
                    {canMarkDelivered ? <StatusForm action={markTransmissionDeliveredAction} label="Marca consegnata" transmissionId={transmission.id} /> : null}
                    {canMarkFailed ? <StatusForm action={markTransmissionFailedAction} label="Marca fallita" transmissionId={transmission.id} variant="outline" /> : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Oggetto e testo</CardTitle><CardDescription>Contenuto registrato nella bozza.</CardDescription></CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <p className="font-semibold">{transmission.subject}</p>
                <p className="whitespace-pre-wrap text-muted-foreground">{transmission.body}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

async function getPageData(transmissionId: string) {
  let connection;
  try {
    connection = createDatabaseConnection();
    const repository = new DrizzleOutboundCommunicationRepository(connection.db);
    return await new GetTransmissionUseCase({ transmissionRepository: repository }).execute({ transmissionId });
  } catch (error) {
    if (error instanceof Error && error.name === "TransmissionNotFoundError") notFound();
    throw error;
  } finally {
    await connection?.close();
  }
}

function StatusForm({ action, label, transmissionId, variant }: { action: (formData: FormData) => Promise<void>; label: string; transmissionId: string; variant?: "outline" }) {
  return (
    <form action={action}>
      <input name="transmissionId" type="hidden" value={transmissionId} />
      <Button type="submit" variant={variant}>{label}</Button>
    </form>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-background p-3"><p className="text-muted-foreground">{label}</p><p className="mt-1 font-medium">{value}</p></div>;
}

function SuccessMessage({ type }: { type: string }) {
  const messages: Record<string, string> = {
    created: "Trasmissione salvata come bozza.",
    sent: "Trasmissione marcata come inviata.",
    delivered: "Trasmissione marcata come consegnata.",
    failed: "Trasmissione marcata come fallita."
  };
  return <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium" role="status">{messages[type] ?? "Trasmissione aggiornata."}</div>;
}

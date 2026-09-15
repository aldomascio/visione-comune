import Link from "next/link";
import { requireActiveAdmin } from "../admin-auth";
import { ListTransmissionsUseCase } from "@/modules/communications/application/transmissions";
import { DrizzleOutboundCommunicationRepository } from "@/modules/communications/infrastructure/drizzle-outbound-communication-repository";
import { DrizzleRecipientRepository } from "@/modules/recipients/infrastructure/drizzle-recipient-repository";
import type { OutboundCommunicationStatus } from "@/modules/communications/application/communication-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Select } from "@/shared/ui";
import { formatAdminDate } from "../segnalazioni/format";
import { transmissionStatusLabel } from "./status";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ status?: string; recipientId?: string }>;
};

export default async function AdminTransmissionsPage({ searchParams }: PageProps) {
  await requireActiveAdmin();
  const query = await searchParams;
  const { transmissions, recipients } = await getPageData(query ?? {});

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-2">
            <p className="text-sm font-semibold text-primary">Backoffice</p>
            <h1 className="font-serif text-4xl font-semibold tracking-normal">Trasmissioni</h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Bozze e marcature manuali verso destinatari configurati. Nessuna PEC o email viene inviata automaticamente.
            </p>
          </div>
          <Link className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" href="/admin/trasmissioni/nuova">Nuova trasmissione</Link>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Filtri</CardTitle>
            <CardDescription>Riduci la lista per stato o destinatario.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto]" method="get">
              <label className="grid gap-2 text-sm font-medium" htmlFor="status">
                Stato
                <Select defaultValue={query?.status ?? ""} id="status" name="status">
                  <option value="">Tutti</option>
                  <option value="draft">Bozza</option>
                  <option value="sent">Inviata</option>
                  <option value="delivered">Consegnata</option>
                  <option value="failed">Fallita</option>
                </Select>
              </label>
              <label className="grid gap-2 text-sm font-medium" htmlFor="recipientId">
                Destinatario
                <Select defaultValue={query?.recipientId ?? ""} id="recipientId" name="recipientId">
                  <option value="">Tutti</option>
                  {recipients.map((recipient) => (
                    <option key={recipient.id} value={recipient.id}>{recipient.name} — {recipient.organization}</option>
                  ))}
                </Select>
              </label>
              <div className="flex items-end"><Button type="submit">Filtra</Button></div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registro trasmissioni</CardTitle>
            <CardDescription>{transmissions.length} trasmissioni trovate.</CardDescription>
          </CardHeader>
          <CardContent>
            {transmissions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-muted/40 p-5 text-sm text-muted-foreground">Nessuna trasmissione presente.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr><th className="px-4 py-3 font-semibold">Data</th><th className="px-4 py-3 font-semibold">Destinatario</th><th className="px-4 py-3 font-semibold">Segnalazioni</th><th className="px-4 py-3 font-semibold">Canale</th><th className="px-4 py-3 font-semibold">Stato</th><th className="px-4 py-3 font-semibold">Azioni</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {transmissions.map((transmission) => (
                      <tr key={transmission.id}>
                        <td className="px-4 py-3">{formatAdminDate(transmission.createdAt)}</td>
                        <td className="px-4 py-3">{transmission.recipientNameSnapshot} — {transmission.recipientOrganizationSnapshot}</td>
                        <td className="px-4 py-3">{transmission.reportCount}</td>
                        <td className="px-4 py-3 uppercase">{transmission.channel}</td>
                        <td className="px-4 py-3">{transmissionStatusLabel(transmission.status)}</td>
                        <td className="px-4 py-3"><Link className="font-semibold text-primary hover:underline" href={`/admin/trasmissioni/${transmission.id}`}>Apri</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

async function getPageData(query: { status?: string; recipientId?: string }) {
  let connection;
  try {
    connection = createDatabaseConnection();
    const transmissionRepository = new DrizzleOutboundCommunicationRepository(connection.db);
    const recipientRepository = new DrizzleRecipientRepository(connection.db);
    const [transmissions, recipients] = await Promise.all([
      new ListTransmissionsUseCase({ transmissionRepository }).execute({
        status: parseStatus(query.status),
        recipientId: query.recipientId
      }),
      recipientRepository.listAll()
    ]);
    return { transmissions, recipients: recipients.filter((recipient) => recipient.active) };
  } finally {
    await connection?.close();
  }
}

function parseStatus(value: string | undefined): OutboundCommunicationStatus | undefined {
  return value === "draft" || value === "sent" || value === "delivered" || value === "failed" ? value : undefined;
}

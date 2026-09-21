import Link from "next/link";
import { requireActiveAdmin } from "../../admin-auth";
import { buildTransmissionTemplate, ListEligibleTransmissionReportsUseCase } from "@/modules/communications/application/transmissions";
import { DrizzleOutboundCommunicationRepository } from "@/modules/communications/infrastructure/drizzle-outbound-communication-repository";
import { DrizzleRecipientRepository } from "@/modules/recipients/infrastructure/drizzle-recipient-repository";
import { readBaseEnv } from "@/shared/config/env";
import { createDatabaseConnection } from "@/shared/db/client";
import { formatStreetAddress } from "@/shared/format/address";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Select, Textarea } from "@/shared/ui";
import { formatAdminDate } from "../../segnalazioni/format";
import { createTransmissionAction } from "../actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ recipientId?: string; channel?: string; error?: string }>;
};

export default async function NewTransmissionPage({ searchParams }: PageProps) {
  await requireActiveAdmin();
  const query = await searchParams;
  const selectedRecipientId = query?.recipientId ?? "";
  const selectedChannel = query?.channel === "email" ? "email" : "pec";
  const { recipients, eligibleReports } = await getPageData(selectedRecipientId);
  const template = buildTransmissionTemplate(eligibleReports, readBaseEnv().appUrl);

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <section className="grid gap-3">
          <Link className="text-sm font-semibold text-primary hover:underline" href="/admin/trasmissioni">← Torna alle trasmissioni</Link>
          <div>
            <p className="text-sm font-semibold text-primary">Nuova bozza</p>
            <h1 className="font-serif text-4xl font-semibold tracking-normal">Crea trasmissione</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Scegli un destinatario, seleziona una o piu segnalazioni eleggibili e salva una bozza. L&apos;invio reale resta fuori scope.
            </p>
          </div>
        </section>

        {query?.error ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive" role="alert">{query.error}</div> : null}

        <Card>
          <CardHeader>
            <CardTitle>Destinatario</CardTitle>
            <CardDescription>La lista delle segnalazioni viene filtrata usando la matrice categoria → destinatario.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-[1fr_180px_auto]" method="get">
              <label className="grid gap-2 text-sm font-medium" htmlFor="recipientIdFilter">
                Destinatario
                <Select defaultValue={selectedRecipientId} id="recipientIdFilter" name="recipientId" required>
                  <option value="">Seleziona destinatario</option>
                  {recipients.map((recipient) => (
                    <option key={recipient.id} value={recipient.id}>{recipient.name} — {recipient.organization}</option>
                  ))}
                </Select>
              </label>
              <label className="grid gap-2 text-sm font-medium" htmlFor="channelFilter">
                Canale
                <Select defaultValue={selectedChannel} id="channelFilter" name="channel">
                  <option value="pec">PEC</option>
                  <option value="email">Email</option>
                </Select>
              </label>
              <div className="flex items-end"><Button type="submit" variant="outline">Mostra segnalazioni</Button></div>
            </form>
          </CardContent>
        </Card>

        {selectedRecipientId ? (
          <Card>
            <CardHeader>
              <CardTitle>Bozza trasmissione</CardTitle>
              <CardDescription>Seleziona le segnalazioni da includere. Pending, rifiutate, duplicate e gia comunicate non sono selezionabili.</CardDescription>
            </CardHeader>
            <CardContent>
              {eligibleReports.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border bg-muted/40 p-5 text-sm text-muted-foreground">Nessuna segnalazione eleggibile per questo destinatario.</p>
              ) : (
                <form action={createTransmissionAction} className="grid gap-5">
                  <input name="recipientId" type="hidden" value={selectedRecipientId} />
                  <input name="channel" type="hidden" value={selectedChannel} />
                  <div className="grid gap-3">
                    {eligibleReports.map((report) => (
                      <label className="grid gap-2 rounded-lg border border-border bg-background p-4 text-sm sm:grid-cols-[auto_1fr]" key={report.id}>
                        <input className="mt-1 h-4 w-4" defaultChecked name="reportIds" type="checkbox" value={report.id} />
                        <span className="grid gap-1">
                          <span className="font-mono text-xs font-semibold text-muted-foreground">{report.publicCode}</span>
                          <span className="font-semibold">{report.title}</span>
                          <span className="text-muted-foreground">{report.categoryName} · {formatStreetAddress(report.address)} · {formatAdminDate(report.publishedAt)}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <label className="grid gap-2 text-sm font-medium" htmlFor="subject">Oggetto
                    <Input defaultValue={template.subject} id="subject" maxLength={240} name="subject" required />
                  </label>
                  <label className="grid gap-2 text-sm font-medium" htmlFor="body">Testo
                    <Textarea defaultValue={template.body} id="body" maxLength={6000} name="body" required rows={14} />
                  </label>
                  <Button type="submit">Salva bozza</Button>
                </form>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}

async function getPageData(recipientId: string) {
  let connection;
  try {
    connection = createDatabaseConnection();
    const recipientRepository = new DrizzleRecipientRepository(connection.db);
    const transmissionRepository = new DrizzleOutboundCommunicationRepository(connection.db);
    const [recipients, eligibleReports] = await Promise.all([
      recipientRepository.listAll(),
      recipientId ? new ListEligibleTransmissionReportsUseCase({ transmissionRepository }).execute({ recipientId }) : Promise.resolve([])
    ]);
    return { recipients: recipients.filter((recipient) => recipient.active), eligibleReports };
  } finally {
    await connection?.close();
  }
}

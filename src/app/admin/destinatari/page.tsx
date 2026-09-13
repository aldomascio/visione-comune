import Link from "next/link";
import { ListRecipientsUseCase } from "@/modules/recipients/application/manage-recipients";
import { DrizzleRecipientRepository } from "@/modules/recipients/infrastructure/drizzle-recipient-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";
import { requireActiveAdmin } from "../admin-auth";

type AdminRecipientsPageProps = { searchParams?: Promise<{ created?: string; updated?: string }> };
export const dynamic = "force-dynamic";

export default async function AdminRecipientsPage({ searchParams }: AdminRecipientsPageProps) {
  await requireActiveAdmin();
  const query = await searchParams;
  const recipients = await getRecipients();

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-3">
            <Link className="text-sm font-semibold text-primary hover:underline" href="/admin">← Torna al backoffice</Link>
            <p className="text-sm font-semibold text-primary">Backoffice</p>
            <h1 className="font-serif text-4xl font-semibold tracking-normal">Destinatari</h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">Configura enti e uffici da collegare alle categorie. Nessun invio PEC o email avviene in questa sezione.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link className="inline-flex min-h-10 items-center justify-center rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" href="/admin/smistamento">Matrice smistamento</Link>
            <Link className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" href="/admin/destinatari/nuovo">Nuovo destinatario</Link>
          </div>
        </section>

        {query?.created ? <SuccessMessage text="Destinatario creato." /> : null}
        {query?.updated ? <SuccessMessage text="Destinatario aggiornato." /> : null}

        <Card>
          <CardHeader><CardTitle>Elenco destinatari</CardTitle><CardDescription>I destinatari disattivati restano visibili ma non sono proposti come operativi.</CardDescription></CardHeader>
          <CardContent>
            {recipients.length === 0 ? <div className="rounded-lg border border-dashed border-border bg-muted/40 p-6 text-sm leading-6 text-muted-foreground">Non ci sono ancora destinatari configurati.</div> : (
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-semibold">Nome</th><th className="px-4 py-3 font-semibold">Ente</th><th className="px-4 py-3 font-semibold">Contatti</th><th className="px-4 py-3 font-semibold">Stato</th><th className="px-4 py-3 font-semibold">Categorie</th><th className="px-4 py-3 text-right font-semibold">Azioni</th></tr></thead>
                  <tbody className="divide-y divide-border bg-background">
                    {recipients.map((recipient) => (
                      <tr key={recipient.id}>
                        <td className="px-4 py-4 font-medium">{recipient.name}</td>
                        <td className="px-4 py-4 text-muted-foreground">{recipient.organization}</td>
                        <td className="px-4 py-4 text-muted-foreground"><ContactLine label="Email" value={recipient.email} /><ContactLine label="PEC" value={recipient.pec} /></td>
                        <td className="px-4 py-4"><Badge variant={recipient.active ? "primary" : "muted"}>{recipient.active ? "Attivo" : "Disattivato"}</Badge></td>
                        <td className="px-4 py-4 text-muted-foreground">{recipient.categories.length ? recipient.categories.map((category) => category.name).join(", ") : "Nessuna"}</td>
                        <td className="px-4 py-4 text-right"><Link className="font-semibold text-primary hover:underline" href={`/admin/destinatari/${recipient.id}`}>Modifica</Link></td>
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

async function getRecipients() {
  let connection;
  try {
    connection = createDatabaseConnection();
    return await new ListRecipientsUseCase({ recipientRepository: new DrizzleRecipientRepository(connection.db) }).execute();
  } finally { await connection?.close(); }
}

function ContactLine({ label, value }: { label: string; value?: string }) { return <p>{label}: {value ?? "—"}</p>; }
function SuccessMessage({ text }: { text: string }) { return <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium" role="status">{text}</div>; }

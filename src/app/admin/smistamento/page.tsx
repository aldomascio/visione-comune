import Link from "next/link";
import { ListCategoriesUseCase } from "@/modules/categories/application/manage-categories";
import { DrizzleCategoryRepository } from "@/modules/categories/infrastructure/drizzle-category-repository";
import type { CategoryListItem } from "@/modules/categories/application/category-repository";
import type { CategoryRecipient, RecipientListItem } from "@/modules/recipients/application/recipient-repository";
import { ListRecipientsUseCase } from "@/modules/recipients/application/manage-recipients";
import { DrizzleRecipientRepository } from "@/modules/recipients/infrastructure/drizzle-recipient-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";
import { requireActiveAdmin } from "../admin-auth";
import { updateCategoryRecipientsAction } from "./actions";

type RoutingPageProps = { searchParams?: Promise<{ updated?: string; error?: string }> };

type RoutingMatrixRow = {
  category: CategoryListItem;
  recipients: CategoryRecipient[];
};

export const dynamic = "force-dynamic";

export default async function RoutingMatrixPage({ searchParams }: RoutingPageProps) {
  await requireActiveAdmin();
  const query = await searchParams;
  const { categories, recipients, matrix } = await getRoutingPageData();

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-3">
            <Link className="text-sm font-semibold text-primary hover:underline" href="/admin">← Torna al backoffice</Link>
            <p className="text-sm font-semibold text-primary">Backoffice</p>
            <h1 className="font-serif text-4xl font-semibold tracking-normal">Matrice di smistamento</h1>
            <p className="max-w-6xl text-base leading-7 text-muted-foreground">Associa categorie e destinatari. Il primo destinatario selezionato come principale verra proposto per primo nelle future comunicazioni.</p>
          </div>
          <Link className="inline-flex min-h-10 items-center justify-center rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" href="/admin/destinatari">Gestisci destinatari</Link>
        </section>

        {query?.updated ? <StatusMessage text="Matrice aggiornata." /> : null}
        {query?.error ? <ErrorMessage text={query.error} /> : null}

        {categories.length === 0 || recipients.length === 0 ? <Card><CardContent className="p-6 text-sm leading-6 text-muted-foreground">Servono almeno una categoria e un destinatario per configurare la matrice.</CardContent></Card> : null}

        <div className="grid gap-5">
          {matrix.map((row) => <RoutingCard key={row.category.id} row={row} recipients={recipients} />)}
        </div>
      </div>
    </main>
  );
}

function RoutingCard({ recipients, row }: { recipients: RecipientListItem[]; row: RoutingMatrixRow }) {
  const selectedIds = new Set(row.recipients.map((recipient) => recipient.id));
  const primaryRecipientId = row.recipients[0]?.id ?? "";
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2"><CardTitle>{row.category.name}</CardTitle><Badge variant={row.category.active ? "success" : "muted"}>{row.category.active ? "Categoria attiva" : "Categoria disattivata"}</Badge></div>
        <CardDescription>{row.recipients.length ? `Destinatari associati: ${row.recipients.map((recipient) => `${recipient.name} — ${recipient.organization}`).join(", ")}` : "Nessun destinatario configurato."}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={updateCategoryRecipientsAction} className="grid gap-4">
          <input name="categoryId" type="hidden" value={row.category.id} />
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-semibold">Associa</th><th className="px-4 py-3 font-semibold">Principale</th><th className="px-4 py-3 font-semibold">Destinatario</th><th className="px-4 py-3 font-semibold">Canali</th><th className="px-4 py-3 font-semibold">Stato</th></tr></thead>
              <tbody className="divide-y divide-border bg-background">
                {recipients.map((recipient) => (
                  <tr key={recipient.id}>
                    <td className="px-4 py-3"><input aria-label={`Associa ${recipient.name}`} defaultChecked={selectedIds.has(recipient.id)} name="recipientId" type="checkbox" value={recipient.id} /></td>
                    <td className="px-4 py-3"><input aria-label={`Principale ${recipient.name}`} defaultChecked={recipient.id === primaryRecipientId} name="primaryRecipientId" type="radio" value={recipient.id} /></td>
                    <td className="px-4 py-3"><span className="font-medium">{recipient.name}</span><span className="block text-muted-foreground">{recipient.organization}</span></td>
                    <td className="px-4 py-3 text-muted-foreground">{recipient.pec ? `PEC: ${recipient.pec}` : ""}{recipient.pec && recipient.email ? " · " : ""}{recipient.email ? `Email: ${recipient.email}` : ""}</td>
                    <td className="px-4 py-3"><Badge variant={recipient.active ? "success" : "muted"}>{recipient.active ? "Attivo" : "Disattivato"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button className="w-fit" type="submit">Salva associazioni</Button>
        </form>
      </CardContent>
    </Card>
  );
}

async function getRoutingPageData() {
  let connection;
  try {
    connection = createDatabaseConnection();
    const categoryRepository = new DrizzleCategoryRepository(connection.db);
    const recipientRepository = new DrizzleRecipientRepository(connection.db);
    const categories = await new ListCategoriesUseCase({ categoryRepository }).execute();
    const recipients = await new ListRecipientsUseCase({ recipientRepository }).execute();
    const matrix = await Promise.all(categories.map(async (category) => ({ category, recipients: await recipientRepository.listByCategory(category.id) })));
    return { categories, recipients, matrix };
  } finally { await connection?.close(); }
}

function StatusMessage({ text }: { text: string }) { return <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success" role="status">{text}</div>; }
function ErrorMessage({ text }: { text: string }) { return <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive" role="alert">{text}</div>; }

import Link from "next/link";
import { ListCategoriesUseCase } from "@/modules/categories/application/manage-categories";
import { DrizzleCategoryRepository } from "@/modules/categories/infrastructure/drizzle-category-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";
import { requireActiveAdmin } from "../admin-auth";
import { formatAdminDate } from "../segnalazioni/format";

type AdminCategoriesPageProps = {
  searchParams?: Promise<{ created?: string; updated?: string }>;
};

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage({ searchParams }: AdminCategoriesPageProps) {
  await requireActiveAdmin();
  const query = await searchParams;
  const categories = await getCategories();

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-3">
            <Link className="text-sm font-semibold text-primary hover:underline" href="/admin">
              ← Torna al backoffice
            </Link>
            <p className="text-sm font-semibold text-primary">Backoffice</p>
            <h1 className="font-serif text-4xl font-semibold tracking-normal">Categorie</h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              Gestisci le categorie disponibili nel form pubblico senza modificare i report storici.
            </p>
          </div>
          <Link
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            href="/admin/categorie/nuova"
          >
            Nuova categoria
          </Link>
        </section>

        {query?.created ? <SuccessMessage text="Categoria creata." /> : null}
        {query?.updated ? <SuccessMessage text="Categoria aggiornata." /> : null}

        <Card>
          <CardHeader>
            <CardTitle>Elenco categorie</CardTitle>
            <CardDescription>
              Le categorie disattivate restano associate ai report esistenti, ma non compaiono nelle nuove segnalazioni.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/40 p-6 text-sm leading-6 text-muted-foreground">
                Non ci sono ancora categorie configurate.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Nome</th>
                      <th className="px-4 py-3 font-semibold">Slug</th>
                      <th className="px-4 py-3 font-semibold">Stato</th>
                      <th className="px-4 py-3 font-semibold">Report</th>
                      <th className="px-4 py-3 font-semibold">Aggiornata</th>
                      <th className="px-4 py-3 text-right font-semibold">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-background">
                    {categories.map((category) => (
                      <tr key={category.id}>
                        <td className="px-4 py-4 font-medium">{category.name}</td>
                        <td className="px-4 py-4 font-mono text-xs text-muted-foreground">{category.slug}</td>
                        <td className="px-4 py-4">
                          <Badge variant={category.active ? "primary" : "muted"}>
                            {category.active ? "Attiva" : "Disattivata"}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">{category.reportCount}</td>
                        <td className="px-4 py-4 text-muted-foreground">{formatAdminDate(category.updatedAt)}</td>
                        <td className="px-4 py-4 text-right">
                          <Link className="font-semibold text-primary hover:underline" href={`/admin/categorie/${category.id}`}>
                            Modifica
                          </Link>
                        </td>
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

async function getCategories() {
  let connection;

  try {
    connection = createDatabaseConnection();
    return await new ListCategoriesUseCase({
      categoryRepository: new DrizzleCategoryRepository(connection.db)
    }).execute();
  } finally {
    await connection?.close();
  }
}

function SuccessMessage({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium" role="status">
      {text}
    </div>
  );
}

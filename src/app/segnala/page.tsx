import { DrizzleCategoryRepository } from "@/modules/categories/infrastructure/drizzle-category-repository";
import type { CategoryOption } from "@/modules/categories/application/category-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";
import { ReportForm } from "./report-form";

export const dynamic = "force-dynamic";

export default async function ReportSubmissionPage() {
  const categories = await getActiveCategories();

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-5xl gap-8">
        <section className="grid gap-4">
          <Badge className="w-fit">Segnala un problema</Badge>
          <div className="grid gap-3">
            <h1 className="max-w-3xl font-serif text-4xl font-semibold tracking-normal sm:text-5xl">
              Invia una segnalazione senza account
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Raccontaci il problema: Visione Comune lo verifichera prima di pubblicarlo o
              comunicarlo agli enti competenti.
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <Card>
            <CardHeader>
              <CardTitle>Prima di inviare</CardTitle>
              <CardDescription>
                Il primo flusso non include ancora foto, mappa, deduplica avanzata o tracking
                pubblico completo.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm leading-6 text-muted-foreground">
              <p>La segnalazione resta privata finche non viene verificata.</p>
              <p>Riceverai un codice pubblico da conservare.</p>
              <p>Non chiediamo nome, cognome, email o telefono.</p>
            </CardContent>
          </Card>

          <Card aria-labelledby="report-form-title">
            <CardHeader>
              <CardTitle id="report-form-title">Dati della segnalazione</CardTitle>
              <CardDescription>
                Le coordinate sono una soluzione temporanea: geocoding e mappa arriveranno in
                vertical slice successive.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReportForm categories={categories} />
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

async function getActiveCategories(): Promise<CategoryOption[]> {
  let connection;

  try {
    connection = createDatabaseConnection();
    const categories = await new DrizzleCategoryRepository(connection.db).listActive();

    return categories;
  } catch (error) {
    console.error("Unable to load active categories", error);
    return [];
  } finally {
    await connection?.close();
  }
}

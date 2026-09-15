import Link from "next/link";
import { DrizzleCategoryRepository } from "@/modules/categories/infrastructure/drizzle-category-repository";
import type { CategoryOption } from "@/modules/categories/application/category-repository";
import { readPublicMapConfig } from "@/shared/config/map";
import { createDatabaseConnection } from "@/shared/db/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";
import { requireActiveAdmin } from "../../admin-auth";
import { AdminReportForm } from "./admin-report-form";

export const dynamic = "force-dynamic";

export default async function NewAdminReportPage() {
  await requireActiveAdmin();
  const categories = await getActiveCategories();
  const mapConfig = readPublicMapConfig();

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <section className="grid gap-3">
          <Link className="text-sm font-semibold text-primary hover:underline" href="/admin/segnalazioni">
            ← Torna alle segnalazioni
          </Link>
          <h1 className="font-serif text-4xl font-semibold tracking-normal">Nuova segnalazione</h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            Registra una segnalazione ricevuta da social, email, contatto diretto o altro canale esterno. La segnalazione resta da verificare.
          </p>
        </section>

        <Card aria-labelledby="admin-report-form-title">
          <CardHeader>
            <CardTitle id="admin-report-form-title">Dati della segnalazione manuale</CardTitle>
            <CardDescription>
              La posizione usa lo stesso selettore del form pubblico. Il cittadino non vede il campo fonte.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdminReportForm categories={categories} mapConfig={mapConfig} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

async function getActiveCategories(): Promise<CategoryOption[]> {
  let connection;

  try {
    connection = createDatabaseConnection();
    return await new DrizzleCategoryRepository(connection.db).listActive();
  } catch (error) {
    console.error("Unable to load active categories for admin report creation", error);
    return [];
  } finally {
    await connection?.close();
  }
}

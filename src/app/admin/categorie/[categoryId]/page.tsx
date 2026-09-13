import Link from "next/link";
import { notFound } from "next/navigation";
import { DrizzleCategoryRepository } from "@/modules/categories/infrastructure/drizzle-category-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { requireActiveAdmin } from "../../admin-auth";
import { updateCategoryAction } from "../actions";
import { CategoryForm } from "../category-form";
import type { CategoryActionState } from "../form-state";

type EditCategoryPageProps = {
  params: Promise<{ categoryId: string }>;
};

export const dynamic = "force-dynamic";

export default async function EditCategoryPage({ params }: EditCategoryPageProps) {
  await requireActiveAdmin();
  const { categoryId } = await params;
  const category = await getCategory(categoryId);

  if (!category) {
    notFound();
  }

  const initialState: CategoryActionState = {
    status: "idle",
    fieldErrors: {},
    values: {
      name: category.name,
      slug: category.slug,
      active: String(category.active)
    }
  };

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-3xl gap-8">
        <section className="grid gap-3">
          <Link className="text-sm font-semibold text-primary hover:underline" href="/admin/categorie">
            ← Torna alle categorie
          </Link>
          <h1 className="font-serif text-4xl font-semibold tracking-normal">Modifica categoria</h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            Puoi modificare nome, slug e stato. L&apos;identificativo interno resta invariato e i report storici continuano a puntare alla categoria.
          </p>
        </section>

        <CategoryForm action={updateCategoryAction} category={category} initialState={initialState} mode="edit" />
      </div>
    </main>
  );
}

async function getCategory(categoryId: string) {
  let connection;

  try {
    connection = createDatabaseConnection();
    return await new DrizzleCategoryRepository(connection.db).findById(categoryId);
  } finally {
    await connection?.close();
  }
}

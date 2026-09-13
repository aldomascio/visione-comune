import Link from "next/link";
import { requireActiveAdmin } from "../../admin-auth";
import { createCategoryAction } from "../actions";
import { CategoryForm } from "../category-form";
import { initialCategoryActionState } from "../form-state";

export const dynamic = "force-dynamic";

export default async function NewCategoryPage() {
  await requireActiveAdmin();

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <section className="grid gap-3">
          <Link className="text-sm font-semibold text-primary hover:underline" href="/admin/categorie">
            ← Torna alle categorie
          </Link>
          <h1 className="font-serif text-4xl font-semibold tracking-normal">Nuova categoria</h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            Crea una categoria attiva per le nuove segnalazioni. Le categorie definitive restano una decisione editoriale di Visione Comune.
          </p>
        </section>

        <CategoryForm action={createCategoryAction} initialState={initialCategoryActionState} mode="create" />
      </div>
    </main>
  );
}

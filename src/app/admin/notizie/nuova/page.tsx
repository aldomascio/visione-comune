import Link from "next/link";
import { requireActiveAdmin } from "../../admin-auth";
import { createNewsPostAction } from "../actions";
import { initialNewsPostActionState } from "../form-state";
import { NewsPostForm } from "../news-post-form";

export const dynamic = "force-dynamic";

export default async function NewNewsPostPage() {
  await requireActiveAdmin();

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <section className="grid gap-3">
          <Link className="text-sm font-semibold text-primary hover:underline" href="/admin/notizie">
            ← Torna alle notizie
          </Link>
          <h1 className="font-serif text-4xl font-semibold tracking-normal">Nuova notizia</h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            Scrivi un aggiornamento semplice. Puoi salvarlo come bozza o pubblicarlo subito.
          </p>
        </section>

        <NewsPostForm action={createNewsPostAction} initialState={initialNewsPostActionState} mode="create" />
      </div>
    </main>
  );
}

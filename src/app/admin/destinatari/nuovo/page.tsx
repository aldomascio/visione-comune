import Link from "next/link";
import { requireActiveAdmin } from "../../admin-auth";
import { createRecipientAction } from "../actions";
import { initialRecipientActionState } from "../form-state";
import { RecipientForm } from "../recipient-form";

export const dynamic = "force-dynamic";

export default async function NewRecipientPage() {
  await requireActiveAdmin();
  return <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12"><div className="mx-auto grid w-full max-w-6xl gap-8"><section className="grid gap-3"><Link className="text-sm font-semibold text-primary hover:underline" href="/admin/destinatari">← Torna ai destinatari</Link><h1 className="font-serif text-4xl font-semibold tracking-normal">Nuovo destinatario</h1><p className="max-w-2xl text-base leading-7 text-muted-foreground">Crea un contatto amministrativo da associare alle categorie.</p></section><RecipientForm action={createRecipientAction} initialState={initialRecipientActionState} mode="create" /></div></main>;
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { DrizzleRecipientRepository } from "@/modules/recipients/infrastructure/drizzle-recipient-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { requireActiveAdmin } from "../../admin-auth";
import { updateRecipientAction } from "../actions";
import type { RecipientActionState } from "../form-state";
import { RecipientForm } from "../recipient-form";

type EditRecipientPageProps = { params: Promise<{ recipientId: string }> };
export const dynamic = "force-dynamic";

export default async function EditRecipientPage({ params }: EditRecipientPageProps) {
  await requireActiveAdmin();
  const { recipientId } = await params;
  const recipient = await getRecipient(recipientId);
  if (!recipient) notFound();
  const initialState: RecipientActionState = { status: "idle", fieldErrors: {}, values: { name: recipient.name, organization: recipient.organization, email: recipient.email ?? "", pec: recipient.pec ?? "", active: String(recipient.active) } };
  return <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12"><div className="mx-auto grid w-full max-w-6xl gap-8"><section className="grid gap-3"><Link className="text-sm font-semibold text-primary hover:underline" href="/admin/destinatari">← Torna ai destinatari</Link><h1 className="font-serif text-4xl font-semibold tracking-normal">Modifica destinatario</h1><p className="max-w-2xl text-base leading-7 text-muted-foreground">Modifica contatti e stato. Le associazioni categoria-destinatario restano nella matrice di smistamento.</p></section><RecipientForm action={updateRecipientAction} initialState={initialState} mode="edit" recipient={recipient} /></div></main>;
}

async function getRecipient(recipientId: string) {
  let connection;
  try { connection = createDatabaseConnection(); return await new DrizzleRecipientRepository(connection.db).findById(recipientId); }
  finally { await connection?.close(); }
}

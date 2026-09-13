"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Recipient } from "@/modules/recipients/application/recipient-repository";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Select } from "@/shared/ui";
import type { RecipientActionState } from "./form-state";

type RecipientFormProps = {
  mode: "create" | "edit";
  initialState: RecipientActionState;
  action: (previousState: RecipientActionState, formData: FormData) => Promise<RecipientActionState>;
  recipient?: Recipient;
};

export function RecipientForm({ action, initialState, mode, recipient }: RecipientFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const title = mode === "create" ? "Nuovo destinatario" : "Modifica destinatario";

  return (
    <Card aria-labelledby="recipient-form-title">
      <CardHeader>
        <CardTitle id="recipient-form-title">{title}</CardTitle>
        <CardDescription>Configura il contatto operativo. In questa fase non viene inviata nessuna comunicazione.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-5" noValidate>
          {recipient ? <input name="id" type="hidden" value={recipient.id} /> : null}
          {state.status === "error" && state.message ? <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive" role="alert">{state.message}</div> : null}

          <Field htmlFor="name" label="Nome destinatario" hint="Es. Ufficio Tecnico, Protocollo, Settore Ambiente.">
            <Input aria-describedby={state.fieldErrors.name ? "name-error" : undefined} aria-invalid={Boolean(state.fieldErrors.name)} defaultValue={state.values.name} id="name" maxLength={160} name="name" required />
            <FieldError id="name-error" message={state.fieldErrors.name} />
          </Field>

          <Field htmlFor="organization" label="Ente / organizzazione" hint="Es. Comune di Venafro.">
            <Input aria-describedby={state.fieldErrors.organization ? "organization-error" : undefined} aria-invalid={Boolean(state.fieldErrors.organization)} defaultValue={state.values.organization} id="organization" maxLength={200} name="organization" required />
            <FieldError id="organization-error" message={state.fieldErrors.organization} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field htmlFor="email" label="Email" hint="Opzionale se inserisci una PEC.">
              <Input aria-describedby={state.fieldErrors.email ? "email-error" : undefined} aria-invalid={Boolean(state.fieldErrors.email)} defaultValue={state.values.email} id="email" maxLength={320} name="email" type="email" />
              <FieldError id="email-error" message={state.fieldErrors.email} />
            </Field>

            <Field htmlFor="pec" label="PEC" hint="Opzionale se inserisci una email. Usa indirizzi fittizi nei test.">
              <Input aria-describedby={state.fieldErrors.pec ? "pec-error" : undefined} aria-invalid={Boolean(state.fieldErrors.pec)} defaultValue={state.values.pec} id="pec" maxLength={320} name="pec" type="email" />
              <FieldError id="pec-error" message={state.fieldErrors.pec} />
            </Field>
          </div>

          <Field htmlFor="active" label="Stato" hint="I destinatari disattivati restano nella configurazione, ma non sono proposti come operativi.">
            <Select aria-describedby={state.fieldErrors.active ? "active-error" : undefined} aria-invalid={Boolean(state.fieldErrors.active)} defaultValue={state.values.active} id="active" name="active" required>
              <option value="true">Attivo</option>
              <option value="false">Disattivato</option>
            </Select>
            <FieldError id="active-error" message={state.fieldErrors.active} />
          </Field>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button disabled={pending} type="submit">{pending ? "Salvataggio..." : mode === "create" ? "Crea destinatario" : "Salva modifiche"}</Button>
            <Link className="inline-flex min-h-10 items-center justify-center rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" href="/admin/destinatari">Annulla</Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p className="text-sm font-medium text-destructive" id={id}>{message}</p>;
}

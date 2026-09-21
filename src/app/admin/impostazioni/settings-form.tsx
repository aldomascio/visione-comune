"use client";

import { useActionState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input } from "@/shared/ui";
import type { PublicContactSettingsActionState } from "./form-state";

type SettingsFormProps = {
  action: (state: PublicContactSettingsActionState, formData: FormData) => Promise<PublicContactSettingsActionState>;
  initialState: PublicContactSettingsActionState;
};

const fields = [
  { key: "facebookUrl", label: "Facebook", type: "url" },
  { key: "instagramUrl", label: "Instagram", type: "url" },
  { key: "tiktokUrl", label: "TikTok", type: "url" },
  { key: "contactEmail", label: "Email pubblica", type: "email" }
] as const;

export function PublicContactSettingsForm({ action, initialState }: SettingsFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contatti pubblici</CardTitle>
        <CardDescription>
          I canali compilati compaiono nel footer. Lascia vuoto un campo per non mostrare quel collegamento.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-5" noValidate>
          {state.status === "error" && state.message ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive" role="alert">
              {state.message}
            </div>
          ) : null}

          {fields.map((field) => {
            const error = state.fieldErrors[field.key];
            const errorId = `${field.key}-error`;

            return (
              <Field htmlFor={field.key} key={field.key} label={field.label}>
                <Input
                  aria-describedby={error ? errorId : undefined}
                  aria-invalid={Boolean(error)}
                  defaultValue={state.values[field.key]}
                  id={field.key}
                  maxLength={field.key === "contactEmail" ? 320 : 500}
                  name={field.key}
                  type={field.type}
                />
                {error ? <p className="text-sm font-medium text-destructive" id={errorId}>{error}</p> : null}
              </Field>
            );
          })}

          <div>
            <Button disabled={pending} type="submit">
              {pending ? "Salvataggio..." : "Salva impostazioni"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

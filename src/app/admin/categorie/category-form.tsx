"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import type { CategoryDetails } from "@/modules/categories/application/category-repository";
import { normalizeCategorySlug } from "@/modules/categories/application/manage-categories";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Select } from "@/shared/ui";
import type { CategoryActionState } from "./form-state";

type CategoryFormProps = {
  mode: "create" | "edit";
  initialState: CategoryActionState;
  action: (previousState: CategoryActionState, formData: FormData) => Promise<CategoryActionState>;
  category?: CategoryDetails;
};

export function CategoryForm({ action, category, initialState, mode }: CategoryFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [name, setName] = useState(state.values.name);
  const [slug, setSlug] = useState(state.values.slug);
  const [slugEdited, setSlugEdited] = useState(mode === "edit" || Boolean(state.values.slug));
  const title = mode === "create" ? "Nuova categoria" : "Modifica categoria";
  const description = mode === "create"
    ? "Crea una categoria selezionabile nelle nuove segnalazioni."
    : "Aggiorna nome, slug e stato della categoria senza modificare i report esistenti.";

  const normalizedSlugPreview = useMemo(() => normalizeCategorySlug(name), [name]);


  return (
    <Card aria-labelledby="category-form-title">
      <CardHeader>
        <CardTitle id="category-form-title">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-5" noValidate>
          {category ? <input name="id" type="hidden" value={category.id} /> : null}

          {state.status === "error" && state.message ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive" role="alert">
              {state.message}
            </div>
          ) : null}

          <Field
            htmlFor="name"
            label="Nome categoria"
            hint="Nome leggibile mostrato nel form, nel backoffice e nelle pagine pubbliche."
          >
            <Input
              aria-describedby={state.fieldErrors.name ? "name-error" : undefined}
              aria-invalid={Boolean(state.fieldErrors.name)}
              id="name"
              maxLength={160}
              name="name"
              onChange={(event) => {
                const nextName = event.target.value;
                setName(nextName);
                if (!slugEdited) {
                  setSlug(normalizeCategorySlug(nextName));
                }
              }}
              required
              value={name}
            />
            {state.fieldErrors.name ? (
              <p className="text-sm font-medium text-destructive" id="name-error">
                {state.fieldErrors.name}
              </p>
            ) : null}
          </Field>

          <Field
            htmlFor="slug"
            label="Slug"
            hint={mode === "create" && !slugEdited && normalizedSlugPreview ? `Proposta automatica: ${normalizedSlugPreview}` : "Usa lettere minuscole, numeri e trattini."}
          >
            <Input
              aria-describedby={state.fieldErrors.slug ? "slug-error" : undefined}
              aria-invalid={Boolean(state.fieldErrors.slug)}
              id="slug"
              maxLength={120}
              name="slug"
              onChange={(event) => {
                setSlug(event.target.value);
                setSlugEdited(true);
              }}
              required
              value={slug}
            />
            {state.fieldErrors.slug ? (
              <p className="text-sm font-medium text-destructive" id="slug-error">
                {state.fieldErrors.slug}
              </p>
            ) : null}
          </Field>

          <Field
            htmlFor="active"
            label="Stato"
            hint="Le categorie disattivate restano nei report storici ma non sono disponibili per nuove segnalazioni."
          >
            <Select
              aria-describedby={state.fieldErrors.active ? "active-error" : undefined}
              aria-invalid={Boolean(state.fieldErrors.active)}
              id="active"
              name="active"
              required
              defaultValue={state.values.active}
            >
              <option value="true">Attiva</option>
              <option value="false">Disattivata</option>
            </Select>
            {state.fieldErrors.active ? (
              <p className="text-sm font-medium text-destructive" id="active-error">
                {state.fieldErrors.active}
              </p>
            ) : null}
          </Field>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button disabled={pending} type="submit">
              {pending ? "Salvataggio..." : mode === "create" ? "Crea categoria" : "Salva modifiche"}
            </Button>
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              href="/admin/categorie"
            >
              Annulla
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

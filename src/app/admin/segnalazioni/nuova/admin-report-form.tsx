"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { CategoryOption } from "@/modules/categories/application/category-repository";
import { REPORT_SOURCE_LABELS } from "@/modules/reports/domain";
import type { PublicMapConfig } from "@/shared/config/map";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Select, Textarea } from "@/shared/ui";
import { LocationPicker } from "@/app/segnala/location-picker";
import { createAdminReportAction } from "../actions";
import { initialCreateAdminReportActionState } from "./form-state";

type AdminReportFormProps = {
  categories: CategoryOption[];
  mapConfig: PublicMapConfig;
};

const manualSources = ["direct", "social", "email", "other", "platform"] as const;

type AdminReportFieldErrors = Partial<Record<"categoryId" | "source" | "description" | "latitude" | "longitude" | "address" | "photo", string>>;

export function AdminReportForm({ categories, mapConfig }: AdminReportFormProps) {
  const [actionState, formAction, pending] = useActionState(
    createAdminReportAction,
    initialCreateAdminReportActionState
  );
  const state = actionState ?? initialCreateAdminReportActionState;

  if (state.status === "success" && state.publicCode) {
    return (
      <Card aria-labelledby="admin-report-created-title">
        <CardHeader>
          <Badge className="w-fit">Segnalazione creata</Badge>
          <CardTitle id="admin-report-created-title">Segnalazione registrata da verificare</CardTitle>
          <CardDescription>
            La segnalazione manuale ha ricevuto un codice pubblico e segue lo stesso workflow di moderazione delle segnalazioni pubbliche.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="rounded-lg border border-border bg-background p-5">
            <p className="text-sm text-muted-foreground">Codice pubblico</p>
            <p className="mt-2 font-mono text-3xl font-semibold tracking-wide text-foreground">{state.publicCode}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90" href={`/admin/segnalazioni/${state.publicCode}`}>
              Apri dettaglio
            </Link>
            <Link className="inline-flex min-h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-accent" href="/admin/segnalazioni">
              Torna alle segnalazioni
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formDisabled = categories.length === 0 || pending;
  const visibleFieldErrors = getVisibleFieldErrors(state.fieldErrors);

  return (
    <form action={formAction} className="grid gap-6" noValidate>
      {state.status === "error" && state.message ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-foreground" role="alert">
          <p className="font-medium">{state.message}</p>
          {visibleFieldErrors.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {visibleFieldErrors.map((fieldError) => (
                <li key={fieldError.key}>
                  <a className="underline underline-offset-2" href={`#${fieldError.fieldId}`}>
                    {fieldError.label}: {fieldError.message}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {categories.length === 0 ? (
        <div className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          Non ci sono categorie attive. Crea o riattiva una categoria prima di registrare una segnalazione.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="categoryId" label="Categoria">
          <Select aria-describedby={state.fieldErrors.categoryId ? "categoryId-error" : undefined} aria-invalid={Boolean(state.fieldErrors.categoryId)} defaultValue={state.values.categoryId} disabled={formDisabled} id="categoryId" name="categoryId" required>
            <option value="">Seleziona una categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </Select>
          <FieldError id="categoryId-error" message={state.fieldErrors.categoryId} />
        </Field>

        <Field hint="Canale da cui Visione Comune ha ricevuto originariamente la segnalazione." htmlFor="source" label="Fonte">
          <Select aria-describedby={state.fieldErrors.source ? "source-error" : undefined} aria-invalid={Boolean(state.fieldErrors.source)} defaultValue={state.values.source || "direct"} disabled={formDisabled} id="source" name="source" required>
            {manualSources.map((source) => (
              <option key={source} value={source}>{REPORT_SOURCE_LABELS[source]}</option>
            ))}
          </Select>
          <FieldError id="source-error" message={state.fieldErrors.source} />
        </Field>
      </div>

      <LocationPicker
        disabled={formDisabled}
        fieldErrors={{
          address: state.fieldErrors.address,
          latitude: state.fieldErrors.latitude,
          longitude: state.fieldErrors.longitude
        }}
        initialAddress={state.values.address}
        initialLatitude={state.values.latitude}
        initialLongitude={state.values.longitude}
        mapConfig={mapConfig}
      />

      <Field hint="Testo interno iniziale della segnalazione. Sara verificato prima della pubblicazione." htmlFor="description" label="Descrizione">
        <Textarea aria-describedby={state.fieldErrors.description ? "description-error" : undefined} aria-invalid={Boolean(state.fieldErrors.description)} defaultValue={state.values.description} disabled={formDisabled} id="description" name="description" required rows={6} />
        <FieldError id="description-error" message={state.fieldErrors.description} />
      </Field>

      <Field hint="Opzionale. Riusa gli stessi limiti del form pubblico: JPEG, PNG o WebP fino a 10 MB." htmlFor="photo" label="Foto opzionale">
        <input accept="image/*" aria-describedby={state.fieldErrors.photo ? "photo-error" : undefined} aria-invalid={Boolean(state.fieldErrors.photo)} className="sr-only" disabled={formDisabled} id="photo" name="photo" type="file" />
        <label className="inline-flex min-h-10 w-fit cursor-pointer items-center justify-center rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background" htmlFor="photo">
          Scegli foto
        </label>
        <FieldError id="photo-error" message={state.fieldErrors.photo} />
      </Field>

      <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-muted-foreground">
          La segnalazione parte sempre da verificare e non viene pubblicata automaticamente.
        </p>
        <Button className="w-full sm:w-auto" disabled={formDisabled} type="submit">
          {pending ? "Salvataggio..." : "Salva segnalazione"}
        </Button>
      </div>
    </form>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p className="text-sm font-medium text-destructive" id={id}>{message}</p>;
}

function getVisibleFieldErrors(fieldErrors: AdminReportFieldErrors) {
  const labels = {
    categoryId: { fieldId: "categoryId", label: "Categoria" },
    source: { fieldId: "source", label: "Fonte" },
    address: { fieldId: "address", label: "Indirizzo" },
    latitude: { fieldId: "address", label: "Posizione" },
    longitude: { fieldId: "address", label: "Posizione" },
    description: { fieldId: "description", label: "Descrizione" },
    photo: { fieldId: "photo", label: "Foto" }
  } as const;

  return Object.entries(fieldErrors)
    .filter((entry): entry is [keyof typeof labels, string] => Boolean(entry[1]) && entry[0] in labels)
    .map(([fieldName, message]) => ({ ...labels[fieldName], key: fieldName, message }));
}

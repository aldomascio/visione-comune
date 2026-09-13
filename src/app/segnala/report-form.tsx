"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import type { CategoryOption } from "@/modules/categories/application/category-repository";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  Textarea
} from "@/shared/ui";
import { createReportAction } from "./actions";
import { initialCreateReportActionState } from "./form-state";
import { CopyPublicCodeButton } from "./copy-public-code-button";

type ReportFormProps = {
  categories: CategoryOption[];
};

export function ReportForm({ categories }: ReportFormProps) {
  const [actionState, formAction, pending] = useActionState(
    createReportAction,
    initialCreateReportActionState
  );
  const state = actionState ?? initialCreateReportActionState;
  const latitudeInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const longitudeInputRef = useRef<HTMLInputElement>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [geolocationStatus, setGeolocationStatus] = useState<
    { type: "idle" } | { type: "success"; message: string } | { type: "error"; message: string }
  >({ type: "idle" });

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  if (state.status === "success" && state.publicCode) {
    return (
      <Card aria-labelledby="report-created-title">
        <CardHeader>
          <Badge className="w-fit">Segnalazione ricevuta</Badge>
          <CardTitle id="report-created-title">Conserva il tuo codice</CardTitle>
          <CardDescription>
            La segnalazione e stata registrata e sara verificata da Visione Comune prima di
            essere eventualmente pubblicata.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="rounded-lg border border-border bg-background p-5">
            <p className="text-sm text-muted-foreground">Codice pubblico</p>
            <p className="mt-2 font-mono text-3xl font-semibold tracking-wide text-foreground">
              {state.publicCode}
            </p>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Salva questo codice: ti servira per seguire la segnalazione. La segnalazione non viene pubblicata automaticamente.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <CopyPublicCodeButton publicCode={state.publicCode} />
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              href={`/segnalazione?codice=${state.publicCode}`}
            >
              Controlla lo stato della segnalazione
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formDisabled = categories.length === 0 || pending;
  const visibleFieldErrors = getVisibleFieldErrors(state.fieldErrors);
  const formStateKey = [
    state.status,
    state.values.categoryId,
    state.values.address,
    state.values.latitude,
    state.values.longitude,
    state.values.description
  ].join(":");

  return (
    <form action={formAction} className="grid gap-6" key={formStateKey} noValidate>
      {state.status === "error" && state.message ? (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-foreground"
          role="alert"
        >
          <p className="font-medium">{state.message}</p>
          {visibleFieldErrors.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {visibleFieldErrors.map((fieldError) => (
                <li key={fieldError.fieldId}>
                  <a className="underline underline-offset-2" href={`#${fieldError.fieldId}`}>
                    {fieldError.label}: {fieldError.message}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm">
              Non sono disponibili dettagli sul campo. Riprova o ricarica la pagina.
            </p>
          )}
        </div>
      ) : null}

      {categories.length === 0 ? (
        <div className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          Al momento non ci sono categorie disponibili. Le categorie MVP provvisorie devono
          essere inserite nel database prima di inviare una segnalazione.
        </div>
      ) : null}

      {state.status === "duplicates_found" && state.duplicateCandidates?.length ? (
        <Card aria-labelledby="possible-duplicates-title" className="border-primary/40 bg-primary/5">
          <CardHeader>
            <Badge className="w-fit">Controllo duplicati</Badge>
            <CardTitle id="possible-duplicates-title">
              Potrebbe esistere gia una segnalazione simile
            </CardTitle>
            <CardDescription>
              Abbiamo trovato segnalazioni pubbliche recenti nella stessa categoria e molto vicine alla posizione indicata. Puoi aprire quella esistente oppure continuare se il problema e diverso.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ul className="grid gap-3">
              {state.duplicateCandidates.map((candidate) => (
                <li
                  className="grid gap-3 rounded-lg border border-border bg-background p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                  key={candidate.publicCode}
                >
                  <div className="grid gap-1">
                    <p className="font-medium text-foreground">{candidate.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {candidate.categoryName}
                      {candidate.address ? ` · ${candidate.address}` : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Circa {formatDistance(candidate.distanceMeters)} · Stato {candidate.publicStatusLabel} · pubblicata il {formatDate(candidate.publishedAt)}
                    </p>
                  </div>
                  <Link
                    className="inline-flex min-h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    href={`/segnalazioni/${candidate.publicCode}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Vedi segnalazione
                  </Link>
                </li>
              ))}
            </ul>
            {state.photoSelectedBeforeDuplicateCheck ? (
              <p className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
                Per sicurezza il browser non conserva la foto dopo questo controllo. Se vuoi continuare creando una nuova segnalazione con foto, selezionala di nuovo prima di premere il pulsante sotto.
              </p>
            ) : null}
            <div className="grid gap-2 sm:flex sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-muted-foreground">
                La scelta non registra ancora una conferma: la conferma persistente sara gestita nella prossima vertical slice.
              </p>
              <Button
                className="w-full sm:w-auto"
                disabled={formDisabled}
                name="duplicateChoice"
                type="submit"
                value="different"
              >
                Il mio problema e diverso, continua
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Field
        hint="Le categorie sono provvisorie e servono solo per il primo flusso MVP."
        htmlFor="categoryId"
        label="Che tipo di problema vuoi segnalare?"
      >
        <Select
          aria-describedby={state.fieldErrors.categoryId ? "categoryId-error" : undefined}
          aria-invalid={Boolean(state.fieldErrors.categoryId)}
          defaultValue={state.values.categoryId}
          disabled={formDisabled}
          id="categoryId"
          name="categoryId"
          required
        >
          <option value="">Seleziona una categoria</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        <FieldError id="categoryId-error" message={state.fieldErrors.categoryId} />
      </Field>

      <Field
        hint="Scrivi un indirizzo, un incrocio o un riferimento riconoscibile. La conversione automatica indirizzo-coordinate arrivera in una task successiva."
        htmlFor="address"
        label="Inserisci indirizzo"
      >
        <Input
          aria-describedby={state.fieldErrors.address ? "address-error" : undefined}
          aria-invalid={Boolean(state.fieldErrors.address)}
          defaultValue={state.values.address}
          disabled={formDisabled}
          id="address"
          name="address"
          placeholder="Es. Via Roma, vicino alla scuola"
        />
        <FieldError id="address-error" message={state.fieldErrors.address} />
      </Field>

      <div className="grid gap-2 rounded-lg border border-border bg-muted/40 p-4">
        <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Posizione precisa</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Puoi compilare le coordinate usando la posizione del browser. Il permesso viene
              chiesto solo dopo il click.
            </p>
          </div>
          <Button
            disabled={formDisabled}
            onClick={() => {
              if (!navigator.geolocation) {
                setGeolocationStatus({
                  type: "error",
                  message:
                    "Il browser non supporta la geolocalizzazione. Puoi inserire le coordinate manualmente."
                });
                return;
              }

              setGeolocationStatus({ type: "idle" });
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  const latitude = position.coords.latitude.toFixed(6);
                  const longitude = position.coords.longitude.toFixed(6);

                  if (latitudeInputRef.current) {
                    latitudeInputRef.current.value = latitude;
                  }

                  if (longitudeInputRef.current) {
                    longitudeInputRef.current.value = longitude;
                  }


                  setGeolocationStatus({
                    type: "success",
                    message: "Posizione rilevata. Puoi inviare la segnalazione o correggere le coordinate."
                  });
                },
                (error) => {
                  const message =
                    error.code === error.PERMISSION_DENIED
                      ? "Permesso negato. Puoi continuare inserendo le coordinate manualmente."
                      : error.code === error.TIMEOUT
                        ? "Rilevamento scaduto. Puoi continuare inserendo le coordinate manualmente."
                        : "Non siamo riusciti a rilevare la posizione. Puoi continuare inserendo le coordinate manualmente.";

                  setGeolocationStatus({ type: "error", message });
                },
                { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 }
              );
            }}
            type="button"
            variant="secondary"
          >
            Usa la mia posizione
          </Button>
        </div>

        {geolocationStatus.type !== "idle" ? (
          <p
            className={
              geolocationStatus.type === "success"
                ? "text-sm font-medium text-primary"
                : "text-sm font-medium text-destructive"
            }
            role="status"
          >
            {geolocationStatus.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          hint="Campo temporaneo finche non saranno disponibili geocoding e mappa."
          htmlFor="latitude"
          label="Latitudine"
        >
          <Input
            aria-describedby={state.fieldErrors.latitude ? "latitude-error" : undefined}
            aria-invalid={Boolean(state.fieldErrors.latitude)}
            defaultValue={state.values.latitude}
            disabled={formDisabled}
            id="latitude"
            inputMode="decimal"
            name="latitude"
            placeholder="41.4821"
            ref={latitudeInputRef}
            required
          />
          <FieldError id="latitude-error" message={state.fieldErrors.latitude} />
        </Field>

        <Field
          hint="Campo temporaneo finche non saranno disponibili geocoding e mappa."
          htmlFor="longitude"
          label="Longitudine"
        >
          <Input
            aria-describedby={state.fieldErrors.longitude ? "longitude-error" : undefined}
            aria-invalid={Boolean(state.fieldErrors.longitude)}
            defaultValue={state.values.longitude}
            disabled={formDisabled}
            id="longitude"
            inputMode="decimal"
            name="longitude"
            placeholder="14.0474"
            ref={longitudeInputRef}
            required
          />
          <FieldError id="longitude-error" message={state.fieldErrors.longitude} />
        </Field>
      </div>

      <Field
        hint="Non inserire dati personali non necessari. La descrizione sara verificata prima della pubblicazione."
        htmlFor="description"
        label="Descrivi il problema"
      >
        <Textarea
          aria-describedby={state.fieldErrors.description ? "description-error" : undefined}
          aria-invalid={Boolean(state.fieldErrors.description)}
          defaultValue={state.values.description}
          disabled={formDisabled}
          id="description"
          name="description"
          placeholder="Spiega cosa succede, da quanto tempo e dove si trova il problema."
          required
          rows={6}
        />
        <FieldError id="description-error" message={state.fieldErrors.description} />
      </Field>


      <Field
        hint="Opzionale. Accettiamo JPEG, PNG o WebP fino a 10 MB. La foto sara verificata prima della pubblicazione."
        htmlFor="photo"
        label="Aggiungi una foto del problema"
      >
        <Input
          accept="image/jpeg,image/png,image/webp"
          aria-describedby={state.fieldErrors.photo ? "photo-error" : undefined}
          aria-invalid={Boolean(state.fieldErrors.photo)}
          disabled={formDisabled}
          id="photo"
          name="photo"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];

            if (photoPreviewUrl) {
              URL.revokeObjectURL(photoPreviewUrl);
            }

            if (!file) {
              setPhotoPreviewUrl(null);
              setPhotoName(null);
              return;
            }

            setPhotoPreviewUrl(URL.createObjectURL(file));
            setPhotoName(file.name);
          }}
          ref={photoInputRef}
          type="file"
        />
        <FieldError id="photo-error" message={state.fieldErrors.photo} />
        {photoPreviewUrl ? (
          <div className="grid gap-3 rounded-lg border border-border bg-muted/40 p-3">
            <img
              alt="Anteprima della foto selezionata"
              className="max-h-64 w-full rounded-md object-cover"
              src={photoPreviewUrl}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="truncate text-sm text-muted-foreground">{photoName}</p>
              <Button
                onClick={() => {
                  if (photoInputRef.current) {
                    photoInputRef.current.value = "";
                  }

                  if (photoPreviewUrl) {
                    URL.revokeObjectURL(photoPreviewUrl);
                  }

                  setPhotoPreviewUrl(null);
                  setPhotoName(null);
                }}
                type="button"
                variant="secondary"
              >
                Rimuovi foto
              </Button>
            </div>
          </div>
        ) : null}
      </Field>

      <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-muted-foreground">
          Nessun account richiesto. Non chiediamo nome, email o telefono.
        </p>
        <Button className="w-full sm:w-auto" disabled={formDisabled} type="submit">
          {pending ? "Invio in corso..." : state.status === "duplicates_found" ? "Ricontrolla segnalazione" : "Invia segnalazione"}
        </Button>
      </div>
    </form>
  );
}

function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${distanceMeters} m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(value));
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p className="text-sm font-medium text-destructive" id={id}>
      {message}
    </p>
  );
}

function getVisibleFieldErrors(
  fieldErrors: Partial<
    Record<"categoryId" | "description" | "latitude" | "longitude" | "address" | "photo", string>
  >
) {
  const labels = {
    categoryId: { fieldId: "categoryId", label: "Categoria" },
    address: { fieldId: "address", label: "Indirizzo" },
    latitude: { fieldId: "latitude", label: "Latitudine" },
    longitude: { fieldId: "longitude", label: "Longitudine" },
    description: { fieldId: "description", label: "Descrizione" },
    photo: { fieldId: "photo", label: "Foto" }
  } as const;

  return Object.entries(fieldErrors)
    .filter((entry): entry is [keyof typeof labels, string] => Boolean(entry[1]))
    .map(([fieldName, message]) => ({
      ...labels[fieldName],
      message
    }));
}

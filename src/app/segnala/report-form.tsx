"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { CategoryOption } from "@/modules/categories/application/category-repository";
import type { PublicMapConfig } from "@/shared/config/map";
import {
  Badge,
  Button,
  Textarea,
  cn
} from "@/shared/ui";
import { createReportAction } from "./actions";
import { initialCreateReportActionState, type CreateReportActionState } from "./form-state";
import { CopyPublicCodeButton } from "./copy-public-code-button";
import { LocationPicker } from "./location-picker";

type ReportFormProps = {
  categories: CategoryOption[];
  mapConfig: PublicMapConfig;
  onExitConfirmationChange?: (requiresConfirmation: boolean) => void;
  onStepChange?: (step: WizardStep) => void;
};

type WizardStep = 1 | 2 | 3 | 4 | 5;

type WizardValues = {
  categoryId: string;
  description: string;
  address: string;
  latitude: string;
  longitude: string;
  photo: File | null;
};

type WizardFieldErrors = CreateReportActionState["fieldErrors"];

const totalSteps = 5;
const descriptionMinLength = 20;
const descriptionMaxLength = 4000;
const addressMaxLength = 500;

export function ReportForm({ categories, mapConfig, onExitConfirmationChange, onStepChange }: ReportFormProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [values, setValues] = useState<WizardValues>(initialWizardValues);
  const valuesRef = useRef<WizardValues>(initialWizardValues);
  const [fieldErrors, setFieldErrors] = useState<WizardFieldErrors>({});
  const [actionState, setActionState] = useState<CreateReportActionState>(initialCreateReportActionState);
  const [submitting, setSubmitting] = useState(false);
  const [duplicateChoice, setDuplicateChoice] = useState<"review" | "different">("review");
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const formDisabled = categories.length === 0 || submitting;
  const selectedCategory = categories.find((category) => category.id === values.categoryId);
  const duplicateCandidates = actionState.status === "duplicates_found" ? actionState.duplicateCandidates ?? [] : [];

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);
  useEffect(() => {
    onExitConfirmationChange?.(hasWizardData(values));
  }, [onExitConfirmationChange, values]);

  useEffect(() => {
    onStepChange?.(currentStep);
  }, [currentStep, onStepChange]);


  if (actionState.status === "success" && actionState.publicCode) {
    return <SuccessState publicCode={actionState.publicCode} />;
  }

  function setWizardValues(updater: (current: WizardValues) => WizardValues) {
    const nextValues = updater(valuesRef.current);
    valuesRef.current = nextValues;
    setValues(nextValues);
  }

  function updateValue<Key extends keyof WizardValues>(key: Key, value: WizardValues[Key]) {
    setWizardValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
    if (actionState.status === "duplicates_found") {
      setActionState((current) => ({ ...current, status: "idle", duplicateCandidates: undefined }));
      setDuplicateChoice("review");
    }
  }

  function goToStep(step: WizardStep) {
    setCurrentStep(step);
    window.requestAnimationFrame(() => {
      document.getElementById("report-wizard-title")?.focus();
    });
  }

  function handleNext() {
    const errors = validateStep(currentStep, valuesRef.current);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    if (currentStep < totalSteps) {
      goToStep((currentStep + 1) as WizardStep);
    }
  }

  function handleBack() {
    if (currentStep > 1) {
      goToStep((currentStep - 1) as WizardStep);
    }
  }


  function handleLocationChange(nextLocation: Pick<WizardValues, "address" | "latitude" | "longitude">) {
    setWizardValues((current) => ({ ...current, ...nextLocation }));
    setFieldErrors((current) => ({ ...current, address: undefined, latitude: undefined, longitude: undefined }));
    if (actionState.status === "duplicates_found") {
      setActionState((current) => ({ ...current, status: "idle", duplicateCandidates: undefined }));
      setDuplicateChoice("review");
    }
  }

  function handlePhotoChange(file: File | null) {
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }

    setWizardValues((current) => ({ ...current, photo: file }));
    setFieldErrors((current) => ({ ...current, photo: undefined }));
    setPhotoPreviewUrl(file ? URL.createObjectURL(file) : null);

    if (!file && photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  }

  async function handleSubmit(forceDuplicateCreation = false) {
    const currentValues = valuesRef.current;
    const errors = validateAll(currentValues);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      const firstInvalidStep = getFirstInvalidStep(errors);
      goToStep(firstInvalidStep);
      return;
    }

    setSubmitting(true);
    setActionState((current) => ({ ...current, message: undefined, fieldErrors: {} }));

    try {
      const result = await createReportAction(actionState, buildReportFormData(valuesRef.current, forceDuplicateCreation));
      const resultFieldErrors = getFieldErrorsFromActionResult(result);
      setActionState(result);
      setFieldErrors(resultFieldErrors);

      if (result.status === "duplicates_found") {
        setDuplicateChoice("review");
        goToStep(5);
        return;
      }

      if (result.status === "error") {
        setDuplicateChoice("review");
        goToStep(getFirstInvalidStep(resultFieldErrors));
        return;
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-8" data-testid="report-wizard">
      {actionState.status === "error" && actionState.message ? (
        <AlertMessage message={actionState.message} fieldErrors={fieldErrors} />
      ) : null}

      {categories.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground" role="status">
          Al momento non ci sono categorie disponibili. Riprova piu tardi.
        </div>
      ) : null}

      <section aria-labelledby="report-wizard-title" className="grid gap-8">
        <StepHeader currentStep={currentStep} />

        {currentStep === 1 ? (
          <IntroStep onStart={() => goToStep(2)} />
        ) : null}

        {currentStep === 2 ? (
          <ProblemStep
            categories={categories}
            disabled={formDisabled}
            fieldErrors={fieldErrors}
            onBack={handleBack}
            onNext={handleNext}
            onUpdate={updateValue}
            values={values}
          />
        ) : null}

        {currentStep === 3 ? (
          <LocationStep
            disabled={formDisabled}
            fieldErrors={fieldErrors}
            mapConfig={mapConfig}
            onBack={handleBack}
            onLocationChange={handleLocationChange}
            onNext={handleNext}
            values={values}
          />
        ) : null}

        {currentStep === 4 ? (
          <PhotoStep
            disabled={formDisabled}
            fieldErrors={fieldErrors}
            onBack={handleBack}
            onNext={handleNext}
            onPhotoChange={handlePhotoChange}
            photoInputRef={photoInputRef}
            photoPreviewUrl={photoPreviewUrl}
            values={values}
          />
        ) : null}

        {currentStep === 5 ? (
          <ReviewStep
            duplicateCandidates={duplicateCandidates}
            duplicateChoice={duplicateChoice}
            fieldErrors={fieldErrors}
            formDisabled={formDisabled}
            onBack={handleBack}
            onDuplicateContinue={() => {
              setDuplicateChoice("different");
              void handleSubmit(true);
            }}
            onEdit={goToStep}
            onSubmit={() => void handleSubmit(false)}
            photoPreviewUrl={photoPreviewUrl}
            selectedCategoryName={selectedCategory?.name ?? "Categoria non selezionata"}
            submitting={submitting}
            values={values}
          />
        ) : null}
      </section>
    </div>
  );
}

function StepHeader({ currentStep }: { currentStep: WizardStep }) {
  const content: Record<WizardStep, { title: string; description?: string }> = {
    1: { title: "Segnala un problema" },
    2: { title: "Cosa vuoi segnalare?" },
    3: { title: "Dove si trova il problema?" },
    4: { title: "Vuoi aggiungere una foto?", description: "Opzionale" },
    5: { title: "Controlla la segnalazione" }
  };

  const step = content[currentStep];

  return (
    <div className="grid gap-3">
      {step.description ? <Badge className="w-fit" variant="secondary">{step.description}</Badge> : null}
      <h2 className="font-serif text-3xl font-semibold tracking-normal sm:text-4xl" id="report-wizard-title" tabIndex={-1}>
        {step.title}
      </h2>
    </div>
  );
}

function IntroStep({ onStart }: { onStart: () => void }) {
  const items = ["Descrivi", "Indica dove", "Segui lo stato"];

  return (
    <div className="grid justify-items-center gap-7">
      <p className="text-base leading-7 text-muted-foreground sm:text-lg">Ti guidiamo in pochi passaggi.</p>

      <ol className="grid w-full gap-3 border-y border-border py-5 sm:grid-cols-3">
        {items.map((item, index) => (
          <li className="flex items-center justify-center gap-3" key={item}>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {index + 1}
            </span>
            <span className="font-medium text-foreground">{item}</span>
          </li>
        ))}
      </ol>

      <div className="grid w-fit justify-items-center gap-3">
        <Button onClick={onStart} type="button">Inizia la segnalazione</Button>
        <p className="text-sm text-muted-foreground">Non servono account o dati personali.</p>
      </div>
    </div>
  );
}

function ProblemStep({
  categories,
  disabled,
  fieldErrors,
  onBack,
  onNext,
  onUpdate,
  values
}: {
  categories: CategoryOption[];
  disabled: boolean;
  fieldErrors: WizardFieldErrors;
  onBack: () => void;
  onNext: () => void;
  onUpdate: <Key extends keyof WizardValues>(key: Key, value: WizardValues[Key]) => void;
  values: WizardValues;
}) {
  return (
    <div className="grid gap-6 text-left">
      <fieldset
        aria-describedby={fieldErrors.categoryId ? "categoryId-error" : undefined}
        aria-invalid={Boolean(fieldErrors.categoryId)}
        className="grid gap-4"
      >
        <legend className="mb-4 block text-sm font-medium leading-none text-foreground">Che tipo di problema vuoi segnalare?</legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => {
            const selected = values.categoryId === category.id;

            return (
              <label
                className={cn(
                  "flex min-h-10 cursor-pointer items-center rounded-full border px-3.5 py-2 text-sm font-medium transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
                  selected
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
                  disabled && "cursor-not-allowed opacity-50"
                )}
                key={category.id}
              >
                <input
                  checked={selected}
                  className="sr-only"
                  disabled={disabled}
                  name="categoryId"
                  onChange={(event) => onUpdate("categoryId", event.currentTarget.value)}
                  required
                  type="radio"
                  value={category.id}
                />
                <span>{category.name}</span>
              </label>
            );
          })}
        </div>
        <FieldError id="categoryId-error" message={fieldErrors.categoryId} />
      </fieldset>

      <div className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-sm font-medium leading-none text-foreground" htmlFor="description">Descrivi il problema</label>
          <p className="text-sm text-muted-foreground">Minimo {descriptionMinLength} caratteri</p>
        </div>
        <Textarea
          aria-describedby={fieldErrors.description ? "description-error" : undefined}
          aria-invalid={Boolean(fieldErrors.description)}
          disabled={disabled}
          id="description"
          name="description"
          onChange={(event) => onUpdate("description", event.currentTarget.value)}
          placeholder="Spiega cosa succede, da quanto tempo e dove si trova il problema."
          required
          rows={7}
          value={values.description}
        />
        <FieldError id="description-error" message={fieldErrors.description} />
      </div>

      <WizardActions onBack={onBack} onNext={onNext} nextLabel="Continua" />
    </div>
  );
}

function LocationStep({
  disabled,
  fieldErrors,
  mapConfig,
  onBack,
  onLocationChange,
  onNext,
  values
}: {
  disabled: boolean;
  fieldErrors: WizardFieldErrors;
  mapConfig: PublicMapConfig;
  onBack: () => void;
  onLocationChange: (location: Pick<WizardValues, "address" | "latitude" | "longitude">) => void;
  onNext: () => void;
  values: WizardValues;
}) {
  return (
    <div className="grid gap-6 text-left">
      <LocationPicker
        disabled={disabled}
        fieldErrors={{
          address: fieldErrors.address,
          latitude: fieldErrors.latitude,
          longitude: fieldErrors.longitude
        }}
        initialAddress={values.address}
        initialLatitude={values.latitude}
        initialLongitude={values.longitude}
        mapConfig={mapConfig}
        onLocationChange={onLocationChange}
      />

      <WizardActions onBack={onBack} onNext={onNext} nextLabel="Continua" />
    </div>
  );
}

function PhotoStep({
  disabled,
  fieldErrors,
  onBack,
  onNext,
  onPhotoChange,
  photoInputRef,
  photoPreviewUrl,
  values
}: {
  disabled: boolean;
  fieldErrors: WizardFieldErrors;
  onBack: () => void;
  onNext: () => void;
  onPhotoChange: (file: File | null) => void;
  photoInputRef: RefObject<HTMLInputElement | null>;
  photoPreviewUrl: string | null;
  values: WizardValues;
}) {
  return (
    <div className="grid gap-6 text-left">
      <div className="grid gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-5">
        <div>
          <p className="text-lg font-semibold">Aggiungi una foto del problema</p>
          <p className="mt-1 text-sm text-muted-foreground">JPEG, PNG o WebP · max 10 MB</p>
        </div>
        <div>
          <input
            accept="image/jpeg,image/png,image/webp"
            aria-describedby={fieldErrors.photo ? "photo-error" : "photo-help"}
            aria-invalid={Boolean(fieldErrors.photo)}
            className="sr-only"
            disabled={disabled}
            id="photo"
            name="photo"
            onChange={(event) => onPhotoChange(event.currentTarget.files?.[0] ?? null)}
            ref={photoInputRef}
            type="file"
          />
          <label
            className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background"
            htmlFor="photo"
          >
            Scegli foto
          </label>
        </div>
        <p className="text-sm leading-6 text-muted-foreground" id="photo-help">La foto sarà verificata prima della pubblicazione.</p>
        <FieldError id="photo-error" message={fieldErrors.photo} />
      </div>

      {photoPreviewUrl && values.photo ? (
        <div className="grid gap-3 border-y border-border py-5">
          <img alt="Anteprima della foto selezionata" className="max-h-72 w-full rounded-xl object-cover" src={photoPreviewUrl} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="truncate text-sm text-muted-foreground">{values.photo.name}</p>
            <Button onClick={() => onPhotoChange(null)} type="button" variant="secondary">Rimuovi foto</Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Puoi continuare anche senza foto.</p>
      )}

      <WizardActions onBack={onBack} onNext={onNext} nextLabel="Continua" />
    </div>
  );
}

function ReviewStep({
  duplicateCandidates,
  duplicateChoice,
  fieldErrors,
  formDisabled,
  onBack,
  onDuplicateContinue,
  onEdit,
  onSubmit,
  photoPreviewUrl,
  selectedCategoryName,
  submitting,
  values
}: {
  duplicateCandidates: NonNullable<CreateReportActionState["duplicateCandidates"]>;
  duplicateChoice: "review" | "different";
  fieldErrors: WizardFieldErrors;
  formDisabled: boolean;
  onBack: () => void;
  onDuplicateContinue: () => void;
  onEdit: (step: WizardStep) => void;
  onSubmit: () => void;
  photoPreviewUrl: string | null;
  selectedCategoryName: string;
  submitting: boolean;
  values: WizardValues;
}) {
  if (duplicateCandidates.length > 0 && duplicateChoice === "review") {
    return (
      <DuplicateInterruption
        candidates={duplicateCandidates}
        onBack={onBack}
        onContinue={onDuplicateContinue}
        submitting={submitting}
      />
    );
  }

  return (
    <div className="grid gap-8 text-left">
      <div className="grid gap-6 border-y border-border py-6">
        <ReviewSection title="Problema" onEdit={() => onEdit(2)}>
          <dl className="grid gap-3 text-sm">
            <InfoRow label="Categoria" value={selectedCategoryName} />
            <div>
              <dt className="font-medium text-muted-foreground">Descrizione</dt>
              <dd className="mt-1 whitespace-pre-wrap leading-6 text-foreground">{values.description}</dd>
            </div>
          </dl>
        </ReviewSection>

        <ReviewSection title="Posizione" onEdit={() => onEdit(3)}>
          <p className="text-sm leading-6 text-foreground">{values.address || "Punto selezionato sulla mappa"}</p>
        </ReviewSection>

        <ReviewSection title="Foto" onEdit={() => onEdit(4)}>
          {photoPreviewUrl && values.photo ? (
            <div className="grid gap-3">
              <img alt="Anteprima della foto selezionata" className="max-h-56 w-full rounded-xl object-cover" src={photoPreviewUrl} />
              <p className="text-sm text-muted-foreground">{values.photo.name}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nessuna foto.</p>
          )}
        </ReviewSection>
      </div>

      {Object.keys(fieldErrors).length > 0 ? <AlertMessage message="Controlla i campi evidenziati." fieldErrors={fieldErrors} /> : null}

      <div className="grid gap-2 text-sm leading-6 text-muted-foreground">
        <p>La segnalazione sarà verificata da Visione Comune prima della pubblicazione.</p>
        <p>Dopo l&apos;invio riceverai un codice da conservare.</p>
      </div>

      <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
        <Button onClick={onBack} type="button" variant="secondary">Indietro</Button>
        <Button className="w-full sm:w-auto" disabled={formDisabled} onClick={onSubmit} type="button">
          {submitting ? "Invio in corso..." : "Invia segnalazione"}
        </Button>
      </div>
    </div>
  );
}

function DuplicateInterruption({
  candidates,
  onBack,
  onContinue,
  submitting
}: {
  candidates: NonNullable<CreateReportActionState["duplicateCandidates"]>;
  onBack: () => void;
  onContinue: () => void;
  submitting: boolean;
}) {
  return (
    <div className="grid gap-6 rounded-xl border border-primary/30 bg-primary/5 p-5">
      <div>
        <Badge className="w-fit">Controllo duplicati</Badge>
        <h3 className="mt-3 font-serif text-2xl font-semibold">Potrebbe esistere già una segnalazione simile</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Abbiamo trovato segnalazioni pubbliche recenti nella stessa categoria e molto vicine alla posizione indicata.
        </p>
      </div>
      <ul className="grid gap-3">
        {candidates.map((candidate) => (
          <li className="grid gap-3 rounded-lg border border-border bg-background p-4 sm:grid-cols-[1fr_auto] sm:items-center" key={candidate.publicCode}>
            <div className="grid gap-1">
              <p className="font-medium text-foreground">{candidate.title}</p>
              <p className="text-sm text-muted-foreground">{candidate.categoryName}{candidate.address ? ` · ${candidate.address}` : ""}</p>
              <p className="text-sm text-muted-foreground">Circa {formatDistance(candidate.distanceMeters)} · Stato {candidate.publicStatusLabel} · pubblicata il {formatDate(candidate.publishedAt)}</p>
            </div>
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              href={`/segnalazioni/${candidate.publicCode}#conferma`}
              rel="noreferrer"
              target="_blank"
            >
              Vedi e conferma
            </Link>
          </li>
        ))}
      </ul>
      <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
        <Button onClick={onBack} type="button" variant="secondary">Indietro</Button>
        <Button disabled={submitting} onClick={onContinue} type="button">
          {submitting ? "Invio in corso..." : "Il mio problema è diverso, continua"}
        </Button>
      </div>
    </div>
  );
}

function SuccessState({ publicCode }: { publicCode: string }) {
  return (
    <section aria-labelledby="report-created-title" className="grid gap-8 py-4" role="status">
      <div className="grid gap-4 text-center sm:text-left">
        <Badge className="mx-auto w-fit sm:mx-0">Segnalazione ricevuta</Badge>
        <h2 className="font-serif text-4xl font-semibold tracking-normal" id="report-created-title">Segnalazione ricevuta</h2>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          La segnalazione è in verifica. Usa questo codice per seguirne gli aggiornamenti.
        </p>
      </div>
      <div className="rounded-2xl border border-primary/30 bg-primary/10 p-6 text-center sm:text-left">
        <p className="text-sm font-medium text-muted-foreground">Codice segnalazione</p>
        <p className="mt-3 font-mono text-4xl font-semibold tracking-wide text-foreground sm:text-5xl">{publicCode}</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <CopyPublicCodeButton publicCode={publicCode} />
        <Link
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          href={`/segnalazione?codice=${publicCode}`}
        >
          Controlla lo stato
        </Link>
      </div>
    </section>
  );
}

function ReviewSection({ children, onEdit, title }: { children: ReactNode; onEdit: () => void; title: string }) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <Button onClick={onEdit} type="button" variant="ghost">Modifica</Button>
      </div>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-foreground">{value}</dd>
    </div>
  );
}

function WizardActions({ onBack, onNext, nextLabel }: { onBack: () => void; onNext: () => void; nextLabel: string }) {
  return (
    <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
      <Button onClick={onBack} type="button" variant="secondary">Indietro</Button>
      <Button className="w-full sm:w-auto" onClick={onNext} type="button">{nextLabel}</Button>
    </div>
  );
}

function AlertMessage({ fieldErrors, message }: { fieldErrors: WizardFieldErrors; message: string }) {
  const visibleFieldErrors = getVisibleFieldErrors(fieldErrors);

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-foreground" role="alert">
      <p className="font-medium">{message}</p>
      {visibleFieldErrors.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {visibleFieldErrors.map((fieldError) => (
            <li key={fieldError.key}>{fieldError.label}: {fieldError.message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function getFieldErrorsFromActionResult(result: CreateReportActionState): WizardFieldErrors {
  if (result.status === "error" && result.message === "La foto deve essere JPEG, PNG o WebP.") {
    return { ...result.fieldErrors, photo: result.message };
  }

  return result.fieldErrors;
}

function buildReportFormData(values: WizardValues, forceDuplicateCreation: boolean): FormData {
  const formData = new FormData();
  formData.set("categoryId", values.categoryId);
  formData.set("description", values.description);
  formData.set("address", values.address);
  formData.set("latitude", values.latitude);
  formData.set("longitude", values.longitude);

  if (values.photo) {
    formData.set("photo", values.photo);
  }

  if (forceDuplicateCreation) {
    formData.set("duplicateChoice", "different");
  }

  return formData;
}

function validateAll(values: WizardValues): WizardFieldErrors {
  return {
    ...validateProblemStep(values),
    ...validateLocationStep(values)
  };
}

function validateStep(step: WizardStep, values: WizardValues): WizardFieldErrors {
  if (step === 2) return validateProblemStep(values);
  if (step === 3) return validateLocationStep(values);
  return {};
}

function validateProblemStep(values: WizardValues): WizardFieldErrors {
  const errors: WizardFieldErrors = {};
  const description = values.description.trim().replace(/\s+/g, " ");

  if (!values.categoryId) {
    errors.categoryId = "Seleziona una categoria.";
  }

  if (!description) {
    errors.description = "Descrivi il problema.";
  } else if (description.length < descriptionMinLength) {
    errors.description = `Descrivi il problema con almeno ${descriptionMinLength} caratteri.`;
  } else if (description.length > descriptionMaxLength) {
    errors.description = `La descrizione non puo superare ${descriptionMaxLength} caratteri.`;
  }

  return errors;
}

function validateLocationStep(values: WizardValues): WizardFieldErrors {
  const errors: WizardFieldErrors = {};
  const latitude = Number(values.latitude);
  const longitude = Number(values.longitude);

  if (!values.latitude.trim() || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    errors.latitude = "Seleziona la posizione del problema.";
  }

  if (!values.longitude.trim() || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    errors.longitude = "Seleziona la posizione del problema.";
  }

  if (values.address.trim().length > addressMaxLength) {
    errors.address = `L'indirizzo non puo superare ${addressMaxLength} caratteri.`;
  }

  return errors;
}

function getFirstInvalidStep(fieldErrors: WizardFieldErrors): WizardStep {
  if (fieldErrors.categoryId || fieldErrors.description) return 2;
  if (fieldErrors.address || fieldErrors.latitude || fieldErrors.longitude) return 3;
  if (fieldErrors.photo) return 4;
  return 5;
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

function getVisibleFieldErrors(fieldErrors: WizardFieldErrors) {
  const labels = {
    categoryId: { fieldId: "categoryId", label: "Categoria" },
    address: { fieldId: "address", label: "Indirizzo" },
    latitude: { fieldId: "address", label: "Posizione" },
    longitude: { fieldId: "address", label: "Posizione" },
    description: { fieldId: "description", label: "Descrizione" },
    photo: { fieldId: "photo", label: "Foto" }
  } as const;

  return Object.entries(fieldErrors)
    .filter((entry): entry is [keyof typeof labels, string] => Boolean(entry[1]))
    .map(([fieldName, message]) => ({
      ...labels[fieldName],
      key: fieldName,
      message
    }));
}

function hasWizardData(values: WizardValues): boolean {
  return Boolean(
    values.categoryId ||
    values.description.trim() ||
    values.address.trim() ||
    values.latitude.trim() ||
    values.longitude.trim() ||
    values.photo
  );
}

const initialWizardValues: WizardValues = {
  categoryId: "",
  description: "",
  address: "",
  latitude: "",
  longitude: "",
  photo: null
};

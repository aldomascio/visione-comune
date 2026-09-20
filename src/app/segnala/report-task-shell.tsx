"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CategoryOption } from "@/modules/categories/application/category-repository";
import type { PublicMapConfig } from "@/shared/config/map";
import { Button, cn } from "@/shared/ui";
import { ReportForm } from "./report-form";

type ReportTaskShellProps = {
  categories: CategoryOption[];
  mapConfig: PublicMapConfig;
};

export function ReportTaskShell({ categories, mapConfig }: ReportTaskShellProps) {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const [exitRequiresConfirmation, setExitRequiresConfirmation] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  function handleExit() {
    if (exitRequiresConfirmation) {
      const confirmed = window.confirm("Vuoi uscire dalla segnalazione? I dati inseriti andranno persi.");

      if (!confirmed) {
        return;
      }
    }

    router.push("/");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ReportTaskHeader
        currentStep={currentStep}
        helpOpen={helpOpen}
        onExit={handleExit}
        onHelpOpenChange={setHelpOpen}
      />

      <main className="grid min-h-[calc(100vh-5.5rem)] px-6 py-10 sm:px-8 lg:px-12">
        <section className="mx-auto grid w-full max-w-3xl content-center gap-8 text-center" aria-label="Procedura guidata segnalazione">
          <ReportForm
            categories={categories}
            mapConfig={mapConfig}
            onExitConfirmationChange={setExitRequiresConfirmation}
            onStepChange={setCurrentStep}
          />
        </section>
      </main>
    </div>
  );
}

function ReportTaskHeader({
  currentStep,
  helpOpen,
  onExit,
  onHelpOpenChange
}: {
  currentStep: number;
  helpOpen: boolean;
  onExit: () => void;
  onHelpOpenChange: (open: boolean) => void;
}) {
  return (
    <>
      <header className="sticky top-0 z-40 bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-6xl grid-cols-3 items-center gap-4 py-3">
          <button className="inline-flex items-center gap-2 justify-self-start text-sm font-semibold text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={onExit} type="button">
            <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={2} />
            Esci
          </button>

          <span aria-label="Visione Comune" className="justify-self-center" role="img">
            <LogoMark className="h-14 w-14" />
          </span>

          <Button
            aria-label="Guida"
            className="size-10 justify-self-end rounded-full px-0 text-base"
            onClick={() => onHelpOpenChange(true)}
            type="button"
            variant="secondary"
          >
            ?
          </Button>
        </div>
        {currentStep > 0 ? (
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-border" aria-hidden="true">
            <div className="h-full bg-primary transition-[width] duration-300 ease-out" style={{ width: `${((currentStep - 1) / 4) * 100}%` }} />
          </div>
        ) : null}
      </header>

      {helpOpen ? <ReportHelpDialog onClose={() => onHelpOpenChange(false)} /> : null}
    </>
  );
}

function ReportHelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <button
        aria-label="Chiudi guida"
        className="absolute inset-0 h-full w-full bg-foreground/20 backdrop-blur-[1px]"
        onClick={onClose}
        type="button"
      />
      <aside
        aria-labelledby="report-help-title"
        aria-modal="true"
        className="absolute right-0 top-0 grid h-full w-full max-w-md content-start gap-6 overflow-y-auto border-l border-border bg-background p-6 shadow-xl sm:p-8"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-2">
            <p className="text-sm font-semibold text-primary">Guida</p>
            <h2 className="font-serif text-2xl font-semibold" id="report-help-title">Come compilare la segnalazione</h2>
          </div>
          <Button onClick={onClose} type="button" variant="ghost">Chiudi</Button>
        </div>

        <div className="grid gap-5 text-sm leading-6 text-muted-foreground">
          <HelpSection title="Come funziona">
            Descrivi il problema, indica dove si trova e controlla il riepilogo prima di inviarlo.
          </HelpSection>
          <HelpSection title="Dopo l&apos;invio">
            Ricevi un codice pubblico per seguire lo stato. La segnalazione viene verificata prima della pubblicazione.
          </HelpSection>
          <HelpSection title="Dati richiesti">
            Servono categoria, descrizione e posizione. La foto e opzionale. Non servono account o dati personali.
          </HelpSection>
          <HelpSection title="Posizione corretta">
            Cerca l&apos;indirizzo, usa la tua posizione o scegli il punto sulla mappa quando l&apos;indirizzo non basta.
          </HelpSection>
        </div>
      </aside>
    </div>
  );
}

function HelpSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="grid gap-1">
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p>{children}</p>
    </section>
  );
}

function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("block bg-foreground", className)}
      style={{
        WebkitMask: "url('/logo.svg') center / contain no-repeat",
        mask: "url('/logo.svg') center / contain no-repeat"
      }}
    />
  );
}

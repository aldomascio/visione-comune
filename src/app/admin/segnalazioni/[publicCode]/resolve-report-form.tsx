"use client";

import { Button, Textarea } from "@/shared/ui";
import { resolveReportAction } from "../actions";

export function ResolveReportForm({ publicCode }: { publicCode: string }) {
  return (
    <form
      action={resolveReportAction}
      className="grid gap-3"
      onSubmit={(event) => {
        const confirmed = window.confirm(
          "Segnare questa segnalazione come risolta? Conferma solo se Visione Comune ha verificato che il problema sia stato effettivamente risolto."
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input name="publicCode" type="hidden" value={publicCode} />
      <label className="grid gap-2 text-sm font-medium" htmlFor="resolutionInternalNote">
        Nota interna opzionale
        <Textarea
          id="resolutionInternalNote"
          maxLength={1000}
          name="internalNote"
          placeholder="Esempio: sopralluogo, comunicazione dell'ente, verifica fotografica, riscontro sul posto."
        />
      </label>
      <Button className="w-full" type="submit">
        Segna come risolta
      </Button>
    </form>
  );
}

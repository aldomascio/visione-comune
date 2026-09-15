"use client";

import { useActionState } from "react";
import { Button } from "@/shared/ui";
import {
  confirmReportAction,
  type ConfirmReportActionState
} from "./actions";

const initialConfirmReportActionState: ConfirmReportActionState = {
  status: "idle"
};

type ConfirmReportFormProps = {
  publicCode: string;
  alreadyConfirmed: boolean;
  confirmable: boolean;
  primaryPublicCode?: string;
};

export function ConfirmReportForm({ publicCode, alreadyConfirmed, confirmable, primaryPublicCode }: ConfirmReportFormProps) {
  const [state, formAction, pending] = useActionState<ConfirmReportActionState, FormData>(
    confirmReportAction.bind(null, publicCode),
    initialConfirmReportActionState
  );
  const confirmed = alreadyConfirmed || state.status === "confirmed" || state.status === "already_confirmed";

  if (!confirmable) {
    return (
      <div className="grid gap-3">
        <Button disabled type="button">Conferme raccolte sulla principale</Button>
        <p className="text-sm leading-6 text-muted-foreground">
          Le nuove conferme vengono raccolte sulla segnalazione principale{primaryPublicCode ? ` ${primaryPublicCode}` : ""}.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-3">
      <Button disabled={confirmed || pending} type="submit">
        {confirmed
          ? "Segnalazione confermata"
          : pending
            ? "Conferma in corso..."
            : "Conferma anche tu"}
      </Button>
      {confirmed ? (
        <p className="text-sm font-medium text-primary">Hai confermato questa segnalazione.</p>
      ) : null}
      {state.status === "error" && state.message ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

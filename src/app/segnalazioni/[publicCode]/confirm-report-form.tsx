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
};

export function ConfirmReportForm({ publicCode, alreadyConfirmed }: ConfirmReportFormProps) {
  const [state, formAction, pending] = useActionState<ConfirmReportActionState, FormData>(
    confirmReportAction.bind(null, publicCode),
    initialConfirmReportActionState
  );
  const confirmed = alreadyConfirmed || state.status === "confirmed" || state.status === "already_confirmed";

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

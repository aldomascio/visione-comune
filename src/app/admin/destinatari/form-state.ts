import type { RecipientFieldErrors } from "@/modules/recipients/application/manage-recipients";

export type RecipientActionState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors: RecipientFieldErrors;
  values: {
    name: string;
    organization: string;
    email: string;
    pec: string;
    active: string;
  };
};

export const initialRecipientActionState: RecipientActionState = {
  status: "idle",
  fieldErrors: {},
  values: { name: "", organization: "", email: "", pec: "", active: "true" }
};

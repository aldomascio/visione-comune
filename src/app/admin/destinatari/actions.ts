"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CreateRecipientUseCase,
  DuplicateRecipientContactError,
  RecipientValidationError,
  UpdateRecipientUseCase,
  mapRecipientManagementErrorToMessage
} from "@/modules/recipients/application/manage-recipients";
import { DrizzleRecipientRepository } from "@/modules/recipients/infrastructure/drizzle-recipient-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { requireActiveAdmin } from "../admin-auth";
import { initialRecipientActionState, type RecipientActionState } from "./form-state";

export async function createRecipientAction(_previousState: RecipientActionState, formData: FormData): Promise<RecipientActionState> {
  await requireActiveAdmin();
  const values = readRecipientFormValues(formData);
  let connection;
  let shouldRedirect = false;

  try {
    connection = createDatabaseConnection();
    await new CreateRecipientUseCase({ recipientRepository: new DrizzleRecipientRepository(connection.db) }).execute(values);
    revalidatePath("/admin/destinatari");
    revalidatePath("/admin/smistamento");
    shouldRedirect = true;
  } catch (error) {
    if (!(error instanceof RecipientValidationError) && !(error instanceof DuplicateRecipientContactError)) {
      console.error("Unable to create recipient", error);
    }
    return { status: "error", message: mapRecipientManagementErrorToMessage(error), fieldErrors: getFieldErrors(error), values };
  } finally {
    await connection?.close();
  }

  if (shouldRedirect) redirect("/admin/destinatari?created=1");
  return initialRecipientActionState;
}

export async function updateRecipientAction(_previousState: RecipientActionState, formData: FormData): Promise<RecipientActionState> {
  await requireActiveAdmin();
  const id = getFormValue(formData, "id");
  const values = readRecipientFormValues(formData);
  let connection;
  let shouldRedirect = false;

  try {
    connection = createDatabaseConnection();
    await new UpdateRecipientUseCase({ recipientRepository: new DrizzleRecipientRepository(connection.db) }).execute({ id, ...values });
    revalidatePath("/admin/destinatari");
    revalidatePath(`/admin/destinatari/${id}`);
    revalidatePath("/admin/smistamento");
    revalidatePath("/admin/segnalazioni/[publicCode]", "page");
    shouldRedirect = true;
  } catch (error) {
    if (!(error instanceof RecipientValidationError) && !(error instanceof DuplicateRecipientContactError)) {
      console.error("Unable to update recipient", error);
    }
    return { status: "error", message: mapRecipientManagementErrorToMessage(error), fieldErrors: getFieldErrors(error), values };
  } finally {
    await connection?.close();
  }

  if (shouldRedirect) redirect("/admin/destinatari?updated=1");
  return initialRecipientActionState;
}

function readRecipientFormValues(formData: FormData): RecipientActionState["values"] {
  return {
    name: getFormValue(formData, "name"),
    organization: getFormValue(formData, "organization"),
    email: getFormValue(formData, "email"),
    pec: getFormValue(formData, "pec"),
    active: getFormValue(formData, "active") || "true"
  };
}

function getFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getFieldErrors(error: unknown): RecipientActionState["fieldErrors"] {
  if (error instanceof RecipientValidationError) return error.fieldErrors;
  if (error instanceof DuplicateRecipientContactError) return { [error.field]: error.field === "email" ? "Questa email e gia usata." : "Questa PEC e gia usata." };
  return {};
}

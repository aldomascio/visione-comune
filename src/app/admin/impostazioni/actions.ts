"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  PublicContactSettingsValidationError,
  UpdatePublicContactSettingsUseCase
} from "@/modules/site-settings/application/manage-public-contact-settings";
import { DrizzlePublicContactSettingsRepository } from "@/modules/site-settings/infrastructure/drizzle-public-contact-settings-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { requireActiveAdmin } from "../admin-auth";
import type { PublicContactSettingsActionState } from "./form-state";

export async function updatePublicContactSettingsAction(
  _previousState: PublicContactSettingsActionState,
  formData: FormData
): Promise<PublicContactSettingsActionState> {
  await requireActiveAdmin();
  const values = readValues(formData);
  let connection;
  let shouldRedirect = false;

  try {
    connection = createDatabaseConnection();
    await new UpdatePublicContactSettingsUseCase(
      new DrizzlePublicContactSettingsRepository(connection.db)
    ).execute(values);
    revalidatePath("/", "layout");
    revalidatePath("/admin/impostazioni");
    shouldRedirect = true;
  } catch (error) {
    if (!(error instanceof PublicContactSettingsValidationError)) {
      console.error("Unable to update public contact settings", error);
    }

    return {
      status: "error",
      message: error instanceof PublicContactSettingsValidationError
        ? "Controlla i campi evidenziati."
        : "Non è stato possibile salvare le impostazioni.",
      fieldErrors: error instanceof PublicContactSettingsValidationError ? error.fieldErrors : {},
      values
    };
  } finally {
    await connection?.close();
  }

  if (shouldRedirect) redirect("/admin/impostazioni?updated=1");

  return { status: "idle", fieldErrors: {}, values };
}

function readValues(formData: FormData): PublicContactSettingsActionState["values"] {
  return {
    facebookUrl: getValue(formData, "facebookUrl"),
    instagramUrl: getValue(formData, "instagramUrl"),
    tiktokUrl: getValue(formData, "tiktokUrl"),
    contactEmail: getValue(formData, "contactEmail")
  };
}

function getValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

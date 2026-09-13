"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DrizzleCategoryRepository } from "@/modules/categories/infrastructure/drizzle-category-repository";
import {
  CategoryForRoutingNotFoundError,
  InvalidCategoryRecipientAssociationError,
  UpdateCategoryRecipientsUseCase,
  mapRecipientManagementErrorToMessage
} from "@/modules/recipients/application/manage-recipients";
import { DrizzleRecipientRepository } from "@/modules/recipients/infrastructure/drizzle-recipient-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { requireActiveAdmin } from "../admin-auth";

export async function updateCategoryRecipientsAction(formData: FormData): Promise<void> {
  await requireActiveAdmin();
  const categoryId = getFormValue(formData, "categoryId");
  const recipientIds = formData.getAll("recipientId").filter((value): value is string => typeof value === "string");
  const primaryRecipientId = getFormValue(formData, "primaryRecipientId");
  let redirectTo = "/admin/smistamento?updated=1";
  let connection;

  try {
    connection = createDatabaseConnection();
    const recipientRepository = new DrizzleRecipientRepository(connection.db);
    await new UpdateCategoryRecipientsUseCase({
      categoryRepository: new DrizzleCategoryRepository(connection.db),
      recipientRepository,
      categoryRecipientRepository: recipientRepository
    }).execute({ categoryId, recipientIds, primaryRecipientId });
    revalidatePath("/admin/smistamento");
    revalidatePath("/admin/destinatari");
    revalidatePath("/admin/segnalazioni/[publicCode]", "page");
  } catch (error) {
    if (!(error instanceof CategoryForRoutingNotFoundError) && !(error instanceof InvalidCategoryRecipientAssociationError)) {
      console.error("Unable to update routing matrix", error);
    }
    redirectTo = `/admin/smistamento?error=${encodeURIComponent(mapRecipientManagementErrorToMessage(error))}`;
  } finally {
    await connection?.close();
  }

  redirect(redirectTo);
}

function getFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

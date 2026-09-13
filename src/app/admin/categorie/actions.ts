"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CategoryValidationError,
  CreateCategoryUseCase,
  DuplicateCategorySlugError,
  mapCategoryManagementErrorToMessage,
  UpdateCategoryUseCase
} from "@/modules/categories/application/manage-categories";
import { DrizzleCategoryRepository } from "@/modules/categories/infrastructure/drizzle-category-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { requireActiveAdmin } from "../admin-auth";
import { initialCategoryActionState, type CategoryActionState } from "./form-state";

export async function createCategoryAction(
  _previousState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  await requireActiveAdmin();

  const values = readCategoryFormValues(formData);
  let connection;
  let shouldRedirect = false;

  try {
    connection = createDatabaseConnection();
    await new CreateCategoryUseCase({
      categoryRepository: new DrizzleCategoryRepository(connection.db)
    }).execute(values);

    revalidatePath("/admin/categorie");
    revalidatePath("/segnala");
    shouldRedirect = true;
  } catch (error) {
    if (!(error instanceof CategoryValidationError) && !(error instanceof DuplicateCategorySlugError)) {
      console.error("Unable to create category", error);
    }

    return {
      status: "error",
      message: mapCategoryManagementErrorToMessage(error),
      fieldErrors: getFieldErrors(error),
      values
    };
  } finally {
    await connection?.close();
  }

  if (shouldRedirect) {
    redirect("/admin/categorie?created=1");
  }

  return initialCategoryActionState;
}

export async function updateCategoryAction(
  _previousState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  await requireActiveAdmin();

  const id = getFormValue(formData, "id");
  const values = readCategoryFormValues(formData);
  let connection;
  let shouldRedirect = false;

  try {
    connection = createDatabaseConnection();
    await new UpdateCategoryUseCase({
      categoryRepository: new DrizzleCategoryRepository(connection.db)
    }).execute({ id, ...values });

    revalidatePath("/admin/categorie");
    revalidatePath(`/admin/categorie/${id}`);
    revalidatePath("/segnala");
    revalidatePath("/mappa");
    shouldRedirect = true;
  } catch (error) {
    if (!(error instanceof CategoryValidationError) && !(error instanceof DuplicateCategorySlugError)) {
      console.error("Unable to update category", error);
    }

    return {
      status: "error",
      message: mapCategoryManagementErrorToMessage(error),
      fieldErrors: getFieldErrors(error),
      values
    };
  } finally {
    await connection?.close();
  }

  if (shouldRedirect) {
    redirect("/admin/categorie?updated=1");
  }

  return initialCategoryActionState;
}

function readCategoryFormValues(formData: FormData): CategoryActionState["values"] {
  return {
    name: getFormValue(formData, "name"),
    slug: getFormValue(formData, "slug"),
    active: getFormValue(formData, "active") || "true"
  };
}

function getFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function getFieldErrors(error: unknown): CategoryActionState["fieldErrors"] {
  if (error instanceof CategoryValidationError) {
    return error.fieldErrors;
  }

  if (error instanceof DuplicateCategorySlugError) {
    return { slug: "Questo slug e gia usato da un'altra categoria." };
  }

  return {};
}

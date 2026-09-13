"use server";

import { DrizzleCategoryRepository } from "@/modules/categories/infrastructure/drizzle-category-repository";
import {
  CreateReportUseCase,
  CreateReportValidationError,
  mapCreateReportErrorToMessage
} from "@/modules/reports/application/create-report";
import { RandomPublicCodeGenerator } from "@/modules/reports/application/public-code-generator";
import { DrizzleReportRepository } from "@/modules/reports/infrastructure/drizzle-report-repository";
import { LocalStorageProvider } from "@/modules/storage/infrastructure/local-storage-provider";
import { createDatabaseConnection } from "@/shared/db/client";

import { initialCreateReportActionState, type CreateReportActionState } from "./form-state";

export async function createReportAction(
  _previousState: CreateReportActionState,
  formData: FormData
): Promise<CreateReportActionState> {
  const values = {
    categoryId: getFormValue(formData, "categoryId"),
    description: getFormValue(formData, "description"),
    latitude: getFormValue(formData, "latitude"),
    longitude: getFormValue(formData, "longitude"),
    address: getFormValue(formData, "address"),
    photo: await getOptionalPhoto(formData, "photo")
  };

  let connection;

  try {
    connection = createDatabaseConnection();
    const useCase = new CreateReportUseCase({
      reportRepository: new DrizzleReportRepository(connection.db),
      categoryRepository: new DrizzleCategoryRepository(connection.db),
      publicCodeGenerator: new RandomPublicCodeGenerator(),
      storageProvider: new LocalStorageProvider()
    });
    const result = await useCase.execute(values);

    return {
      status: "success",
      publicCode: result.publicCode,
      message: "Segnalazione ricevuta.",
      fieldErrors: {},
      values: initialCreateReportActionState.values
    };
  } catch (error) {
    if (!(error instanceof CreateReportValidationError) && !(error instanceof Error && error.name === "InvalidReportImageError")) {
      console.error("Unable to create report", error);
    }

    return {
      status: "error",
      message: mapCreateReportErrorToMessage(error),
      fieldErrors: error instanceof CreateReportValidationError ? error.fieldErrors : {},
      values: {
        categoryId: values.categoryId,
        description: values.description,
        latitude: values.latitude,
        longitude: values.longitude,
        address: values.address
      }
    };
  } finally {
    await connection?.close();
  }
}

function getFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}


async function getOptionalPhoto(formData: FormData, key: string): Promise<{ buffer: Buffer; mimeType?: string } | undefined> {
  const value = formData.get(key);

  if (!(value instanceof File) || value.size === 0) {
    return undefined;
  }

  return {
    buffer: Buffer.from(await value.arrayBuffer()),
    ...(value.type ? { mimeType: value.type } : {})
  };
}

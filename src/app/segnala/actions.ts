"use server";

import { DrizzleCategoryRepository } from "@/modules/categories/infrastructure/drizzle-category-repository";
import {
  CreateReportUseCase,
  CreateReportValidationError,
  mapCreateReportErrorToMessage
} from "@/modules/reports/application/create-report";
import { RandomPublicCodeGenerator } from "@/modules/reports/application/public-code-generator";
import { DrizzleReportRepository } from "@/modules/reports/infrastructure/drizzle-report-repository";
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
    address: getFormValue(formData, "address")
  };

  let connection;

  try {
    connection = createDatabaseConnection();
    const useCase = new CreateReportUseCase({
      reportRepository: new DrizzleReportRepository(connection.db),
      categoryRepository: new DrizzleCategoryRepository(connection.db),
      publicCodeGenerator: new RandomPublicCodeGenerator()
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
    if (!(error instanceof CreateReportValidationError)) {
      console.error("Unable to create report", error);
    }

    return {
      status: "error",
      message: mapCreateReportErrorToMessage(error),
      fieldErrors: error instanceof CreateReportValidationError ? error.fieldErrors : {},
      values
    };
  } finally {
    await connection?.close();
  }
}

function getFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

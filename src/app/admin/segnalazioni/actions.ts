"use server";

import { revalidatePath } from "next/cache";
import { CreateAdminReportUseCase, CreateReportValidationError, mapCreateReportErrorToMessage } from "@/modules/reports/application/create-report";
import { RandomPublicCodeGenerator } from "@/modules/reports/application/public-code-generator";
import { LocalStorageProvider } from "@/modules/storage/infrastructure/local-storage-provider";
import { redirect } from "next/navigation";
import {
  ApproveReportUseCase,
  InvalidModerationPublicCodeError,
  RejectReportUseCase,
  ReportAlreadyModeratedError,
  ReportForModerationNotFoundError,
  ReportModerationConflictError
} from "@/modules/reports/application/moderate-report";
import {
  InvalidResolutionPublicCodeError,
  ReportForResolutionNotFoundError,
  ReportResolutionConflictError,
  ReportResolutionNotAllowedError,
  ResolveReportUseCase
} from "@/modules/reports/application/resolve-report";
import { DrizzleCategoryRepository } from "@/modules/categories/infrastructure/drizzle-category-repository";
import {
  CreateManualCommunicationUseCase,
  MarkCommunicationDeliveredUseCase,
  MarkCommunicationFailedUseCase,
  mapCommunicationErrorToMessage
} from "@/modules/communications/application/manual-communications";
import { DrizzleOutboundCommunicationRepository } from "@/modules/communications/infrastructure/drizzle-outbound-communication-repository";
import { DrizzleRecipientRepository } from "@/modules/recipients/infrastructure/drizzle-recipient-repository";
import { DrizzleReportRepository } from "@/modules/reports/infrastructure/drizzle-report-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { requireActiveAdmin } from "../admin-auth";
import { initialCreateAdminReportActionState, type CreateAdminReportActionState } from "./nuova/form-state";



export async function createAdminReportAction(
  _previousState: CreateAdminReportActionState,
  formData: FormData
): Promise<CreateAdminReportActionState> {
  const activeAdmin = await requireActiveAdmin();
  const values = {
    categoryId: getRequiredString(formData, "categoryId"),
    source: getRequiredString(formData, "source"),
    description: getRequiredString(formData, "description"),
    latitude: getRequiredString(formData, "latitude"),
    longitude: getRequiredString(formData, "longitude"),
    address: getRequiredString(formData, "address")
  };
  let connection;

  try {
    connection = createDatabaseConnection();
    const useCase = new CreateAdminReportUseCase({
      reportRepository: new DrizzleReportRepository(connection.db),
      categoryRepository: new DrizzleCategoryRepository(connection.db),
      publicCodeGenerator: new RandomPublicCodeGenerator(),
      storageProvider: new LocalStorageProvider()
    });
    const result = await useCase.execute({
      ...values,
      createdByAdminId: activeAdmin.id,
      photo: await getOptionalPhoto(formData, "photo")
    });

    revalidatePath("/admin");
    revalidatePath("/admin/segnalazioni");
    revalidatePath(`/admin/segnalazioni/${result.publicCode}`);

    return {
      status: "success",
      publicCode: result.publicCode,
      message: "Segnalazione manuale creata.",
      fieldErrors: {},
      values: initialCreateAdminReportActionState.values
    };
  } catch (error) {
    if (!(error instanceof CreateReportValidationError) && !(error instanceof Error && error.name === "InvalidReportImageError")) {
      console.error("Unable to create admin report", error);
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

export async function createManualCommunicationAction(formData: FormData): Promise<void> {
  await requireActiveAdmin();
  const publicCode = getPublicCode(formData);
  let redirectTo = `/admin/segnalazioni/${encodeURIComponent(publicCode)}`;
  let connection;

  try {
    connection = createDatabaseConnection();
    await new CreateManualCommunicationUseCase({
      reportRepository: new DrizzleReportRepository(connection.db),
      recipientRepository: new DrizzleRecipientRepository(connection.db),
      categoryRepository: new DrizzleCategoryRepository(connection.db),
      communicationRepository: new DrizzleOutboundCommunicationRepository(connection.db)
    }).execute({
      publicCode,
      recipientId: getRequiredString(formData, "recipientId"),
      channel: getRequiredString(formData, "channel"),
      subject: getRequiredString(formData, "subject"),
      body: getRequiredString(formData, "body"),
      status: getRequiredString(formData, "status")
    });

    revalidateReportPaths(publicCode);
    redirectTo = `${redirectTo}?communication=created`;
  } catch (error) {
    console.error("Unable to create manual communication", error);
    redirectTo = `${redirectTo}?communicationError=${encodeURIComponent(mapCommunicationErrorToMessage(error))}`;
  } finally {
    await connection?.close();
  }

  redirect(redirectTo);
}

export async function markCommunicationDeliveredAction(formData: FormData): Promise<void> {
  await updateCommunicationStatus({ formData, status: "delivered" });
}

export async function markCommunicationFailedAction(formData: FormData): Promise<void> {
  await updateCommunicationStatus({ formData, status: "failed" });
}

async function updateCommunicationStatus(input: { formData: FormData; status: "delivered" | "failed" }): Promise<void> {
  await requireActiveAdmin();
  const publicCode = getPublicCode(input.formData);
  const communicationId = getRequiredString(input.formData, "communicationId");
  let redirectTo = `/admin/segnalazioni/${encodeURIComponent(publicCode)}`;
  let connection;

  try {
    connection = createDatabaseConnection();
    const communicationRepository = new DrizzleOutboundCommunicationRepository(connection.db);

    if (input.status === "delivered") {
      await new MarkCommunicationDeliveredUseCase({
        reportRepository: new DrizzleReportRepository(connection.db),
        communicationRepository
      }).execute({ communicationId });
      redirectTo = `${redirectTo}?communication=delivered`;
    } else {
      await new MarkCommunicationFailedUseCase({ communicationRepository }).execute({ communicationId });
      redirectTo = `${redirectTo}?communication=failed`;
    }

    revalidateReportPaths(publicCode);
  } catch (error) {
    console.error("Unable to update communication", error);
    redirectTo = `${redirectTo}?communicationError=${encodeURIComponent(mapCommunicationErrorToMessage(error))}`;
  } finally {
    await connection?.close();
  }

  redirect(redirectTo);
}

export async function approveReportAction(formData: FormData): Promise<void> {
  await moderateReport({ formData, action: "approve" });
}

export async function rejectReportAction(formData: FormData): Promise<void> {
  await moderateReport({ formData, action: "reject" });
}

export async function resolveReportAction(formData: FormData): Promise<void> {
  await requireActiveAdmin();
  const publicCode = getPublicCode(formData);
  const internalNote = getOptionalString(formData, "internalNote");
  let redirectTo = `/admin/segnalazioni/${encodeURIComponent(publicCode)}`;
  let connection;

  try {
    connection = createDatabaseConnection();
    await new ResolveReportUseCase({
      reportRepository: new DrizzleReportRepository(connection.db)
    }).execute({ publicCode, internalNote });

    revalidateReportPaths(publicCode);
    redirectTo = `${redirectTo}?resolution=resolved`;
  } catch (error) {
    redirectTo = `${redirectTo}?resolutionError=${mapResolutionErrorToCode(error)}`;
  } finally {
    await connection?.close();
  }

  redirect(redirectTo);
}

async function moderateReport(input: { formData: FormData; action: "approve" | "reject" }): Promise<void> {
  await requireActiveAdmin();
  const publicCode = getPublicCode(input.formData);
  const note = getOptionalString(input.formData, "internalNote");
  let redirectTo = `/admin/segnalazioni/${encodeURIComponent(publicCode)}`;
  let connection;

  try {
    connection = createDatabaseConnection();
    const reportRepository = new DrizzleReportRepository(connection.db);

    if (input.action === "approve") {
      await new ApproveReportUseCase({ reportRepository }).execute({ publicCode });
      redirectTo = `${redirectTo}?moderation=approved`;
    } else {
      await new RejectReportUseCase({ reportRepository }).execute({ publicCode, internalNote: note });
      redirectTo = `${redirectTo}?moderation=rejected`;
    }

    revalidateReportPaths(publicCode);
  } catch (error) {
    redirectTo = `${redirectTo}?error=${mapModerationErrorToCode(error)}`;
  } finally {
    await connection?.close();
  }

  redirect(redirectTo);
}

function getPublicCode(formData: FormData): string {
  const value = formData.get("publicCode");

  return typeof value === "string" ? value : "";
}

function getRequiredString(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function getOptionalString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  return value;
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

function revalidateReportPaths(publicCode: string): void {
  revalidatePath("/admin");
  revalidatePath("/admin/segnalazioni");
  revalidatePath(`/admin/segnalazioni/${publicCode}`);
  revalidatePath(`/segnalazioni/${publicCode}`);
  revalidatePath("/mappa");
}

function mapModerationErrorToCode(error: unknown): string {
  if (error instanceof ReportAlreadyModeratedError) {
    return "already-moderated";
  }

  if (error instanceof ReportModerationConflictError) {
    return "conflict";
  }

  if (error instanceof ReportForModerationNotFoundError || error instanceof InvalidModerationPublicCodeError) {
    return "not-found";
  }

  console.error("Unable to moderate report", error);
  return "generic";
}

function mapResolutionErrorToCode(error: unknown): string {
  if (error instanceof ReportResolutionNotAllowedError) {
    return "not-allowed";
  }

  if (error instanceof ReportResolutionConflictError) {
    return "conflict";
  }

  if (error instanceof ReportForResolutionNotFoundError || error instanceof InvalidResolutionPublicCodeError) {
    return "not-found";
  }

  console.error("Unable to resolve report", error);
  return "generic";
}

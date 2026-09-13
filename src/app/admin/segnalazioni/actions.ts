"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ApproveReportUseCase,
  InvalidModerationPublicCodeError,
  RejectReportUseCase,
  ReportAlreadyModeratedError,
  ReportForModerationNotFoundError,
  ReportModerationConflictError
} from "@/modules/reports/application/moderate-report";
import { DrizzleReportRepository } from "@/modules/reports/infrastructure/drizzle-report-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { requireActiveAdmin } from "../admin-auth";

export async function approveReportAction(formData: FormData): Promise<void> {
  await moderateReport({ formData, action: "approve" });
}

export async function rejectReportAction(formData: FormData): Promise<void> {
  await moderateReport({ formData, action: "reject" });
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

    revalidatePath("/admin");
    revalidatePath("/admin/segnalazioni");
    revalidatePath(`/admin/segnalazioni/${publicCode}`);
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

function getOptionalString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  return value;
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

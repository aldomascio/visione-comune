"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  createReportConfirmationAntiAbuseKey,
  createReportConfirmationCookieValue,
  isValidReportConfirmationCookieValue,
  REPORT_CONFIRMATION_COOKIE_MAX_AGE_SECONDS,
  REPORT_CONFIRMATION_COOKIE_NAME
} from "@/modules/reports/application/confirmations/anti-abuse-key";
import { ConfirmReportUseCase, ReportNotConfirmableError } from "@/modules/reports/application/confirmations/report-confirmations";
import { DrizzleReportConfirmationRepository } from "@/modules/reports/infrastructure/confirmations/drizzle-report-confirmation-repository";
import { DrizzleReportRepository } from "@/modules/reports/infrastructure/drizzle-report-repository";
import { createDatabaseConnection } from "@/shared/db/client";

export type ConfirmReportActionState = {
  status: "idle" | "confirmed" | "already_confirmed" | "error";
  message?: string;
};


export async function confirmReportAction(
  publicCode: string,
  previousState: ConfirmReportActionState,
  formData: FormData
): Promise<ConfirmReportActionState> {
  void previousState;
  void formData;

  const cookieStore = await cookies();
  const existingCookieValue = cookieStore.get(REPORT_CONFIRMATION_COOKIE_NAME)?.value;
  const cookieValue = isValidReportConfirmationCookieValue(existingCookieValue)
    ? existingCookieValue
    : createReportConfirmationCookieValue();

  if (cookieValue !== existingCookieValue) {
    cookieStore.set({
      name: REPORT_CONFIRMATION_COOKIE_NAME,
      value: cookieValue,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: REPORT_CONFIRMATION_COOKIE_MAX_AGE_SECONDS
    });
  }

  const antiAbuseKey = createReportConfirmationAntiAbuseKey(cookieValue);
  let connection;

  try {
    connection = createDatabaseConnection();
    const reportRepository = new DrizzleReportRepository(connection.db);
    const confirmationRepository = new DrizzleReportConfirmationRepository(connection.db);
    const result = await new ConfirmReportUseCase({
      reportRepository,
      confirmationRepository
    }).execute({ publicCode, antiAbuseKey });

    revalidatePath(`/segnalazioni/${result.publicCode}`);

    return {
      status: result.created ? "confirmed" : "already_confirmed",
      message: result.created
        ? "Hai confermato questa segnalazione."
        : "Avevi gia confermato questa segnalazione."
    };
  } catch (error) {
    if (!(error instanceof ReportNotConfirmableError)) {
      console.error("Unable to confirm report", error);
    }

    return {
      status: "error",
      message: "Non e stato possibile confermare questa segnalazione."
    };
  } finally {
    await connection?.close();
  }
}

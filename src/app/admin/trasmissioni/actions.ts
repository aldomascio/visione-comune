"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CreateTransmissionUseCase,
  MarkTransmissionDeliveredUseCase,
  MarkTransmissionFailedUseCase,
  MarkTransmissionSentUseCase,
  mapTransmissionErrorToMessage
} from "@/modules/communications/application/transmissions";
import { DrizzleOutboundCommunicationRepository } from "@/modules/communications/infrastructure/drizzle-outbound-communication-repository";
import { DrizzleRecipientRepository } from "@/modules/recipients/infrastructure/drizzle-recipient-repository";
import { DrizzleReportRepository } from "@/modules/reports/infrastructure/drizzle-report-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { requireActiveAdmin } from "../admin-auth";

export async function createTransmissionAction(formData: FormData): Promise<void> {
  await requireActiveAdmin();
  let redirectTo = "/admin/trasmissioni/nuova";
  let connection;

  try {
    connection = createDatabaseConnection();
    const transmission = await new CreateTransmissionUseCase({
      recipientRepository: new DrizzleRecipientRepository(connection.db),
      transmissionRepository: new DrizzleOutboundCommunicationRepository(connection.db)
    }).execute({
      recipientId: getRequiredString(formData, "recipientId"),
      channel: getRequiredString(formData, "channel"),
      reportIds: formData.getAll("reportIds").flatMap((value) => typeof value === "string" ? [value] : []),
      subject: getRequiredString(formData, "subject"),
      body: getRequiredString(formData, "body")
    });

    revalidateTransmissionPaths(transmission.id);
    redirectTo = `/admin/trasmissioni/${encodeURIComponent(transmission.id)}?transmission=created`;
  } catch (error) {
    console.error("Unable to create transmission", error);
    redirectTo = `/admin/trasmissioni/nuova?error=${encodeURIComponent(mapTransmissionErrorToMessage(error))}`;
  } finally {
    await connection?.close();
  }

  redirect(redirectTo);
}

export async function markTransmissionSentAction(formData: FormData): Promise<void> {
  await updateTransmissionStatus(formData, "sent");
}

export async function markTransmissionDeliveredAction(formData: FormData): Promise<void> {
  await updateTransmissionStatus(formData, "delivered");
}

export async function markTransmissionFailedAction(formData: FormData): Promise<void> {
  await updateTransmissionStatus(formData, "failed");
}

async function updateTransmissionStatus(formData: FormData, status: "sent" | "delivered" | "failed"): Promise<void> {
  await requireActiveAdmin();
  const transmissionId = getRequiredString(formData, "transmissionId");
  let redirectTo = `/admin/trasmissioni/${encodeURIComponent(transmissionId)}`;
  let connection;

  try {
    connection = createDatabaseConnection();
    const transmissionRepository = new DrizzleOutboundCommunicationRepository(connection.db);

    if (status === "sent") {
      await new MarkTransmissionSentUseCase({ transmissionRepository }).execute({ transmissionId });
      redirectTo = `${redirectTo}?transmission=sent`;
    } else if (status === "delivered") {
      await new MarkTransmissionDeliveredUseCase({
        reportRepository: new DrizzleReportRepository(connection.db),
        transmissionRepository
      }).execute({ transmissionId });
      redirectTo = `${redirectTo}?transmission=delivered`;
    } else {
      await new MarkTransmissionFailedUseCase({ transmissionRepository }).execute({ transmissionId });
      redirectTo = `${redirectTo}?transmission=failed`;
    }

    revalidateTransmissionPaths(transmissionId);
  } catch (error) {
    console.error("Unable to update transmission", error);
    redirectTo = `${redirectTo}?error=${encodeURIComponent(mapTransmissionErrorToMessage(error))}`;
  } finally {
    await connection?.close();
  }

  redirect(redirectTo);
}

function getRequiredString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function revalidateTransmissionPaths(transmissionId: string): void {
  revalidatePath("/admin");
  revalidatePath("/admin/trasmissioni");
  revalidatePath(`/admin/trasmissioni/${transmissionId}`);
  revalidatePath("/admin/segnalazioni");
  revalidatePath("/mappa");
}

"use server";
import { CreateProposalUseCase } from "@/modules/proposals/application/manage-proposals";
import { ProposalValidationError } from "@/modules/proposals/domain";
import { DrizzleProposalRepository } from "@/modules/proposals/infrastructure/drizzle-proposal-repository";
import { createDatabaseConnection } from "@/shared/db/client";

export type ProposalActionState = { status: "idle" | "error" | "success"; message?: string; fieldErrors: Record<string, string> };
export async function createProposalAction(_: ProposalActionState, formData: FormData): Promise<ProposalActionState> {
  const input = Object.fromEntries(["title", "category", "content", "submissionMode", "contactEmail", "privacyAcknowledged"].map((key) => [key, String(formData.get(key) ?? "")]));
  let connection;
  try {
    connection = createDatabaseConnection();
    await new CreateProposalUseCase(new DrizzleProposalRepository(connection.db)).execute(input);
    return { status: "success", fieldErrors: {} };
  } catch (error) {
    if (!(error instanceof ProposalValidationError)) console.error("Unable to create proposal", error);
    return { status: "error", message: error instanceof ProposalValidationError ? "Controlla i campi evidenziati." : "Non è stato possibile inviare la proposta.", fieldErrors: error instanceof ProposalValidationError ? error.fieldErrors : {} };
  } finally { await connection?.close(); }
}

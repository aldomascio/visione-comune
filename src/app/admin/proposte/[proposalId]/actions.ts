"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UpdateProposalStatusUseCase } from "@/modules/proposals/application/manage-proposals";
import { DrizzleProposalRepository } from "@/modules/proposals/infrastructure/drizzle-proposal-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { requireActiveAdmin } from "../../admin-auth";
export async function updateProposalStatusAction(formData: FormData) {
  await requireActiveAdmin(); const id=String(formData.get("id")??""); const status=String(formData.get("status")??""); const connection=createDatabaseConnection();
  try { await new UpdateProposalStatusUseCase(new DrizzleProposalRepository(connection.db)).execute(id,status); } finally { await connection.close(); }
  revalidatePath("/admin/proposte"); revalidatePath(`/admin/proposte/${id}`); redirect(`/admin/proposte/${id}?updated=1`);
}


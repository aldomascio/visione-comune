import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { DrizzleAdminUserRepository } from "@/modules/admin/infrastructure/drizzle-admin-user-repository";
import { createDatabaseConnection } from "@/shared/db/client";

export async function requireActiveAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/admin/login");
  }

  let connection;

  try {
    connection = createDatabaseConnection();
    const activeAdmin = await new DrizzleAdminUserRepository(connection.db).findActiveById(
      session.user.id
    );

    if (!activeAdmin) {
      redirect("/admin/login");
    }

    return activeAdmin;
  } finally {
    await connection?.close();
  }
}

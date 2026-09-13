import { auth } from "../../../auth";
import { DrizzleAdminUserRepository } from "@/modules/admin/infrastructure/drizzle-admin-user-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { AdminShell } from "@/shared/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const activeAdmin = await getActiveAdminFromSession();

  if (!activeAdmin) {
    return children;
  }

  return <AdminShell activeAdminEmail={activeAdmin.email}>{children}</AdminShell>;
}

async function getActiveAdminFromSession() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  let connection;

  try {
    connection = createDatabaseConnection();
    return await new DrizzleAdminUserRepository(connection.db).findActiveById(session.user.id);
  } finally {
    await connection?.close();
  }
}

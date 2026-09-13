import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { DrizzleAdminUserRepository } from "@/modules/admin/infrastructure/drizzle-admin-user-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";
import { adminLogoutAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/admin/login");
  }

  const activeAdmin = await getActiveAdmin(session.user.id);

  if (!activeAdmin) {
    redirect("/admin/login");
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-4xl gap-8">
        <section className="grid gap-3">
          <p className="text-sm font-semibold text-primary">Backoffice</p>
          <h1 className="font-serif text-4xl font-semibold tracking-normal">Area amministrativa</h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            Questa area e protetta. Le funzionalita di moderazione saranno implementate nelle prossime vertical slice.
          </p>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Sessione amministratore</CardTitle>
            <CardDescription>Accesso autenticato come amministratore attivo.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="mt-1 font-medium">{activeAdmin.email}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
              Placeholder backoffice: elenco segnalazioni, moderazione e pubblicazione non sono ancora implementati.
            </div>
            <form action={adminLogoutAction}>
              <Button type="submit" variant="secondary">
                Esci
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

async function getActiveAdmin(adminUserId: string) {
  let connection;

  try {
    connection = createDatabaseConnection();
    return await new DrizzleAdminUserRepository(connection.db).findActiveById(adminUserId);
  } finally {
    await connection?.close();
  }
}

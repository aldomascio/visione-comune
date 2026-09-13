import { redirect } from "next/navigation";
import { auth } from "../../../../auth";
import { AdminLoginForm } from "./login-form";

export default async function AdminLoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/admin");
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <div className="grid gap-2 text-center">
          <p className="text-sm font-semibold text-primary">Visione Comune</p>
          <h1 className="font-serif text-4xl font-semibold tracking-normal">Backoffice</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Nessuna registrazione pubblica: l&apos;accesso e riservato agli amministratori creati manualmente.
          </p>
        </div>
        <AdminLoginForm />
      </div>
    </main>
  );
}

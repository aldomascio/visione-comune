import { GetPublicContactSettingsUseCase } from "@/modules/site-settings/application/manage-public-contact-settings";
import { DrizzlePublicContactSettingsRepository } from "@/modules/site-settings/infrastructure/drizzle-public-contact-settings-repository";
import { readEnvironmentPublicContactSettings } from "@/shared/config/public-contact";
import { createDatabaseConnection } from "@/shared/db/client";
import { requireActiveAdmin } from "../admin-auth";
import { updatePublicContactSettingsAction } from "./actions";
import { createPublicContactSettingsActionState } from "./form-state";
import { PublicContactSettingsForm } from "./settings-form";

type AdminSettingsPageProps = {
  searchParams?: Promise<{ updated?: string }>;
};

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({ searchParams }: AdminSettingsPageProps) {
  await requireActiveAdmin();
  const query = await searchParams;
  const settings = await getSettings();

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <section className="grid gap-3">
          <p className="text-sm font-semibold text-primary">Backoffice</p>
          <h1 className="font-serif text-4xl font-semibold tracking-normal">Impostazioni</h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            Configura i contatti mostrati nelle aree pubbliche del sito.
          </p>
        </section>

        {query?.updated ? (
          <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success" role="status">
            Impostazioni salvate.
          </div>
        ) : null}

        <PublicContactSettingsForm
          action={updatePublicContactSettingsAction}
          initialState={createPublicContactSettingsActionState(settings)}
        />
      </div>
    </main>
  );
}

async function getSettings() {
  let connection;

  try {
    connection = createDatabaseConnection();
    const stored = await new GetPublicContactSettingsUseCase(
      new DrizzlePublicContactSettingsRepository(connection.db)
    ).execute();
    return stored ?? readEnvironmentPublicContactSettings();
  } finally {
    await connection?.close();
  }
}

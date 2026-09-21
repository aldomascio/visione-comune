import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UpdatePublicContactSettingsUseCase } from "@/modules/site-settings/application/manage-public-contact-settings";
import type { StoredPublicContactSettings } from "@/modules/site-settings/application/public-contact-settings-repository";
import { DrizzlePublicContactSettingsRepository } from "@/modules/site-settings/infrastructure/drizzle-public-contact-settings-repository";
import { createDatabaseConnection, type DatabaseConnection } from "@/shared/db/client";
import { sitePublicSettings } from "@/shared/db/schema";

const maybeDescribe = process.env.TEST_DATABASE_URL ? describe : describe.skip;

maybeDescribe("DrizzlePublicContactSettingsRepository", () => {
  let connection: DatabaseConnection;
  let repository: DrizzlePublicContactSettingsRepository;
  let originalSettings: StoredPublicContactSettings | null;

  beforeAll(async () => {
    connection = createDatabaseConnection(process.env.TEST_DATABASE_URL);
    await migrate(connection.db, { migrationsFolder: "drizzle" });
    repository = new DrizzlePublicContactSettingsRepository(connection.db);
    originalSettings = await repository.get();
    await connection.db.delete(sitePublicSettings);
  });

  afterAll(async () => {
    if (!connection) return;
    await connection.db.delete(sitePublicSettings);
    if (originalSettings) await repository.save(originalSettings);
    await connection.close();
  });

  it("creates and updates the singleton public contact settings", async () => {
    const useCase = new UpdatePublicContactSettingsUseCase(
      repository,
      () => new Date("2026-09-21T10:00:00.000Z")
    );

    await useCase.execute({
      facebookUrl: "https://www.facebook.com/visionecomune",
      instagramUrl: null,
      tiktokUrl: null,
      contactEmail: "info@visionecomune.it"
    });
    await useCase.execute({
      facebookUrl: null,
      instagramUrl: "https://www.instagram.com/visionecomune",
      tiktokUrl: null,
      contactEmail: "contatti@visionecomune.it"
    });

    await expect(repository.get()).resolves.toEqual({
      facebookUrl: null,
      instagramUrl: "https://www.instagram.com/visionecomune",
      tiktokUrl: null,
      contactEmail: "contatti@visionecomune.it",
      updatedAt: new Date("2026-09-21T10:00:00.000Z")
    });
    await expect(connection.db.select().from(sitePublicSettings)).resolves.toHaveLength(1);
  });
});

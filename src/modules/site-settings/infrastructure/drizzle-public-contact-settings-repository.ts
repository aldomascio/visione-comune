import { eq } from "drizzle-orm";
import type { Database } from "@/shared/db/client";
import { sitePublicSettings } from "@/shared/db/schema";
import {
  PUBLIC_CONTACT_SETTINGS_ID,
  type PublicContactSettingsRepository,
  type StoredPublicContactSettings
} from "../application/public-contact-settings-repository";

export class DrizzlePublicContactSettingsRepository implements PublicContactSettingsRepository {
  constructor(private readonly db: Database) {}

  async get(): Promise<StoredPublicContactSettings | null> {
    const [settings] = await this.db
      .select()
      .from(sitePublicSettings)
      .where(eq(sitePublicSettings.id, PUBLIC_CONTACT_SETTINGS_ID))
      .limit(1);

    return settings ? mapSettings(settings) : null;
  }

  async save(settings: StoredPublicContactSettings): Promise<StoredPublicContactSettings> {
    const [saved] = await this.db
      .insert(sitePublicSettings)
      .values({ id: PUBLIC_CONTACT_SETTINGS_ID, ...settings })
      .onConflictDoUpdate({
        target: sitePublicSettings.id,
        set: settings
      })
      .returning();

    if (!saved) throw new Error("Public contact settings upsert did not return a row.");
    return mapSettings(saved);
  }
}

function mapSettings(settings: typeof sitePublicSettings.$inferSelect): StoredPublicContactSettings {
  return {
    facebookUrl: settings.facebookUrl,
    instagramUrl: settings.instagramUrl,
    tiktokUrl: settings.tiktokUrl,
    contactEmail: settings.contactEmail,
    updatedAt: settings.updatedAt
  };
}

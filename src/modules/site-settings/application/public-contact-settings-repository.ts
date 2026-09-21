export const PUBLIC_CONTACT_SETTINGS_ID = "public-contact";

export type PublicContactSettings = {
  facebookUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  contactEmail: string | null;
};

export type StoredPublicContactSettings = PublicContactSettings & {
  updatedAt: Date;
};

export type PublicContactSettingsRepository = {
  get(): Promise<StoredPublicContactSettings | null>;
  save(settings: PublicContactSettings & { updatedAt: Date }): Promise<StoredPublicContactSettings>;
};

import type { PublicContactSettings } from "@/modules/site-settings/application/public-contact-settings-repository";

export type PublicContactSettingsFormValues = Record<keyof PublicContactSettings, string>;

export type PublicContactSettingsActionState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors: Partial<Record<keyof PublicContactSettingsFormValues, string>>;
  values: PublicContactSettingsFormValues;
};

export function createPublicContactSettingsActionState(
  settings: PublicContactSettings
): PublicContactSettingsActionState {
  return {
    status: "idle",
    fieldErrors: {},
    values: {
      facebookUrl: settings.facebookUrl ?? "",
      instagramUrl: settings.instagramUrl ?? "",
      tiktokUrl: settings.tiktokUrl ?? "",
      contactEmail: settings.contactEmail ?? ""
    }
  };
}

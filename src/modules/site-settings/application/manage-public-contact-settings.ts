import type {
  PublicContactSettings,
  PublicContactSettingsRepository,
  StoredPublicContactSettings
} from "./public-contact-settings-repository";

export type PublicContactSettingsFieldErrors = Partial<Record<keyof PublicContactSettings, string>>;

export class PublicContactSettingsValidationError extends Error {
  constructor(readonly fieldErrors: PublicContactSettingsFieldErrors) {
    super("Public contact settings validation failed.");
    this.name = "PublicContactSettingsValidationError";
  }
}

export class GetPublicContactSettingsUseCase {
  constructor(private readonly repository: PublicContactSettingsRepository) {}

  execute(): Promise<StoredPublicContactSettings | null> {
    return this.repository.get();
  }
}

export class UpdatePublicContactSettingsUseCase {
  constructor(
    private readonly repository: PublicContactSettingsRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  execute(input: PublicContactSettings): Promise<StoredPublicContactSettings> {
    return this.repository.save({ ...validatePublicContactSettings(input), updatedAt: this.now() });
  }
}

export function validatePublicContactSettings(input: PublicContactSettings): PublicContactSettings {
  const values = {
    facebookUrl: normalizeOptionalValue(input.facebookUrl),
    instagramUrl: normalizeOptionalValue(input.instagramUrl),
    tiktokUrl: normalizeOptionalValue(input.tiktokUrl),
    contactEmail: normalizeOptionalValue(input.contactEmail)?.toLowerCase() ?? null
  };
  const fieldErrors: PublicContactSettingsFieldErrors = {};

  validateOptionalHttpsUrl(values.facebookUrl, "facebookUrl", fieldErrors);
  validateOptionalHttpsUrl(values.instagramUrl, "instagramUrl", fieldErrors);
  validateOptionalHttpsUrl(values.tiktokUrl, "tiktokUrl", fieldErrors);

  if (values.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail)) {
    fieldErrors.contactEmail = "Inserisci un indirizzo email valido.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new PublicContactSettingsValidationError(fieldErrors);
  }

  return values;
}

function validateOptionalHttpsUrl(
  value: string | null,
  field: keyof Pick<PublicContactSettings, "facebookUrl" | "instagramUrl" | "tiktokUrl">,
  fieldErrors: PublicContactSettingsFieldErrors
) {
  if (!value) return;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") throw new Error("Invalid protocol");
  } catch {
    fieldErrors[field] = "Inserisci un URL completo che inizi con https://.";
  }
}

function normalizeOptionalValue(value: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

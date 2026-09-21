import { describe, expect, it } from "vitest";
import type {
  PublicContactSettings,
  PublicContactSettingsRepository,
  StoredPublicContactSettings
} from "./public-contact-settings-repository";
import { PublicContactSettingsValidationError, UpdatePublicContactSettingsUseCase } from "./manage-public-contact-settings";

class MemoryPublicContactSettingsRepository implements PublicContactSettingsRepository {
  stored: StoredPublicContactSettings | null = null;

  async get() {
    return this.stored;
  }

  async save(settings: PublicContactSettings & { updatedAt: Date }) {
    this.stored = settings;
    return settings;
  }
}

describe("UpdatePublicContactSettingsUseCase", () => {
  it("normalizes and persists configured contacts", async () => {
    const repository = new MemoryPublicContactSettingsRepository();
    const updatedAt = new Date("2026-09-21T10:00:00.000Z");
    const result = await new UpdatePublicContactSettingsUseCase(repository, () => updatedAt).execute({
      facebookUrl: " https://www.facebook.com/visionecomune ",
      instagramUrl: null,
      tiktokUrl: "",
      contactEmail: " Info@VisioneComune.it "
    });

    expect(result).toEqual({
      facebookUrl: "https://www.facebook.com/visionecomune",
      instagramUrl: null,
      tiktokUrl: null,
      contactEmail: "info@visionecomune.it",
      updatedAt
    });
    expect(repository.stored).toEqual(result);
  });

  it("rejects non-HTTPS social links", async () => {
    const useCase = new UpdatePublicContactSettingsUseCase(new MemoryPublicContactSettingsRepository());

    expect(() => useCase.execute({
      facebookUrl: "http://www.facebook.com/visionecomune",
      instagramUrl: null,
      tiktokUrl: null,
      contactEmail: null
    })).toThrowError(expect.objectContaining<Partial<PublicContactSettingsValidationError>>({
      fieldErrors: { facebookUrl: expect.any(String) }
    }));
  });

  it("rejects an invalid public email", async () => {
    const useCase = new UpdatePublicContactSettingsUseCase(new MemoryPublicContactSettingsRepository());

    expect(() => useCase.execute({
      facebookUrl: null,
      instagramUrl: null,
      tiktokUrl: null,
      contactEmail: "not-an-email"
    })).toThrowError(expect.objectContaining<Partial<PublicContactSettingsValidationError>>({
      fieldErrors: { contactEmail: expect.any(String) }
    }));
  });

  it("allows every optional contact to be removed", async () => {
    const result = await new UpdatePublicContactSettingsUseCase(
      new MemoryPublicContactSettingsRepository()
    ).execute({ facebookUrl: "", instagramUrl: "", tiktokUrl: "", contactEmail: "" });

    expect(result).toEqual(expect.objectContaining({
      facebookUrl: null,
      instagramUrl: null,
      tiktokUrl: null,
      contactEmail: null
    }));
  });
});

export type PublicContactKind = "facebook" | "instagram" | "tiktok" | "email";

export type PublicContactLink = {
  kind: PublicContactKind;
  label: string;
  href: string;
  external: boolean;
};

export function readEnvironmentPublicContactSettings(): PublicContactSettings {
  return {
    facebookUrl: normalizeOptionalValue(process.env.NEXT_PUBLIC_FACEBOOK_URL),
    instagramUrl: normalizeOptionalValue(process.env.NEXT_PUBLIC_INSTAGRAM_URL),
    tiktokUrl: normalizeOptionalValue(process.env.NEXT_PUBLIC_TIKTOK_URL),
    contactEmail: normalizeOptionalValue(process.env.NEXT_PUBLIC_CONTACT_EMAIL)
  };
}

export function buildPublicContactLinks(settings: PublicContactSettings): PublicContactLink[] {
  const links: Array<PublicContactLink | null> = [
    createSocialLink("facebook", "Facebook", settings.facebookUrl),
    createSocialLink("instagram", "Instagram", settings.instagramUrl),
    createSocialLink("tiktok", "TikTok", settings.tiktokUrl),
    createEmailLink(settings.contactEmail)
  ];

  return links.filter((link): link is PublicContactLink => link !== null);
}

function createSocialLink(kind: PublicContactKind, label: string, value: string | null): PublicContactLink | null {
  const href = normalizeHttpsUrl(value);
  return href ? { kind, label, href, external: true } : null;
}

function createEmailLink(value: string | null): PublicContactLink | null {
  const email = value?.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }

  return { kind: "email", label: "Email", href: `mailto:${email}`, external: false };
}

function normalizeHttpsUrl(value: string | null): string | null {
  const candidate = value?.trim();

  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeOptionalValue(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
import type { PublicContactSettings } from "@/modules/site-settings/application/public-contact-settings-repository";

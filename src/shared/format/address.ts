export function formatStreetAddress(address?: string | null): string {
  const normalized = address?.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return "Luogo non indicato";
  }

  const [streetAddress] = normalized.split(",").map((part) => part.trim()).filter(Boolean);
  const shortened = streetAddress || normalized;

  return shortened
    .replace(/\bVenafro\b/gi, "")
    .replace(/\bMolise\b/gi, "")
    .replace(/\bItalia\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,+$/g, "")
    .trim() || shortened;
}

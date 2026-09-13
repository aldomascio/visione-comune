export const PUBLIC_REPORT_STATUSES = [
  "reported",
  "communicated",
  "resolved"
] as const;

export type PublicReportStatus = (typeof PUBLIC_REPORT_STATUSES)[number];

export const MODERATION_STATUSES = [
  "pending_review",
  "approved",
  "rejected"
] as const;

export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const PUBLIC_REPORT_STATUS_LABELS = {
  reported: "Segnalata",
  communicated: "Comunicata",
  resolved: "Risolta"
} as const satisfies Record<PublicReportStatus, string>;

export const MODERATION_STATUS_LABELS = {
  pending_review: "Da verificare",
  approved: "Approvata",
  rejected: "Rifiutata"
} as const satisfies Record<ModerationStatus, string>;


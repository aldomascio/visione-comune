export const REPORT_SOURCES = ["platform", "social", "email", "direct", "other"] as const;

export type ReportSource = (typeof REPORT_SOURCES)[number];

export const REPORT_SOURCE_LABELS = {
  platform: "Piattaforma",
  social: "Social",
  email: "Email",
  direct: "Segnalazione diretta",
  other: "Altro"
} as const satisfies Record<ReportSource, string>;

export function isReportSource(value: string): value is ReportSource {
  return (REPORT_SOURCES as readonly string[]).includes(value);
}

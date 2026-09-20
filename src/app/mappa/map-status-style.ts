import type { PublicReportStatus } from "@/modules/reports/domain";

export type MapStatusBadgeStyle = {
  label: "Segnalata" | "Comunicata" | "Risolta";
  badgeClassName: string;
};

export const MAP_STATUS_BADGE_STYLES: Record<PublicReportStatus, MapStatusBadgeStyle> = {
  reported: {
    label: "Segnalata",
    badgeClassName: "border-primary bg-primary text-primary-foreground"
  },
  communicated: {
    label: "Comunicata",
    badgeClassName: "border-border bg-accent text-accent-foreground"
  },
  resolved: {
    label: "Risolta",
    badgeClassName: "border-primary bg-background text-primary"
  }
};

export function getMapStatusBadgeStyle(status: PublicReportStatus): MapStatusBadgeStyle {
  return MAP_STATUS_BADGE_STYLES[status];
}

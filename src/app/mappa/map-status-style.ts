import type { PublicReportStatus } from "@/modules/reports/domain";

export type MapStatusBadgeStyle = {
  label: "Segnalata" | "Comunicata" | "Risolta";
  badgeClassName: string;
};

export const MAP_STATUS_BADGE_STYLES: Record<PublicReportStatus, MapStatusBadgeStyle> = {
  reported: {
    label: "Segnalata",
    badgeClassName: "border-info/20 bg-info/10 text-info"
  },
  communicated: {
    label: "Comunicata",
    badgeClassName: "border-info/20 bg-info/10 text-info"
  },
  resolved: {
    label: "Risolta",
    badgeClassName: "border-success/20 bg-success/10 text-success"
  }
};

export function getMapStatusBadgeStyle(status: PublicReportStatus): MapStatusBadgeStyle {
  return MAP_STATUS_BADGE_STYLES[status];
}

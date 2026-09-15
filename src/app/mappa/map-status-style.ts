import type { PublicReportStatus } from "@/modules/reports/domain";

export type MapCategoryStyle = {
  markerClassName: string;
  listAccentClassName: string;
  tokens: {
    background: string;
    foreground: string;
    border: string;
  };
};

export type MapStatusBadgeStyle = {
  label: "Segnalata" | "Comunicata" | "Risolta";
  badgeClassName: string;
};

const CATEGORY_STYLES: MapCategoryStyle[] = [
  {
    markerClassName: "public-map-marker public-map-marker--category-primary",
    listAccentClassName: "border-l-primary",
    tokens: { background: "primary", foreground: "primary-foreground", border: "background" }
  },
  {
    markerClassName: "public-map-marker public-map-marker--category-foreground",
    listAccentClassName: "border-l-foreground",
    tokens: { background: "foreground", foreground: "background", border: "background" }
  },
  {
    markerClassName: "public-map-marker public-map-marker--category-accent",
    listAccentClassName: "border-l-accent-foreground",
    tokens: { background: "accent", foreground: "accent-foreground", border: "background" }
  },
  {
    markerClassName: "public-map-marker public-map-marker--category-muted",
    listAccentClassName: "border-l-muted-foreground",
    tokens: { background: "muted", foreground: "foreground", border: "foreground" }
  }
];

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

export function getMapCategoryStyle(categoryName: string, categories: string[]): MapCategoryStyle {
  const index = Math.max(0, categories.indexOf(categoryName));
  return CATEGORY_STYLES[index % CATEGORY_STYLES.length] ?? CATEGORY_STYLES[0]!;
}

export function getMapStatusBadgeStyle(status: PublicReportStatus): MapStatusBadgeStyle {
  return MAP_STATUS_BADGE_STYLES[status];
}

export function getMapCategoryStyleTokens(): MapCategoryStyle[] {
  return CATEGORY_STYLES;
}

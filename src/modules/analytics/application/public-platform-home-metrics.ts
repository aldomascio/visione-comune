import type { PublicPlatformMetrics } from "./operational-metrics";

export type HomePublicMetricCard = {
  key: "published" | "communicated" | "resolved" | "totalConfirmations" | "resolutionRate";
  label: string;
  value: string;
  hint: string;
};

export function buildHomePublicMetricCards(metrics: PublicPlatformMetrics): HomePublicMetricCard[] {
  return [
    {
      key: "published",
      label: "Segnalazioni pubblicate",
      value: formatInteger(metrics.published),
      hint: "Problemi verificati e visibili pubblicamente."
    },
    {
      key: "communicated",
      label: "Comunicate agli enti",
      value: formatInteger(metrics.communicated),
      hint: "Segnalazioni comunicate o già risolte."
    },
    {
      key: "resolved",
      label: "Problemi risolti",
      value: formatInteger(metrics.resolved),
      hint: "Risoluzioni verificate da Visione Comune."
    },
    {
      key: "totalConfirmations",
      label: "Conferme ricevute",
      value: formatInteger(metrics.totalConfirmations),
      hint: "Conferme aggregate, senza dati personali pubblici."
    },
    {
      key: "resolutionRate",
      label: "Tasso di risoluzione",
      value: formatResolutionRate(metrics.resolutionRatePercentage),
      hint: "Quota di segnalazioni pubblicate che risultano risolte."
    }
  ];
}

export function formatResolutionRate(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return `${formatIntegerOrDecimal(value)}%`;
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 }).format(value);
}

function formatIntegerOrDecimal(value: number): string {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(value);
}

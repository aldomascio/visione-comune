import type { OutboundCommunicationStatus } from "@/modules/communications/application/communication-repository";

export const TRANSMISSION_STATUS_LABELS: Record<OutboundCommunicationStatus, string> = {
  draft: "Bozza",
  sent: "Inviata",
  delivered: "Consegnata",
  failed: "Fallita"
};

export function transmissionStatusLabel(status: OutboundCommunicationStatus): string {
  return TRANSMISSION_STATUS_LABELS[status];
}

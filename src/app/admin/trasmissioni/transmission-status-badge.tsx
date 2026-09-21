import type { OutboundCommunicationStatus } from "@/modules/communications/application/communication-repository";
import { Badge } from "@/shared/ui";
import { transmissionStatusLabel } from "./status";

export function TransmissionStatusBadge({ status }: { status: OutboundCommunicationStatus }) {
  const variant = status === "delivered"
    ? "success"
    : status === "failed"
      ? "danger"
      : status === "sent"
        ? "info"
        : "warning";

  return <Badge variant={variant}>{transmissionStatusLabel(status)}</Badge>;
}

import { Badge } from "@/shared/ui";
import {
  MODERATION_STATUS_LABELS,
  PUBLIC_REPORT_STATUS_LABELS,
  type ModerationStatus,
  type PublicReportStatus
} from "@/modules/reports/domain";

export function ModerationStatusBadge({ status }: { status: ModerationStatus }) {
  const variant = status === "pending_review" ? "warning" : status === "approved" ? "success" : "danger";

  return <Badge variant={variant}>{MODERATION_STATUS_LABELS[status]}</Badge>;
}

export function PublicStatusBadge({ status }: { status?: PublicReportStatus }) {
  if (!status) {
    return <Badge variant="muted">Non pubblica</Badge>;
  }

  const variant = status === "resolved" ? "success" : "info";

  return <Badge variant={variant}>{PUBLIC_REPORT_STATUS_LABELS[status]}</Badge>;
}

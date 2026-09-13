import { createHash, randomUUID } from "node:crypto";

export const REPORT_CONFIRMATION_COOKIE_NAME = "vc_report_confirmation_id";
export const REPORT_CONFIRMATION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export function createReportConfirmationCookieValue(): string {
  return randomUUID();
}

export function isValidReportConfirmationCookieValue(value: string | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

export function createReportConfirmationAntiAbuseKey(cookieValue: string): string {
  return createHash("sha256").update(cookieValue).digest("hex");
}

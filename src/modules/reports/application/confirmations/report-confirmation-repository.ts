export class DuplicateReportConfirmationError extends Error {
  constructor(readonly reportId: string, readonly antiAbuseKey: string) {
    super(`Report already confirmed for this anti-abuse key: ${reportId}`);
    this.name = "DuplicateReportConfirmationError";
  }
}

export type ReportConfirmation = {
  id: string;
  reportId: string;
  antiAbuseKey: string;
  createdAt: Date;
};

export type ReportConfirmationRepository = {
  create(input: ReportConfirmation): Promise<"created" | "already_exists">;
  exists(input: { reportId: string; antiAbuseKey: string }): Promise<boolean>;
  countByReportId(reportId: string): Promise<number>;
};

import { PUBLIC_REPORT_STATUS_LABELS, type PublicReportStatus } from "../domain";
import type { PublicReportMapItem, ReportRepository } from "./report-repository";

export type PublicReportMapView = PublicReportMapItem & {
  publicStatusLabel: string;
};

export type ListPublicReportsForMapUseCaseDependencies = {
  reportRepository: ReportRepository;
};

export class ListPublicReportsForMapUseCase {
  constructor(private readonly dependencies: ListPublicReportsForMapUseCaseDependencies) {}

  async execute(): Promise<PublicReportMapView[]> {
    const reports = await this.dependencies.reportRepository.listPublicForMap();

    return reports.map((report) => ({
      ...report,
      publicStatusLabel: getPublicStatusLabel(report.publicStatus)
    }));
  }
}

export function getPublicStatusLabel(status: PublicReportStatus): string {
  return PUBLIC_REPORT_STATUS_LABELS[status];
}

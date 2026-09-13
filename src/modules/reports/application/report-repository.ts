import type { Report, ReportDomainEvent, PublicCode } from "../domain";

export class DuplicatePublicCodePersistenceError extends Error {
  constructor(publicCode: string) {
    super(`Report public code already exists: ${publicCode}`);
    this.name = "DuplicatePublicCodePersistenceError";
  }
}

export type ReportRepository = {
  save(report: Report, events?: ReportDomainEvent[]): Promise<void>;
  findByPublicCode(publicCode: PublicCode): Promise<Report | null>;
};


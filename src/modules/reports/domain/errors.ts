export class ReportDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidReportTransitionError extends ReportDomainError {}

export class InvalidPublicCodeError extends ReportDomainError {}

export class InvalidLocationError extends ReportDomainError {}

export class InconsistentReportStateError extends ReportDomainError {}

export class InvalidReportDataError extends ReportDomainError {}


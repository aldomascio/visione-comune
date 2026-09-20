import { randomUUID } from "node:crypto";
import { PROPOSAL_STATUSES, ProposalValidationError, type ProposalStatus, validateProposalInput } from "../domain";
import type { ProposalRepository } from "./proposal-repository";

export class ProposalNotFoundError extends Error {}

export class CreateProposalUseCase {
  constructor(private readonly repository: ProposalRepository, private readonly createId: () => string = randomUUID, private readonly now = () => new Date()) {}
  execute(input: Record<string, string>) {
    const values = validateProposalInput(input);
    const now = this.now();
    return this.repository.create({ id: this.createId(), ...values, status: "new", createdAt: now, updatedAt: now });
  }
}
export class ListProposalsUseCase { constructor(private readonly repository: ProposalRepository) {} execute() { return this.repository.list(); } }
export class GetProposalUseCase {
  constructor(private readonly repository: ProposalRepository) {}
  async execute(id: string) { const proposal = await this.repository.findById(id); if (!proposal) throw new ProposalNotFoundError(); return proposal; }
}
export class UpdateProposalStatusUseCase {
  constructor(private readonly repository: ProposalRepository, private readonly now = () => new Date()) {}
  async execute(id: string, status: string) {
    if (!PROPOSAL_STATUSES.includes(status as ProposalStatus)) throw new ProposalValidationError({ status: "Seleziona uno stato valido." });
    const proposal = await this.repository.updateStatus(id, status as ProposalStatus, this.now());
    if (!proposal) throw new ProposalNotFoundError();
    return proposal;
  }
}

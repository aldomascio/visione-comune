import type { Proposal, ProposalStatus } from "../domain";
export interface ProposalRepository {
  create(proposal: Proposal): Promise<Proposal>;
  list(): Promise<Proposal[]>;
  findById(id: string): Promise<Proposal | null>;
  updateStatus(id: string, status: ProposalStatus, updatedAt: Date): Promise<Proposal | null>;
}


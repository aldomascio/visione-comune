import { desc, eq } from "drizzle-orm";
import type { Database } from "@/shared/db/client";
import { proposals } from "@/shared/db/schema";
import type { ProposalRepository } from "../application/proposal-repository";
import type { Proposal, ProposalStatus } from "../domain";

export class DrizzleProposalRepository implements ProposalRepository {
  constructor(private readonly db: Database) {}
  async create(proposal: Proposal) { const [row] = await this.db.insert(proposals).values(proposal).returning(); return row as Proposal; }
  async list() { return (await this.db.select().from(proposals).orderBy(desc(proposals.createdAt))) as Proposal[]; }
  async findById(id: string) { const [row] = await this.db.select().from(proposals).where(eq(proposals.id, id)).limit(1); return (row as Proposal | undefined) ?? null; }
  async updateStatus(id: string, status: ProposalStatus, updatedAt: Date) {
    const [row] = await this.db.update(proposals).set({ status, updatedAt }).where(eq(proposals.id, id)).returning();
    return (row as Proposal | undefined) ?? null;
  }
}

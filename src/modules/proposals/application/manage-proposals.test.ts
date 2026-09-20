import { describe, expect, it } from "vitest";
import { CreateProposalUseCase, UpdateProposalStatusUseCase } from "./manage-proposals";
import type { ProposalRepository } from "./proposal-repository";
import type { Proposal, ProposalStatus } from "../domain";

class MemoryRepository implements ProposalRepository {
  items: Proposal[]=[];
  async create(value:Proposal){this.items.push(value);return value}
  async list(){return this.items}
  async findById(id:string){return this.items.find(item=>item.id===id)??null}
  async updateStatus(id:string,status:ProposalStatus,updatedAt:Date){const item=await this.findById(id);if(!item)return null;item.status=status;item.updatedAt=updatedAt;return item}
}
const base={title:"Un nuovo spazio civico",category:"public_spaces",content:"Uno spazio condiviso per attività e incontri.",submissionMode:"anonymous",contactEmail:"",privacyAcknowledged:"accepted"};
describe("proposals",()=>{
  it("creates a valid anonymous proposal without retaining an email",async()=>{const repo=new MemoryRepository();const result=await new CreateProposalUseCase(repo,()=>"proposal-1").execute({...base,contactEmail:"person@example.it"});expect(result.contactEmail).toBeNull();expect(result.status).toBe("new")});
  it("creates a valid contact proposal",async()=>{const repo=new MemoryRepository();const result=await new CreateProposalUseCase(repo).execute({...base,submissionMode:"contact",contactEmail:"Person@Example.it"});expect(result.contactEmail).toBe("person@example.it")});
  it("rejects contact mode without an email",()=>{expect(()=>new CreateProposalUseCase(new MemoryRepository()).execute({...base,submissionMode:"contact"})).toThrowError(expect.objectContaining({fieldErrors:{contactEmail:expect.any(String)}}))});
  it("rejects an invalid email",()=>{expect(()=>new CreateProposalUseCase(new MemoryRepository()).execute({...base,submissionMode:"contact",contactEmail:"wrong"})).toThrowError(expect.objectContaining({fieldErrors:{contactEmail:expect.any(String)}}))});
  it("rejects a proposal without privacy acknowledgement",()=>{expect(()=>new CreateProposalUseCase(new MemoryRepository()).execute({...base,privacyAcknowledged:""})).toThrowError(expect.objectContaining({fieldErrors:{privacyAcknowledged:expect.any(String)}}))});
  it("changes the internal status",async()=>{const repo=new MemoryRepository();const created=await new CreateProposalUseCase(repo,()=>"proposal-1").execute(base);const updated=await new UpdateProposalStatusUseCase(repo).execute(created.id,"reviewing");expect(updated.status).toBe("reviewing")});
});

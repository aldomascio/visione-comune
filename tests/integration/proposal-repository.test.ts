import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CreateProposalUseCase, UpdateProposalStatusUseCase } from "@/modules/proposals/application/manage-proposals";
import { DrizzleProposalRepository } from "@/modules/proposals/infrastructure/drizzle-proposal-repository";
import { createDatabaseConnection, type DatabaseConnection } from "@/shared/db/client";
import { proposals } from "@/shared/db/schema";

const maybeDescribe=process.env.TEST_DATABASE_URL?describe:describe.skip;
maybeDescribe("proposal persistence",()=>{
 let connection:DatabaseConnection; let repository:DrizzleProposalRepository;
 beforeAll(async()=>{connection=createDatabaseConnection(process.env.TEST_DATABASE_URL);await migrate(connection.db,{migrationsFolder:"drizzle"});repository=new DrizzleProposalRepository(connection.db)});
 beforeEach(async()=>{await connection.db.delete(proposals).where(eq(proposals.id,"test-proposal"))});
 afterAll(async()=>{if(connection){await connection.db.delete(proposals).where(eq(proposals.id,"test-proposal"));await connection.close()}});
 it("persists private contact data and updates the internal status",async()=>{
  const created=await new CreateProposalUseCase(repository,()=>"test-proposal",()=>new Date("2026-09-20T10:00:00Z")).execute({title:"Idea di test",category:"culture",content:"Una proposta completa per il territorio.",submissionMode:"contact",contactEmail:"persona@example.it",privacyAcknowledged:"accepted"});
  expect(await repository.findById(created.id)).toMatchObject({contactEmail:"persona@example.it",status:"new"});
  await new UpdateProposalStatusUseCase(repository).execute(created.id,"reviewing");
  expect(await repository.findById(created.id)).toMatchObject({status:"reviewing"});
 });
});

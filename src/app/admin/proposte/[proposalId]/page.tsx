import { notFound } from "next/navigation";
import { GetProposalUseCase, ProposalNotFoundError } from "@/modules/proposals/application/manage-proposals";
import { PROPOSAL_CATEGORY_LABELS, PROPOSAL_STATUSES, PROPOSAL_STATUS_LABELS } from "@/modules/proposals/domain";
import { DrizzleProposalRepository } from "@/modules/proposals/infrastructure/drizzle-proposal-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/shared/ui";
import { requireActiveAdmin } from "../../admin-auth";
import { formatAdminDate } from "../../segnalazioni/format";
import { updateProposalStatusAction } from "./actions";
export const dynamic="force-dynamic";
export default async function ProposalDetail({params,searchParams}:{params:Promise<{proposalId:string}>;searchParams:Promise<{updated?:string}>}) {
 await requireActiveAdmin(); const {proposalId}=await params; const query=await searchParams; const connection=createDatabaseConnection();
 try { let item; try { item=await new GetProposalUseCase(new DrizzleProposalRepository(connection.db)).execute(proposalId); } catch(e){if(e instanceof ProposalNotFoundError)notFound();throw e}
 return <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12"><div className="mx-auto grid w-full max-w-6xl gap-8"><header className="grid gap-3"><p className="text-sm text-muted-foreground">{PROPOSAL_CATEGORY_LABELS[item.category]}</p><h1 className="font-serif text-4xl font-semibold">{item.title}</h1><p className="text-sm text-muted-foreground">Ricevuta il {formatAdminDate(item.createdAt)}</p></header>{query.updated?<p className="text-sm text-primary">Stato aggiornato.</p>:null}<div className="grid gap-6 lg:grid-cols-[1fr_22rem]"><Card><CardHeader><CardTitle>Proposta</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap leading-7">{item.content}</p></CardContent></Card><Card><CardHeader><CardTitle>Gestione</CardTitle></CardHeader><CardContent className="grid gap-6"><dl className="grid gap-4 text-sm"><div><dt className="text-muted-foreground">Modalità invio</dt><dd>{item.submissionMode==="anonymous"?"Anonimo":"Con contatto"}</dd></div>{item.contactEmail?<div><dt className="text-muted-foreground">Email</dt><dd><a className="text-primary hover:underline" href={`mailto:${item.contactEmail}`}>{item.contactEmail}</a></dd></div>:null}</dl><form action={updateProposalStatusAction} className="grid gap-3"><input name="id" type="hidden" value={item.id}/><label className="grid gap-2 text-sm text-muted-foreground">Stato<select className="min-h-10 rounded-md border border-input bg-background px-3 text-foreground" defaultValue={item.status} name="status">{PROPOSAL_STATUSES.map(s=><option value={s} key={s}>{PROPOSAL_STATUS_LABELS[s]}</option>)}</select></label><Button type="submit">Aggiorna stato</Button></form></CardContent></Card></div></div></main>;
 } finally { await connection.close(); }
}

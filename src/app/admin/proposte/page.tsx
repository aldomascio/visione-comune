import Link from "next/link";
import { ListProposalsUseCase } from "@/modules/proposals/application/manage-proposals";
import { PROPOSAL_CATEGORY_LABELS, PROPOSAL_STATUS_LABELS, type ProposalStatus } from "@/modules/proposals/domain";
import { DrizzleProposalRepository } from "@/modules/proposals/infrastructure/drizzle-proposal-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";
import { requireActiveAdmin } from "../admin-auth";
import { formatAdminDate } from "../segnalazioni/format";

export const dynamic = "force-dynamic";

export default async function AdminProposalsPage() {
  await requireActiveAdmin();
  const connection = createDatabaseConnection();

  try {
    const items = await new ListProposalsUseCase(new DrizzleProposalRepository(connection.db)).execute();

    return (
      <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
        <div className="mx-auto grid w-full max-w-6xl gap-8">
          <header className="grid gap-3">
            <h1 className="font-serif text-4xl font-semibold">Proposte</h1>
            <p className="text-muted-foreground">Idee inviate privatamente dai cittadini.</p>
          </header>

          <Card>
            <CardHeader>
              <CardTitle>Proposte ricevute</CardTitle>
              <CardDescription>Elenco privato delle proposte inviate a Visione Comune.</CardDescription>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/40 p-8 text-sm text-muted-foreground">Non ci sono proposte.</div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  <div className="hidden grid-cols-[9rem_1.4fr_1fr_10rem_10rem_5rem] gap-4 border-b border-border bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
                    <span>Data</span><span>Titolo</span><span>Ambito</span><span>Stato</span><span>Invio</span><span>Azione</span>
                  </div>
                  <div className="divide-y divide-border">
                    {items.map((item) => (
                      <article className="grid gap-3 px-4 py-4 md:grid-cols-[9rem_1.4fr_1fr_10rem_10rem_5rem] md:items-center md:gap-4" key={item.id}>
                        <p className="text-sm text-muted-foreground">{formatAdminDate(item.createdAt)}</p>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground md:text-foreground">{PROPOSAL_CATEGORY_LABELS[item.category]}</p>
                        <ProposalStatusBadge status={item.status} />
                        <p className="text-sm text-muted-foreground">{item.submissionMode === "anonymous" ? "Anonimo" : "Con contatto"}</p>
                        <Link className="text-sm font-semibold text-primary hover:underline" href={`/admin/proposte/${item.id}`}>Apri</Link>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    );
  } finally {
    await connection.close();
  }
}

function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  const variant = status === "new" ? "info" : status === "reviewing" ? "warning" : "muted";
  return <Badge variant={variant}>{PROPOSAL_STATUS_LABELS[status]}</Badge>;
}

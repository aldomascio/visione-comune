import Link from "next/link";
import { ListAdminNewsPostsUseCase } from "@/modules/news/application/manage-news-posts";
import type { NewsPostStatus } from "@/modules/news/application/news-post-repository";
import { DrizzleNewsPostRepository } from "@/modules/news/infrastructure/drizzle-news-post-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";
import { requireActiveAdmin } from "../admin-auth";
import { formatAdminDate } from "../segnalazioni/format";

type AdminNewsPageProps = {
  searchParams?: Promise<{ created?: string; updated?: string }>;
};

export const dynamic = "force-dynamic";

export default async function AdminNewsPage({ searchParams }: AdminNewsPageProps) {
  await requireActiveAdmin();
  const query = await searchParams;
  const posts = await getAdminNewsPosts();

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-3">
            <Link className="text-sm font-semibold text-primary hover:underline" href="/admin">
              ← Torna al backoffice
            </Link>
            <p className="text-sm font-semibold text-primary">Backoffice</p>
            <h1 className="font-serif text-4xl font-semibold tracking-normal">Notizie</h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              Crea, modifica e pubblica aggiornamenti editoriali semplici per il sito pubblico.
            </p>
          </div>
          <Link
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            href="/admin/notizie/nuova"
          >
            Nuova notizia
          </Link>
        </section>

        {query?.created ? <SuccessMessage text="Notizia creata." /> : null}
        {query?.updated ? <SuccessMessage text="Notizia aggiornata." /> : null}

        <Card>
          <CardHeader>
            <CardTitle>Elenco notizie</CardTitle>
            <CardDescription>Le bozze restano visibili solo in backoffice.</CardDescription>
          </CardHeader>
          <CardContent>
            {posts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/40 p-6 text-sm leading-6 text-muted-foreground">
                Non ci sono ancora notizie.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Titolo</th>
                      <th className="px-4 py-3 font-semibold">Slug</th>
                      <th className="px-4 py-3 font-semibold">Stato</th>
                      <th className="px-4 py-3 font-semibold">Creata</th>
                      <th className="px-4 py-3 font-semibold">Pubblicata</th>
                      <th className="px-4 py-3 text-right font-semibold">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-background">
                    {posts.map((post) => (
                      <tr key={post.id}>
                        <td className="px-4 py-4 font-medium">{post.title}</td>
                        <td className="px-4 py-4 font-mono text-xs text-muted-foreground">{post.slug}</td>
                        <td className="px-4 py-4"><NewsStatusBadge status={post.status} /></td>
                        <td className="px-4 py-4 text-muted-foreground">{formatAdminDate(post.createdAt)}</td>
                        <td className="px-4 py-4 text-muted-foreground">{post.publishedAt ? formatAdminDate(post.publishedAt) : "—"}</td>
                        <td className="px-4 py-4 text-right">
                          <Link className="font-semibold text-primary hover:underline" href={`/admin/notizie/${post.id}`}>
                            Modifica
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

async function getAdminNewsPosts() {
  let connection;

  try {
    connection = createDatabaseConnection();
    return await new ListAdminNewsPostsUseCase({
      newsPostRepository: new DrizzleNewsPostRepository(connection.db)
    }).execute();
  } finally {
    await connection?.close();
  }
}

function NewsStatusBadge({ status }: { status: NewsPostStatus }) {
  return <Badge variant={status === "published" ? "primary" : "muted"}>{status === "published" ? "Pubblicata" : "Bozza"}</Badge>;
}

function SuccessMessage({ text }: { text: string }) {
  return <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium" role="status">{text}</div>;
}

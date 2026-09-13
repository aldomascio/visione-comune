import Image from "next/image";
import Link from "next/link";
import { ListPublishedNewsPostsUseCase } from "@/modules/news/application/manage-news-posts";
import { DrizzleNewsPostRepository } from "@/modules/news/infrastructure/drizzle-news-post-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const posts = await getPublishedNewsPosts();

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <section className="grid gap-3">
          <p className="text-sm font-semibold text-primary">Visione Comune</p>
          <h1 className="font-serif text-4xl font-semibold tracking-normal">Notizie</h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            Aggiornamenti, comunicazioni e notizie pubbliche dal progetto Visione Comune.
          </p>
        </section>

        {posts.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Nessuna notizia pubblicata</CardTitle>
              <CardDescription>Gli aggiornamenti pubblici saranno visibili qui.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {posts.map((post) => (
              <Card className="overflow-hidden" key={post.id}>
                {post.featuredImageUrl ? (
                  <div className="relative aspect-[16/9] w-full bg-muted">
                    <Image
                      alt={post.featuredImageAlt ?? ""}
                      className="object-cover"
                      fill
                      sizes="(min-width: 768px) 50vw, 100vw"
                      src={post.featuredImageUrl}
                    />
                  </div>
                ) : null}
                <CardHeader>
                  <p className="text-sm font-medium text-muted-foreground">{formatPublicDate(post.publishedAt)}</p>
                  <CardTitle>{post.title}</CardTitle>
                  {post.excerpt ? <CardDescription>{post.excerpt}</CardDescription> : null}
                </CardHeader>
                <CardContent>
                  <Link className="font-semibold text-primary hover:underline" href={`/notizie/${post.slug}`}>
                    Leggi aggiornamento
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

async function getPublishedNewsPosts() {
  let connection;

  try {
    connection = createDatabaseConnection();
    return await new ListPublishedNewsPostsUseCase({
      newsPostRepository: new DrizzleNewsPostRepository(connection.db)
    }).execute();
  } finally {
    await connection?.close();
  }
}

function formatPublicDate(date: Date | null): string {
  if (!date) return "Data non disponibile";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "long" }).format(date);
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { GetPublishedNewsPostBySlugUseCase } from "@/modules/news/application/manage-news-posts";
import { DrizzleNewsPostRepository } from "@/modules/news/infrastructure/drizzle-news-post-repository";
import { createDatabaseConnection } from "@/shared/db/client";

type NewsPostPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export default async function NewsPostPage({ params }: NewsPostPageProps) {
  const { slug } = await params;
  const post = await getPublishedNewsPost(slug);

  if (!post) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <article className="mx-auto grid w-full max-w-6xl gap-8">
        <header className="grid gap-4">
          <Link className="text-sm font-semibold text-primary hover:underline" href="/notizie">
            ← Torna alle notizie
          </Link>
          <p className="text-sm font-medium text-muted-foreground">{formatPublicDate(post.publishedAt)}</p>
          <h1 className="max-w-3xl font-serif text-4xl font-semibold tracking-normal sm:text-5xl">{post.title}</h1>
          {post.excerpt ? <p className="max-w-3xl text-lg leading-8 text-muted-foreground">{post.excerpt}</p> : null}
        </header>

        <div className="max-w-3xl whitespace-pre-wrap text-base leading-8 text-foreground">
          {post.content}
        </div>
      </article>
    </main>
  );
}

async function getPublishedNewsPost(slug: string) {
  let connection;

  try {
    connection = createDatabaseConnection();
    return await new GetPublishedNewsPostBySlugUseCase({
      newsPostRepository: new DrizzleNewsPostRepository(connection.db)
    }).execute(slug);
  } finally {
    await connection?.close();
  }
}

function formatPublicDate(date: Date | null): string {
  if (!date) return "Data non disponibile";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "long" }).format(date);
}

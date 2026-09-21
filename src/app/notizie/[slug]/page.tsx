import Image from "next/image";
import { notFound } from "next/navigation";
import { GetPublishedNewsPostBySlugUseCase } from "@/modules/news/application/manage-news-posts";
import { NewsPostContentRenderer } from "@/modules/news/ui/news-post-content-renderer";
import { DrizzleNewsPostRepository } from "@/modules/news/infrastructure/drizzle-news-post-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { ArticleShare } from "./article-share";

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
    <main className="min-h-screen bg-background px-6 pb-10 pt-16 text-foreground sm:px-8 sm:pt-20 lg:px-12">
      <article className="mx-auto grid w-full max-w-6xl gap-8">
        <header className="mx-auto grid w-full max-w-2xl gap-4">
          <p className="text-sm font-medium text-muted-foreground">{formatPublicDate(post.publishedAt)}</p>
          <h1 className="max-w-3xl font-serif text-4xl font-semibold tracking-normal sm:text-5xl">{post.title}</h1>
          {post.excerpt ? <p className="max-w-3xl text-lg leading-8 text-muted-foreground">{post.excerpt}</p> : null}
        </header>

        {post.featuredImageUrl ? (
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-border bg-muted">
            <Image
              alt={post.featuredImageAlt ?? ""}
              className="object-cover"
              fill
              priority
              sizes="(min-width: 1024px) 1152px, 100vw"
              src={post.featuredImageUrl}
            />
          </div>
        ) : null}

        <NewsPostContentRenderer document={post.contentJson} />

        <ArticleShare title={post.title} />
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

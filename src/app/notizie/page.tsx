import Image from "next/image";
import Link from "next/link";
import {
  CountPublishedNewsPostsUseCase,
  ListPublishedNewsPostsUseCase
} from "@/modules/news/application/manage-news-posts";
import type { NewsPostListItem } from "@/modules/news/application/news-post-repository";
import { DrizzleNewsPostRepository } from "@/modules/news/infrastructure/drizzle-news-post-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { Card, CardDescription, CardHeader, CardTitle, cn } from "@/shared/ui";

export const dynamic = "force-dynamic";

const NEWS_POSTS_PER_PAGE = 10;

type NewsPageProps = {
  searchParams?: Promise<{ page?: string }>;
};

export default async function NewsPage({ searchParams }: NewsPageProps) {
  const query = await searchParams;
  const requestedPage = parsePage(query?.page);
  const pageData = await getPublishedNewsPage(requestedPage);
  const featuredPost = pageData.currentPage === 1 ? pageData.posts[0] : undefined;
  const listPosts = featuredPost ? pageData.posts.slice(1) : pageData.posts;

  return (
    <main className="min-h-screen bg-background px-6 pb-10 pt-16 text-foreground sm:px-8 sm:pt-20 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-10">
        <section className="grid gap-3">
          <h1 className="font-serif text-4xl font-semibold tracking-normal sm:text-5xl">Notizie</h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            Aggiornamenti, comunicazioni e notizie pubbliche dal progetto Visione Comune.
          </p>
        </section>

        {pageData.posts.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Nessuna notizia pubblicata</CardTitle>
              <CardDescription>Gli aggiornamenti pubblici saranno visibili qui.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-10">
            {featuredPost ? <FeaturedNewsPost post={featuredPost} /> : null}

            {listPosts.length > 0 ? (
              <div className="divide-y divide-border">
                {listPosts.map((post) => <NewsListItem key={post.id} post={post} />)}
              </div>
            ) : null}

            {pageData.totalPages > 1 ? (
              <nav aria-label="Paginazione notizie" className="flex justify-center gap-2">
                {Array.from({ length: pageData.totalPages }, (_, index) => index + 1).map((pageNumber) => (
                  <Link
                    aria-current={pageNumber === pageData.currentPage ? "page" : undefined}
                    className={cn(
                      "inline-flex size-10 items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      pageNumber === pageData.currentPage
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    href={pageNumber === 1 ? "/notizie" : `/notizie?page=${pageNumber}`}
                    key={pageNumber}
                  >
                    {pageNumber}
                  </Link>
                ))}
              </nav>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}

function FeaturedNewsPost({ post }: { post: NewsPostListItem }) {
  return (
    <article className={cn("grid overflow-hidden rounded-xl bg-card", post.featuredImageUrl && "md:grid-cols-2")}>
      {post.featuredImageUrl ? (
        <div className="relative aspect-[16/9] min-h-full w-full bg-muted md:aspect-auto">
          <Image
            alt={post.featuredImageAlt ?? ""}
            className="object-cover"
            fill
            priority
            sizes="(min-width: 768px) 50vw, 100vw"
            src={post.featuredImageUrl}
          />
        </div>
      ) : null}
      <div className="grid content-center gap-4 p-6 sm:p-8 lg:p-10">
        <p className="text-sm text-muted-foreground">{formatPublicDate(post.publishedAt)}</p>
        <h2 className="font-serif text-3xl font-semibold leading-tight sm:text-4xl">
          <Link className="transition-colors hover:text-primary" href={`/notizie/${post.slug}`}>{post.title}</Link>
        </h2>
        {post.excerpt ? <p className="text-base leading-7 text-muted-foreground">{post.excerpt}</p> : null}
        <Link className="w-fit text-sm font-semibold text-primary hover:underline" href={`/notizie/${post.slug}`}>Leggi l’articolo</Link>
      </div>
    </article>
  );
}

function NewsListItem({ post }: { post: NewsPostListItem }) {
  return (
    <article className="grid gap-3 py-6 md:grid-cols-[10rem_1fr] md:gap-8">
      <p className="text-sm text-muted-foreground">{formatPublicDate(post.publishedAt)}</p>
      <div className="grid gap-2">
        <h2 className="font-serif text-2xl font-semibold">
          <Link className="transition-colors hover:text-primary" href={`/notizie/${post.slug}`}>{post.title}</Link>
        </h2>
        {post.excerpt ? <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{post.excerpt}</p> : null}
      </div>
    </article>
  );
}

async function getPublishedNewsPage(requestedPage: number) {
  let connection;

  try {
    connection = createDatabaseConnection();
    const newsPostRepository = new DrizzleNewsPostRepository(connection.db);
    const totalPosts = await new CountPublishedNewsPostsUseCase({ newsPostRepository }).execute();
    const totalPages = Math.max(1, Math.ceil(totalPosts / NEWS_POSTS_PER_PAGE));
    const currentPage = Math.min(requestedPage, totalPages);
    const posts = await new ListPublishedNewsPostsUseCase({ newsPostRepository }).execute({
      limit: NEWS_POSTS_PER_PAGE,
      offset: (currentPage - 1) * NEWS_POSTS_PER_PAGE
    });

    return { currentPage, posts, totalPages };
  } finally {
    await connection?.close();
  }
}

function parsePage(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value)) return 1;
  return Math.max(1, Number.parseInt(value, 10));
}

function formatPublicDate(date: Date | null): string {
  if (!date) return "Data non disponibile";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "long" }).format(date);
}

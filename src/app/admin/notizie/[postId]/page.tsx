import Link from "next/link";
import { notFound } from "next/navigation";
import { serializeNewsPostContentDocument } from "@/modules/news/application/news-post-content";
import { GetAdminNewsPostUseCase, NewsPostNotFoundError } from "@/modules/news/application/manage-news-posts";
import { DrizzleNewsPostRepository } from "@/modules/news/infrastructure/drizzle-news-post-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { requireActiveAdmin } from "../../admin-auth";
import { updateNewsPostAction } from "../actions";
import type { NewsPostActionState } from "../form-state";
import { NewsPostForm } from "../news-post-form";

type EditNewsPostPageProps = {
  params: Promise<{ postId: string }>;
};

export const dynamic = "force-dynamic";

export default async function EditNewsPostPage({ params }: EditNewsPostPageProps) {
  await requireActiveAdmin();
  const { postId } = await params;
  const post = await getAdminNewsPost(postId);

  const initialState: NewsPostActionState = {
    status: "idle",
    fieldErrors: {},
    values: {
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt ?? "",
      featuredImageUrl: post.featuredImageUrl ?? "",
      featuredImageAlt: post.featuredImageAlt ?? "",
      content: post.content,
      contentJson: serializeNewsPostContentDocument(post.contentJson),
      status: post.status
    }
  };

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <section className="grid gap-3">
          <Link className="text-sm font-semibold text-primary hover:underline" href="/admin/notizie">
            ← Torna alle notizie
          </Link>
          <h1 className="font-serif text-4xl font-semibold tracking-normal">Modifica notizia</h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            Se una notizia torna bozza, la data di prima pubblicazione resta conservata.
          </p>
        </section>

        <NewsPostForm action={updateNewsPostAction} initialState={initialState} mode="edit" post={post} />
      </div>
    </main>
  );
}

async function getAdminNewsPost(postId: string) {
  let connection;

  try {
    connection = createDatabaseConnection();
    return await new GetAdminNewsPostUseCase({
      newsPostRepository: new DrizzleNewsPostRepository(connection.db)
    }).execute(postId);
  } catch (error) {
    if (error instanceof NewsPostNotFoundError) {
      notFound();
    }

    throw error;
  } finally {
    await connection?.close();
  }
}

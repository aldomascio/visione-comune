import { inArray, or } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  CreateNewsPostUseCase,
  DuplicateNewsPostSlugError,
  ListPublishedNewsPostsUseCase,
  UpdateNewsPostUseCase
} from "@/modules/news/application/manage-news-posts";
import { DrizzleNewsPostRepository } from "@/modules/news/infrastructure/drizzle-news-post-repository";
import { createDatabaseConnection, type DatabaseConnection } from "@/shared/db/client";
import { newsPosts } from "@/shared/db/schema";

const maybeDescribe = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const postIds = ["test-news-draft", "test-news-published", "test-news-newer", "test-news-duplicate"];
const postSlugs = ["bozza-test", "pubblicata-test", "piu-recente-test", "slug-duplicato-news", "slug-aggiornato-news"];

maybeDescribe("news post repository with PostgreSQL", () => {
  let connection: DatabaseConnection;
  let repository: DrizzleNewsPostRepository;

  beforeAll(async () => {
    connection = createDatabaseConnection(process.env.TEST_DATABASE_URL);
    await migrate(connection.db, { migrationsFolder: "drizzle" });
    repository = new DrizzleNewsPostRepository(connection.db);
  });

  beforeEach(async () => {
    await cleanupTestData(connection);
  });

  afterAll(async () => {
    if (connection) {
      await cleanupTestData(connection);
      await connection.close();
    }
  });

  it("persists draft and published posts", async () => {
    const draft = await new CreateNewsPostUseCase({
      newsPostRepository: repository,
      createId: () => postIds[0],
      now: () => new Date("2026-01-01T10:00:00.000Z")
    }).execute({
      title: "Bozza test",
      slug: "bozza-test",
      content: "Contenuto bozza test.",
      status: "draft"
    });

    const publishedAt = new Date("2026-01-02T10:00:00.000Z");
    const published = await new CreateNewsPostUseCase({
      newsPostRepository: repository,
      createId: () => postIds[1],
      now: () => publishedAt
    }).execute({
      title: "Pubblicata test",
      slug: "pubblicata-test",
      excerpt: "Estratto pubblico",
      featuredImageUrl: "/news/test.svg",
      featuredImageAlt: "Immagine test",
      content: "Contenuto pubblicato test.",
      status: "published"
    });

    expect(draft.publishedAt).toBeNull();
    expect(published.publishedAt).toEqual(publishedAt);
    await expect(repository.findById(postIds[1])).resolves.toMatchObject({
      slug: "pubblicata-test",
      status: "published",
      featuredImageUrl: "/news/test.svg",
      featuredImageAlt: "Immagine test"
    });
  });

  it("enforces unique slugs", async () => {
    await new CreateNewsPostUseCase({ newsPostRepository: repository, createId: () => postIds[0] }).execute({
      title: "Primo titolo",
      slug: "slug-duplicato-news",
      content: "Contenuto.",
      status: "draft"
    });

    await expect(
      new CreateNewsPostUseCase({ newsPostRepository: repository, createId: () => postIds[1] }).execute({
        title: "Secondo titolo",
        slug: "slug-duplicato-news",
        content: "Altro contenuto.",
        status: "draft"
      })
    ).rejects.toBeInstanceOf(DuplicateNewsPostSlugError);
  });

  it("lists only published posts ordered by publishedAt descending", async () => {
    await insertPost(connection, { id: postIds[0], slug: "bozza-test", title: "Bozza", status: "draft", publishedAt: null });
    await insertPost(connection, { id: postIds[1], slug: "pubblicata-test", title: "Pubblicata", status: "published", publishedAt: new Date("2026-01-02T10:00:00.000Z") });
    await insertPost(connection, { id: postIds[2], slug: "piu-recente-test", title: "Piu recente", status: "published", publishedAt: new Date("2026-01-03T10:00:00.000Z") });

    const posts = await new ListPublishedNewsPostsUseCase({ newsPostRepository: repository }).execute();

    expect(posts.map((post) => post.id)).toEqual([postIds[2], postIds[1]]);
    await expect(repository.findPublishedBySlug("bozza-test")).resolves.toBeNull();
    await expect(repository.findPublishedBySlug("pubblicata-test")).resolves.toMatchObject({ id: postIds[1] });
  });

  it("updates a post and preserves first publishedAt when moved back to draft", async () => {
    await insertPost(connection, { id: postIds[0], slug: "bozza-test", title: "Bozza", status: "draft", publishedAt: null });

    const firstPublication = new Date("2026-01-04T10:00:00.000Z");
    const published = await new UpdateNewsPostUseCase({ newsPostRepository: repository, now: () => firstPublication }).execute({
      id: postIds[0],
      title: "Titolo aggiornato",
      slug: "slug-aggiornato-news",
      excerpt: "Estratto",
      content: "Contenuto aggiornato.",
      status: "published"
    });

    expect(published.publishedAt).toEqual(firstPublication);

    const draft = await new UpdateNewsPostUseCase({ newsPostRepository: repository, now: () => new Date("2026-01-05T10:00:00.000Z") }).execute({
      id: postIds[0],
      title: "Titolo aggiornato",
      slug: "slug-aggiornato-news",
      excerpt: "Estratto",
      content: "Contenuto aggiornato.",
      status: "draft"
    });

    expect(draft.status).toBe("draft");
    expect(draft.publishedAt).toEqual(firstPublication);
  });
});

async function insertPost(
  connection: DatabaseConnection,
  input: { id: string; slug: string; title: string; status: "draft" | "published"; publishedAt: Date | null }
): Promise<void> {
  await connection.db.insert(newsPosts).values({
    id: input.id,
    title: input.title,
    slug: input.slug,
    excerpt: null,
    content: `Contenuto per ${input.title}.`,
    status: input.status,
    publishedAt: input.publishedAt,
    createdAt: input.publishedAt ?? new Date("2026-01-01T10:00:00.000Z"),
    updatedAt: input.publishedAt ?? new Date("2026-01-01T10:00:00.000Z")
  });
}

async function cleanupTestData(connection: DatabaseConnection): Promise<void> {
  await connection.db.delete(newsPosts).where(or(inArray(newsPosts.id, postIds), inArray(newsPosts.slug, postSlugs)));
}

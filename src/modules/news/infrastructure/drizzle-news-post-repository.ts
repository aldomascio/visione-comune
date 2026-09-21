import { and, count, desc, eq, isNotNull } from "drizzle-orm";
import type { Database } from "@/shared/db/client";
import { newsPosts, type NewsPostRecord } from "@/shared/db/schema";
import { normalizeNewsPostContentDocument, newsPostContentDocumentFromText } from "../application/news-post-content";
import {
  DuplicateNewsPostSlugPersistenceError,
  type NewsPostDetails,
  type NewsPostListItem,
  type NewsPostRepository,
  type NewsPostUpdate,
  type NewNewsPost
} from "../application/news-post-repository";

export class DrizzleNewsPostRepository implements NewsPostRepository {
  constructor(private readonly db: Database) {}

  async create(post: NewNewsPost): Promise<NewsPostDetails> {
    try {
      const [createdPost] = await this.db.insert(newsPosts).values(post).returning();

      if (!createdPost) {
        throw new Error("News post insert did not return a row.");
      }

      return mapNewsPostRecord(createdPost);
    } catch (error) {
      if (isNewsPostSlugUniqueViolation(error)) {
        throw new DuplicateNewsPostSlugPersistenceError(post.slug);
      }

      throw error;
    }
  }

  async update(post: NewsPostUpdate): Promise<NewsPostDetails | null> {
    try {
      const [updatedPost] = await this.db
        .update(newsPosts)
        .set({
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          featuredImageUrl: post.featuredImageUrl,
          featuredImageAlt: post.featuredImageAlt,
          content: post.content,
          contentJson: post.contentJson,
          status: post.status,
          publishedAt: post.publishedAt,
          updatedAt: post.updatedAt
        })
        .where(eq(newsPosts.id, post.id))
        .returning();

      return updatedPost ? mapNewsPostRecord(updatedPost) : null;
    } catch (error) {
      if (isNewsPostSlugUniqueViolation(error)) {
        throw new DuplicateNewsPostSlugPersistenceError(post.slug);
      }

      throw error;
    }
  }

  async findById(postId: string): Promise<NewsPostDetails | null> {
    const [post] = await this.db.select().from(newsPosts).where(eq(newsPosts.id, postId)).limit(1);
    return post ? mapNewsPostRecord(post) : null;
  }

  async findBySlug(slug: string): Promise<NewsPostDetails | null> {
    const [post] = await this.db.select().from(newsPosts).where(eq(newsPosts.slug, slug)).limit(1);
    return post ? mapNewsPostRecord(post) : null;
  }

  async listAdmin(): Promise<NewsPostListItem[]> {
    const posts = await this.db.select().from(newsPosts).orderBy(desc(newsPosts.createdAt));
    return posts.map(mapNewsPostRecord);
  }

  async listPublished(limit?: number, offset?: number): Promise<NewsPostListItem[]> {
    const query = this.db
      .select()
      .from(newsPosts)
      .where(and(eq(newsPosts.status, "published"), isNotNull(newsPosts.publishedAt)))
      .orderBy(desc(newsPosts.publishedAt))
      .$dynamic();

    if (typeof limit === "number") {
      const posts = await query.limit(limit).offset(offset ?? 0);
      return posts.map(mapNewsPostRecord);
    }

    const posts = await query;
    return posts.map(mapNewsPostRecord);
  }

  async countPublished(): Promise<number> {
    const [result] = await this.db
      .select({ value: count() })
      .from(newsPosts)
      .where(and(eq(newsPosts.status, "published"), isNotNull(newsPosts.publishedAt)));

    return result?.value ?? 0;
  }

  async findPublishedBySlug(slug: string): Promise<NewsPostDetails | null> {
    const [post] = await this.db
      .select()
      .from(newsPosts)
      .where(and(eq(newsPosts.slug, slug), eq(newsPosts.status, "published"), isNotNull(newsPosts.publishedAt)))
      .limit(1);

    return post ? mapNewsPostRecord(post) : null;
  }
}

function isNewsPostSlugUniqueViolation(error: unknown): boolean {
  const postgresError = getPostgresError(error);

  return postgresError?.code === "23505" && postgresError.constraint_name === "news_posts_slug_unique";
}

function getPostgresError(error: unknown): PostgresError | null {
  if (isPostgresError(error)) {
    return error;
  }

  if (typeof error === "object" && error !== null && "cause" in error) {
    const cause = (error as { cause?: unknown }).cause;

    if (isPostgresError(cause)) {
      return cause;
    }
  }

  return null;
}

type PostgresError = {
  code?: string;
  constraint_name?: string;
};

function isPostgresError(error: unknown): error is PostgresError {
  return typeof error === "object" && error !== null && "code" in error;
}

function mapNewsPostRecord(record: NewsPostRecord): NewsPostDetails {
  return {
    ...record,
    contentJson: record.contentJson
      ? normalizeNewsPostContentDocument(record.contentJson)
      : newsPostContentDocumentFromText(record.content)
  };
}

export const NEWS_POST_STATUSES = ["draft", "published"] as const;

export type NewsPostStatus = (typeof NEWS_POST_STATUSES)[number];

export type NewsPostDetails = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
  content: string;
  status: NewsPostStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewsPostListItem = NewsPostDetails;

export type NewNewsPost = NewsPostDetails;

export type NewsPostUpdate = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
  content: string;
  status: NewsPostStatus;
  publishedAt: Date | null;
  updatedAt: Date;
};

export class DuplicateNewsPostSlugPersistenceError extends Error {
  constructor(slug: string) {
    super(`News post slug already exists: ${slug}`);
    this.name = "DuplicateNewsPostSlugPersistenceError";
  }
}

export type NewsPostRepository = {
  create(post: NewNewsPost): Promise<NewsPostDetails>;
  update(post: NewsPostUpdate): Promise<NewsPostDetails | null>;
  findById(postId: string): Promise<NewsPostDetails | null>;
  findBySlug(slug: string): Promise<NewsPostDetails | null>;
  listAdmin(): Promise<NewsPostListItem[]>;
  listPublished(limit?: number): Promise<NewsPostListItem[]>;
  findPublishedBySlug(slug: string): Promise<NewsPostDetails | null>;
};

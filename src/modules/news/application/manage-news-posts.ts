import { randomUUID } from "node:crypto";
import {
  DuplicateNewsPostSlugPersistenceError,
  NEWS_POST_STATUSES,
  type NewsPostDetails,
  type NewsPostListItem,
  type NewsPostRepository,
  type NewsPostStatus
} from "./news-post-repository";

export const NEWS_POST_TITLE_MAX_LENGTH = 180;
export const NEWS_POST_SLUG_MAX_LENGTH = 160;
export const NEWS_POST_EXCERPT_MAX_LENGTH = 320;
export const NEWS_POST_CONTENT_MAX_LENGTH = 12000;
export const NEWS_POST_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type NewsPostFieldErrors = {
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  status?: string;
};

export class NewsPostValidationError extends Error {
  constructor(readonly fieldErrors: NewsPostFieldErrors) {
    super("News post validation failed.");
    this.name = "NewsPostValidationError";
  }
}

export class DuplicateNewsPostSlugError extends Error {
  constructor(readonly slug: string) {
    super(`News post slug already exists: ${slug}`);
    this.name = "DuplicateNewsPostSlugError";
  }
}

export class NewsPostNotFoundError extends Error {
  constructor(readonly postId: string) {
    super(`News post not found: ${postId}`);
    this.name = "NewsPostNotFoundError";
  }
}

export type NewsPostFormInput = {
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  status: string;
};

export type ListAdminNewsPostsUseCaseDependencies = {
  newsPostRepository: NewsPostRepository;
};

export class ListAdminNewsPostsUseCase {
  constructor(private readonly dependencies: ListAdminNewsPostsUseCaseDependencies) {}

  execute(): Promise<NewsPostListItem[]> {
    return this.dependencies.newsPostRepository.listAdmin();
  }
}

export class ListPublishedNewsPostsUseCase {
  constructor(private readonly dependencies: ListAdminNewsPostsUseCaseDependencies) {}

  execute(input?: { limit?: number }): Promise<NewsPostListItem[]> {
    return this.dependencies.newsPostRepository.listPublished(input?.limit);
  }
}

export class GetPublishedNewsPostBySlugUseCase {
  constructor(private readonly dependencies: ListAdminNewsPostsUseCaseDependencies) {}

  execute(slug: string): Promise<NewsPostDetails | null> {
    return this.dependencies.newsPostRepository.findPublishedBySlug(normalizeNewsPostSlug(slug));
  }
}

export class GetAdminNewsPostUseCase {
  constructor(private readonly dependencies: ListAdminNewsPostsUseCaseDependencies) {}

  async execute(postId: string): Promise<NewsPostDetails> {
    const post = await this.dependencies.newsPostRepository.findById(postId);

    if (!post) {
      throw new NewsPostNotFoundError(postId);
    }

    return post;
  }
}

export type CreateNewsPostUseCaseDependencies = ListAdminNewsPostsUseCaseDependencies & {
  createId?: () => string;
  now?: () => Date;
};

export class CreateNewsPostUseCase {
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(private readonly dependencies: CreateNewsPostUseCaseDependencies) {
    this.createId = dependencies.createId ?? (() => randomUUID());
    this.now = dependencies.now ?? (() => new Date());
  }

  async execute(input: NewsPostFormInput): Promise<NewsPostDetails> {
    const values = validateNewsPostInput(input);
    await ensureSlugAvailable(this.dependencies.newsPostRepository, values.slug);

    const now = this.now();

    try {
      return await this.dependencies.newsPostRepository.create({
        id: this.createId(),
        title: values.title,
        slug: values.slug,
        excerpt: values.excerpt,
        content: values.content,
        status: values.status,
        publishedAt: values.status === "published" ? now : null,
        createdAt: now,
        updatedAt: now
      });
    } catch (error) {
      if (error instanceof DuplicateNewsPostSlugPersistenceError) {
        throw new DuplicateNewsPostSlugError(values.slug);
      }

      throw error;
    }
  }
}

export type UpdateNewsPostUseCaseDependencies = ListAdminNewsPostsUseCaseDependencies & {
  now?: () => Date;
};

export class UpdateNewsPostUseCase {
  private readonly now: () => Date;

  constructor(private readonly dependencies: UpdateNewsPostUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async execute(input: NewsPostFormInput & { id: string }): Promise<NewsPostDetails> {
    const existingPost = await this.dependencies.newsPostRepository.findById(input.id);

    if (!existingPost) {
      throw new NewsPostNotFoundError(input.id);
    }

    const values = validateNewsPostInput(input);
    await ensureSlugAvailable(this.dependencies.newsPostRepository, values.slug, input.id);

    const now = this.now();
    const publishedAt = existingPost.publishedAt ?? (values.status === "published" ? now : null);

    try {
      const updated = await this.dependencies.newsPostRepository.update({
        id: input.id,
        title: values.title,
        slug: values.slug,
        excerpt: values.excerpt,
        content: values.content,
        status: values.status,
        publishedAt,
        updatedAt: now
      });

      if (!updated) {
        throw new NewsPostNotFoundError(input.id);
      }

      return updated;
    } catch (error) {
      if (error instanceof DuplicateNewsPostSlugPersistenceError) {
        throw new DuplicateNewsPostSlugError(values.slug);
      }

      throw error;
    }
  }
}

export function validateNewsPostInput(input: NewsPostFormInput): {
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  status: NewsPostStatus;
} {
  const title = normalizeNewsPostTitle(input.title);
  const slug = normalizeNewsPostSlug(input.slug?.trim() ? input.slug : title);
  const excerpt = normalizeOptionalText(input.excerpt);
  const content = normalizeNewsPostContent(input.content);
  const status = parseNewsPostStatus(input.status);
  const fieldErrors: NewsPostFieldErrors = {};

  if (!title) {
    fieldErrors.title = "Inserisci il titolo della notizia.";
  } else if (title.length > NEWS_POST_TITLE_MAX_LENGTH) {
    fieldErrors.title = `Il titolo non puo superare ${NEWS_POST_TITLE_MAX_LENGTH} caratteri.`;
  }

  if (!slug) {
    fieldErrors.slug = "Inserisci uno slug valido.";
  } else if (slug.length > NEWS_POST_SLUG_MAX_LENGTH) {
    fieldErrors.slug = `Lo slug non puo superare ${NEWS_POST_SLUG_MAX_LENGTH} caratteri.`;
  } else if (!NEWS_POST_SLUG_PATTERN.test(slug)) {
    fieldErrors.slug = "Usa solo lettere minuscole, numeri e trattini.";
  }

  if (excerpt && excerpt.length > NEWS_POST_EXCERPT_MAX_LENGTH) {
    fieldErrors.excerpt = `L'estratto non puo superare ${NEWS_POST_EXCERPT_MAX_LENGTH} caratteri.`;
  }

  if (!content) {
    fieldErrors.content = "Inserisci il contenuto della notizia.";
  } else if (content.length > NEWS_POST_CONTENT_MAX_LENGTH) {
    fieldErrors.content = `Il contenuto non puo superare ${NEWS_POST_CONTENT_MAX_LENGTH} caratteri.`;
  }

  if (!status) {
    fieldErrors.status = "Seleziona uno stato valido.";
  }

  if (Object.keys(fieldErrors).length > 0 || !status) {
    throw new NewsPostValidationError(fieldErrors);
  }

  return { title, slug, excerpt, content, status };
}

export function normalizeNewsPostTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeNewsPostSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function mapNewsPostErrorToMessage(error: unknown): string {
  if (error instanceof NewsPostValidationError) {
    return "Controlla i campi evidenziati.";
  }

  if (error instanceof DuplicateNewsPostSlugError) {
    return "Esiste gia una notizia con questo slug.";
  }

  if (error instanceof NewsPostNotFoundError) {
    return "Notizia non trovata.";
  }

  return "Si e verificato un errore inatteso. Riprova tra poco.";
}

function normalizeOptionalText(value: string | undefined): string | null {
  const normalized = value?.trim().replace(/\s+/g, " ") ?? "";
  return normalized || null;
}

function normalizeNewsPostContent(value: string): string {
  return value.trim().replace(/\r\n/g, "\n");
}

function parseNewsPostStatus(value: string): NewsPostStatus | null {
  return NEWS_POST_STATUSES.includes(value as NewsPostStatus) ? (value as NewsPostStatus) : null;
}

async function ensureSlugAvailable(
  newsPostRepository: NewsPostRepository,
  slug: string,
  allowedPostId?: string
): Promise<void> {
  const postWithSameSlug = await newsPostRepository.findBySlug(slug);

  if (postWithSameSlug && postWithSameSlug.id !== allowedPostId) {
    throw new DuplicateNewsPostSlugError(slug);
  }
}

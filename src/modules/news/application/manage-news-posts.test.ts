import { describe, expect, it } from "vitest";
import {
  getNewsPostContentText,
  newsPostContentDocumentFromText,
  parseNewsPostContentDocument,
  serializeNewsPostContentDocument
} from "./news-post-content";
import {
  CreateNewsPostUseCase,
  DuplicateNewsPostSlugError,
  ListPublishedNewsPostsUseCase,
  UpdateNewsPostUseCase,
  normalizeNewsPostSlug
} from "./manage-news-posts";
import type {
  NewsPostDetails,
  NewsPostRepository,
  NewsPostUpdate,
  NewNewsPost
} from "./news-post-repository";

describe("news post management", () => {
  it("creates a draft with a generated slug", async () => {
    const repository = new InMemoryNewsPostRepository();
    const post = await new CreateNewsPostUseCase({
      newsPostRepository: repository,
      createId: () => "news-1",
      now: () => new Date("2026-01-01T10:00:00.000Z")
    }).execute({
      title: "Una nuova notizia per Venafro",
      content: "Contenuto della notizia.",
      status: "draft"
    });

    expect(post).toMatchObject({
      id: "news-1",
      slug: "una-nuova-notizia-per-venafro",
      status: "draft",
      publishedAt: null
    });
  });

  it("creates a published post with publishedAt", async () => {
    const repository = new InMemoryNewsPostRepository();
    const now = new Date("2026-01-01T10:00:00.000Z");
    const post = await new CreateNewsPostUseCase({ newsPostRepository: repository, now: () => now }).execute({
      title: "Notizia pubblicata",
      slug: "notizia-pubblicata",
      excerpt: "Estratto",
      content: "Contenuto pubblico.",
      status: "published"
    });

    expect(post.status).toBe("published");
    expect(post.publishedAt).toEqual(now);
  });

  it("rejects duplicate slugs", async () => {
    const repository = new InMemoryNewsPostRepository();
    await new CreateNewsPostUseCase({ newsPostRepository: repository, createId: () => "news-1" }).execute({
      title: "Titolo",
      slug: "slug-duplicato",
      content: "Contenuto.",
      status: "draft"
    });

    await expect(
      new CreateNewsPostUseCase({ newsPostRepository: repository, createId: () => "news-2" }).execute({
        title: "Altro titolo",
        slug: "slug-duplicato",
        content: "Altro contenuto.",
        status: "draft"
      })
    ).rejects.toBeInstanceOf(DuplicateNewsPostSlugError);
  });

  it("updates and publishes a draft while preserving first publishedAt", async () => {
    const repository = new InMemoryNewsPostRepository();
    await new CreateNewsPostUseCase({
      newsPostRepository: repository,
      createId: () => "news-1",
      now: () => new Date("2026-01-01T10:00:00.000Z")
    }).execute({ title: "Bozza", content: "Contenuto bozza.", status: "draft" });

    const published = await new UpdateNewsPostUseCase({
      newsPostRepository: repository,
      now: () => new Date("2026-01-02T10:00:00.000Z")
    }).execute({
      id: "news-1",
      title: "Bozza pubblicata",
      slug: "bozza-pubblicata",
      excerpt: "Estratto aggiornato",
      content: "Contenuto aggiornato.",
      status: "published"
    });

    expect(published.status).toBe("published");
    expect(published.publishedAt).toEqual(new Date("2026-01-02T10:00:00.000Z"));

    const draftAgain = await new UpdateNewsPostUseCase({
      newsPostRepository: repository,
      now: () => new Date("2026-01-03T10:00:00.000Z")
    }).execute({
      id: "news-1",
      title: "Bozza pubblicata",
      slug: "bozza-pubblicata",
      excerpt: "Estratto aggiornato",
      content: "Contenuto aggiornato.",
      status: "draft"
    });

    expect(draftAgain.status).toBe("draft");
    expect(draftAgain.publishedAt).toEqual(new Date("2026-01-02T10:00:00.000Z"));
  });

  it("lists only published posts ordered by publishedAt descending", async () => {
    const repository = new InMemoryNewsPostRepository();
    await repository.create(makePost({ id: "draft", slug: "draft", status: "draft", publishedAt: null }));
    await repository.create(makePost({ id: "old", slug: "old", status: "published", publishedAt: new Date("2026-01-01T10:00:00.000Z") }));
    await repository.create(makePost({ id: "new", slug: "new", status: "published", publishedAt: new Date("2026-01-03T10:00:00.000Z") }));

    const posts = await new ListPublishedNewsPostsUseCase({ newsPostRepository: repository }).execute();

    expect(posts.map((post) => post.id)).toEqual(["new", "old"]);
  });


  it("stores a valid structured rich text document", async () => {
    const repository = new InMemoryNewsPostRepository();
    const contentJson = serializeNewsPostContentDocument({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Titolo sezione" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Testo " },
            { type: "text", text: "importante", marks: [{ type: "bold" }] },
            { type: "text", text: " con link", marks: [{ type: "link", attrs: { href: "https://example.com", target: "_blank", rel: "noopener noreferrer" } }] }
          ]
        },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Punto elenco" }] }] }] }
      ]
    });

    const post = await new CreateNewsPostUseCase({ newsPostRepository: repository }).execute({
      title: "Notizia rich text",
      slug: "notizia-rich-text",
      contentJson,
      status: "draft"
    });

    expect(post.content).toContain("Titolo sezione");
    expect(getNewsPostContentText(post.contentJson)).toContain("Punto elenco");
  });

  it("rejects empty structured content", async () => {
    const repository = new InMemoryNewsPostRepository();

    await expect(
      new CreateNewsPostUseCase({ newsPostRepository: repository }).execute({
        title: "Notizia vuota",
        slug: "notizia-vuota",
        contentJson: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
        status: "draft"
      })
    ).rejects.toMatchObject({ fieldErrors: { content: "Inserisci il contenuto della notizia." } });
  });

  it("rejects unsafe links in structured content", async () => {
    const repository = new InMemoryNewsPostRepository();

    await expect(
      new CreateNewsPostUseCase({ newsPostRepository: repository }).execute({
        title: "Notizia link pericoloso",
        slug: "notizia-link-pericoloso",
        contentJson: JSON.stringify({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Click", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }]
            }
          ]
        }),
        status: "draft"
      })
    ).rejects.toMatchObject({ fieldErrors: { content: "Il link contiene un protocollo non consentito." } });
  });

  it("converts legacy plain text into a structured document", () => {
    const document = newsPostContentDocumentFromText("Primo paragrafo.\n\nSecondo paragrafo.");

    expect(parseNewsPostContentDocument(JSON.stringify(document))).toMatchObject({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Primo paragrafo." }] },
        { type: "paragraph", content: [{ type: "text", text: "Secondo paragrafo." }] }
      ]
    });
  });

  it("validates featured image alt text when image is provided", async () => {
    const repository = new InMemoryNewsPostRepository();

    await expect(
      new CreateNewsPostUseCase({ newsPostRepository: repository }).execute({
        title: "Notizia con immagine",
        slug: "notizia-con-immagine",
        featuredImageUrl: "/news/test.svg",
        content: "Contenuto con immagine.",
        status: "draft"
      })
    ).rejects.toMatchObject({
      fieldErrors: { featuredImageAlt: "Inserisci un testo alternativo per l'immagine." }
    });
  });

  it("normalizes url-safe slugs", () => {
    expect(normalizeNewsPostSlug("  È arrivata una Novità!  ")).toBe("e-arrivata-una-novita");
  });
});

class InMemoryNewsPostRepository implements NewsPostRepository {
  private posts = new Map<string, NewsPostDetails>();

  async create(post: NewNewsPost): Promise<NewsPostDetails> {
    this.posts.set(post.id, post);
    return post;
  }

  async update(post: NewsPostUpdate): Promise<NewsPostDetails | null> {
    const existing = this.posts.get(post.id);
    if (!existing) return null;
    const updated = { ...existing, ...post };
    this.posts.set(post.id, updated);
    return updated;
  }

  async findById(postId: string): Promise<NewsPostDetails | null> {
    return this.posts.get(postId) ?? null;
  }

  async findBySlug(slug: string): Promise<NewsPostDetails | null> {
    return [...this.posts.values()].find((post) => post.slug === slug) ?? null;
  }

  async listAdmin(): Promise<NewsPostDetails[]> {
    return [...this.posts.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listPublished(limit?: number): Promise<NewsPostDetails[]> {
    const posts = [...this.posts.values()]
      .filter((post) => post.status === "published" && post.publishedAt)
      .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));
    return typeof limit === "number" ? posts.slice(0, limit) : posts;
  }

  async findPublishedBySlug(slug: string): Promise<NewsPostDetails | null> {
    const post = await this.findBySlug(slug);
    return post?.status === "published" && post.publishedAt ? post : null;
  }
}

function makePost(overrides: Partial<NewsPostDetails>): NewsPostDetails {
  const now = new Date("2026-01-01T10:00:00.000Z");
  return {
    id: "post",
    title: "Titolo",
    slug: "titolo",
    excerpt: null,
    featuredImageUrl: null,
    featuredImageAlt: null,
    content: "Contenuto",
    contentJson: newsPostContentDocumentFromText("Contenuto"),
    status: "draft",
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

import { beforeEach, describe, expect, it } from "vitest";
import type {
  CategoryDetails,
  CategoryListItem,
  CategoryRepository,
  CategoryUpdate,
  NewCategory
} from "./category-repository";
import {
  CreateCategoryUseCase,
  DuplicateCategorySlugError,
  ListCategoriesUseCase,
  SetCategoryActiveStateUseCase,
  UpdateCategoryUseCase,
  normalizeCategorySlug
} from "./manage-categories";

describe("category management use cases", () => {
  let repository: InMemoryCategoryRepository;

  beforeEach(() => {
    repository = new InMemoryCategoryRepository();
  });

  it("creates a valid active category by default", async () => {
    const result = await new CreateCategoryUseCase({
      categoryRepository: repository,
      createId: () => "category-1",
      now: () => new Date("2026-01-01T10:00:00.000Z")
    }).execute({ name: "  Verde pubblico  ", slug: "Verde Pubblico" });

    expect(result).toMatchObject({
      id: "category-1",
      name: "Verde pubblico",
      slug: "verde-pubblico",
      active: true
    });
  });

  it("rejects duplicate slugs", async () => {
    await repository.create(category({ id: "existing", slug: "verde-pubblico" }));

    await expect(
      new CreateCategoryUseCase({ categoryRepository: repository }).execute({
        name: "Verde pubblico",
        slug: "verde-pubblico"
      })
    ).rejects.toBeInstanceOf(DuplicateCategorySlugError);
  });

  it("rejects invalid category data", async () => {
    await expect(
      new CreateCategoryUseCase({ categoryRepository: repository }).execute({
        name: " ",
        slug: " "
      })
    ).rejects.toMatchObject({
      fieldErrors: {
        name: "Inserisci il nome della categoria.",
        slug: "Inserisci lo slug della categoria."
      }
    });
  });

  it("updates category name and slug without changing its id", async () => {
    await repository.create(category({ id: "category-1", name: "Strade", slug: "strade" }));

    const result = await new UpdateCategoryUseCase({
      categoryRepository: repository,
      now: () => new Date("2026-01-02T10:00:00.000Z")
    }).execute({ id: "category-1", name: "Strade e buche", slug: "strade-buche", active: true });

    expect(result).toMatchObject({
      id: "category-1",
      name: "Strade e buche",
      slug: "strade-buche",
      active: true,
      updatedAt: new Date("2026-01-02T10:00:00.000Z")
    });
  });

  it("deactivates and reactivates categories", async () => {
    await repository.create(category({ id: "category-1", active: true }));
    const useCase = new SetCategoryActiveStateUseCase({ categoryRepository: repository });

    await expect(useCase.execute({ id: "category-1", active: false })).resolves.toMatchObject({ active: false });
    await expect(useCase.execute({ id: "category-1", active: true })).resolves.toMatchObject({ active: true });
  });

  it("lists all categories with inactive ones preserved", async () => {
    await repository.create(category({ id: "active", name: "Attiva", slug: "attiva", active: true }));
    await repository.create(category({ id: "inactive", name: "Disattivata", slug: "disattivata", active: false }));

    const result = await new ListCategoriesUseCase({ categoryRepository: repository }).execute();

    expect(result.map((item) => ({ id: item.id, active: item.active }))).toEqual([
      { id: "active", active: true },
      { id: "inactive", active: false }
    ]);
  });

  it("keeps inactive categories unavailable for new report selection", async () => {
    await repository.create(category({ id: "inactive", active: false }));

    await expect(repository.findActiveById("inactive")).resolves.toBeNull();
  });

  it("normalizes accented names into stable slugs", () => {
    expect(normalizeCategorySlug("Rifiuti / Igiene urbana")).toBe("rifiuti-igiene-urbana");
    expect(normalizeCategorySlug("Illuminazione pubblica")).toBe("illuminazione-pubblica");
  });
});

function category(overrides: Partial<CategoryDetails> = {}): CategoryDetails {
  const now = new Date("2026-01-01T10:00:00.000Z");

  return {
    id: "category-id",
    name: "Categoria test",
    slug: "categoria-test",
    active: true,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

class InMemoryCategoryRepository implements CategoryRepository {
  private readonly categories = new Map<string, CategoryDetails>();

  async listActive() {
    return [...this.categories.values()]
      .filter((category) => category.active)
      .map(({ id, name, slug }) => ({ id, name, slug }));
  }

  async listAll(): Promise<CategoryListItem[]> {
    return [...this.categories.values()].map((category) => ({ ...category, reportCount: 0 }));
  }

  async findActiveById(categoryId: string) {
    const category = this.categories.get(categoryId);

    if (!category?.active) {
      return null;
    }

    return { id: category.id, name: category.name, slug: category.slug };
  }

  async findById(categoryId: string) {
    return this.categories.get(categoryId) ?? null;
  }

  async findBySlug(slug: string) {
    return [...this.categories.values()].find((category) => category.slug === slug) ?? null;
  }

  async create(category: NewCategory) {
    this.categories.set(category.id, category);

    return category;
  }

  async update(category: CategoryUpdate) {
    const existingCategory = this.categories.get(category.id);

    if (!existingCategory) {
      return null;
    }

    const updatedCategory = {
      ...existingCategory,
      name: category.name,
      slug: category.slug,
      active: category.active,
      updatedAt: category.updatedAt
    };
    this.categories.set(category.id, updatedCategory);

    return updatedCategory;
  }
}

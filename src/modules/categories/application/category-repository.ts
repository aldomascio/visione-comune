export type CategoryOption = {
  id: string;
  name: string;
  slug: string;
};

export type CategoryDetails = CategoryOption & {
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CategoryListItem = CategoryDetails & {
  reportCount: number;
};

export type NewCategory = CategoryDetails;

export type CategoryUpdate = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  updatedAt: Date;
};

export class DuplicateCategorySlugPersistenceError extends Error {
  constructor(slug: string) {
    super(`Category slug already exists: ${slug}`);
    this.name = "DuplicateCategorySlugPersistenceError";
  }
}

export type CategoryRepository = {
  listActive(): Promise<CategoryOption[]>;
  listAll(): Promise<CategoryListItem[]>;
  findActiveById(categoryId: string): Promise<CategoryOption | null>;
  findById(categoryId: string): Promise<CategoryDetails | null>;
  findBySlug(slug: string): Promise<CategoryDetails | null>;
  create(category: NewCategory): Promise<CategoryDetails>;
  update(category: CategoryUpdate): Promise<CategoryDetails | null>;
};

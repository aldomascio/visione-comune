export type CategoryOption = {
  id: string;
  name: string;
  slug: string;
};

export type CategoryRepository = {
  listActive(): Promise<CategoryOption[]>;
  findActiveById(categoryId: string): Promise<CategoryOption | null>;
};

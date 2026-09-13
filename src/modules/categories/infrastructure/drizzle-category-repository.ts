import { asc, and, eq } from "drizzle-orm";
import type { Database } from "@/shared/db/client";
import { categories } from "@/shared/db/schema";
import type { CategoryOption, CategoryRepository } from "../application/category-repository";

export class DrizzleCategoryRepository implements CategoryRepository {
  constructor(private readonly db: Database) {}

  async listActive(): Promise<CategoryOption[]> {
    return this.db
      .select({ id: categories.id, name: categories.name, slug: categories.slug })
      .from(categories)
      .where(eq(categories.active, true))
      .orderBy(asc(categories.name));
  }

  async findById(categoryId: string): Promise<CategoryOption | null> {
    const [category] = await this.db
      .select({ id: categories.id, name: categories.name, slug: categories.slug })
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

    return category ?? null;
  }

  async findActiveById(categoryId: string): Promise<CategoryOption | null> {
    const [category] = await this.db
      .select({ id: categories.id, name: categories.name, slug: categories.slug })
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.active, true)))
      .limit(1);

    return category ?? null;
  }
}

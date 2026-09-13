import { asc, desc, and, eq, sql } from "drizzle-orm";
import type { Database } from "@/shared/db/client";
import { categories, reports } from "@/shared/db/schema";
import {
  DuplicateCategorySlugPersistenceError,
  type CategoryDetails,
  type CategoryListItem,
  type CategoryOption,
  type CategoryRepository,
  type CategoryUpdate,
  type NewCategory
} from "../application/category-repository";

export class DrizzleCategoryRepository implements CategoryRepository {
  constructor(private readonly db: Database) {}

  async listActive(): Promise<CategoryOption[]> {
    return this.db
      .select({ id: categories.id, name: categories.name, slug: categories.slug })
      .from(categories)
      .where(eq(categories.active, true))
      .orderBy(asc(categories.name));
  }

  async listAll(): Promise<CategoryListItem[]> {
    const rows = await this.db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        active: categories.active,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt,
        reportCount: sql<number>`count(${reports.id})`
      })
      .from(categories)
      .leftJoin(reports, eq(reports.categoryId, categories.id))
      .groupBy(
        categories.id,
        categories.name,
        categories.slug,
        categories.active,
        categories.createdAt,
        categories.updatedAt
      )
      .orderBy(desc(categories.active), asc(categories.name));

    return rows.map((row) => ({ ...row, reportCount: Number(row.reportCount) }));
  }

  async findById(categoryId: string): Promise<CategoryDetails | null> {
    const [category] = await this.db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        active: categories.active,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt
      })
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

    return category ?? null;
  }

  async findBySlug(slug: string): Promise<CategoryDetails | null> {
    const [category] = await this.db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        active: categories.active,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt
      })
      .from(categories)
      .where(eq(categories.slug, slug))
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

  async create(category: NewCategory): Promise<CategoryDetails> {
    try {
      const [createdCategory] = await this.db.insert(categories).values(category).returning({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        active: categories.active,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt
      });

      if (!createdCategory) {
        throw new Error("Category insert did not return a row.");
      }

      return createdCategory;
    } catch (error) {
      if (isCategorySlugUniqueViolation(error)) {
        throw new DuplicateCategorySlugPersistenceError(category.slug);
      }

      throw error;
    }
  }

  async update(category: CategoryUpdate): Promise<CategoryDetails | null> {
    try {
      const [updatedCategory] = await this.db
        .update(categories)
        .set({
          name: category.name,
          slug: category.slug,
          active: category.active,
          updatedAt: category.updatedAt
        })
        .where(eq(categories.id, category.id))
        .returning({
          id: categories.id,
          name: categories.name,
          slug: categories.slug,
          active: categories.active,
          createdAt: categories.createdAt,
          updatedAt: categories.updatedAt
        });

      return updatedCategory ?? null;
    } catch (error) {
      if (isCategorySlugUniqueViolation(error)) {
        throw new DuplicateCategorySlugPersistenceError(category.slug);
      }

      throw error;
    }
  }
}

function isCategorySlugUniqueViolation(error: unknown): boolean {
  const postgresError = getPostgresError(error);

  return postgresError?.code === "23505" && postgresError.constraint_name === "categories_slug_unique";
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

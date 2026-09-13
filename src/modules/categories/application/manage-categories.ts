import { randomUUID } from "node:crypto";
import {
  DuplicateCategorySlugPersistenceError,
  type CategoryDetails,
  type CategoryListItem,
  type CategoryRepository
} from "./category-repository";

export const CATEGORY_NAME_MAX_LENGTH = 160;
export const CATEGORY_SLUG_MAX_LENGTH = 120;
export const CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type CategoryFieldErrors = {
  name?: string;
  slug?: string;
  active?: string;
};

export class CategoryValidationError extends Error {
  constructor(readonly fieldErrors: CategoryFieldErrors) {
    super("Category validation failed.");
    this.name = "CategoryValidationError";
  }
}

export class DuplicateCategorySlugError extends Error {
  constructor(readonly slug: string) {
    super(`Category slug already exists: ${slug}`);
    this.name = "DuplicateCategorySlugError";
  }
}

export class CategoryNotFoundError extends Error {
  constructor(readonly categoryId: string) {
    super(`Category not found: ${categoryId}`);
    this.name = "CategoryNotFoundError";
  }
}

export type CategoryFormInput = {
  name: string;
  slug: string;
  active?: boolean | string;
};

export type CreateCategoryInput = CategoryFormInput;
export type UpdateCategoryInput = CategoryFormInput & { id: string };

export type ListCategoriesUseCaseDependencies = {
  categoryRepository: CategoryRepository;
};

export class ListCategoriesUseCase {
  constructor(private readonly dependencies: ListCategoriesUseCaseDependencies) {}

  execute(): Promise<CategoryListItem[]> {
    return this.dependencies.categoryRepository.listAll();
  }
}

export type CreateCategoryUseCaseDependencies = ListCategoriesUseCaseDependencies & {
  createId?: () => string;
  now?: () => Date;
};

export class CreateCategoryUseCase {
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(private readonly dependencies: CreateCategoryUseCaseDependencies) {
    this.createId = dependencies.createId ?? (() => randomUUID());
    this.now = dependencies.now ?? (() => new Date());
  }

  async execute(input: CreateCategoryInput): Promise<CategoryDetails> {
    const values = validateCategoryInput(input);
    await ensureSlugAvailable(this.dependencies.categoryRepository, values.slug);

    const now = this.now();

    try {
      return await this.dependencies.categoryRepository.create({
        id: this.createId(),
        name: values.name,
        slug: values.slug,
        active: values.active ?? true,
        createdAt: now,
        updatedAt: now
      });
    } catch (error) {
      if (error instanceof DuplicateCategorySlugPersistenceError) {
        throw new DuplicateCategorySlugError(values.slug);
      }

      throw error;
    }
  }
}

export type UpdateCategoryUseCaseDependencies = ListCategoriesUseCaseDependencies & {
  now?: () => Date;
};

export class UpdateCategoryUseCase {
  private readonly now: () => Date;

  constructor(private readonly dependencies: UpdateCategoryUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async execute(input: UpdateCategoryInput): Promise<CategoryDetails> {
    const values = validateCategoryInput(input);
    const existingCategory = await this.dependencies.categoryRepository.findById(input.id);

    if (!existingCategory) {
      throw new CategoryNotFoundError(input.id);
    }

    await ensureSlugAvailable(this.dependencies.categoryRepository, values.slug, input.id);

    try {
      const updatedCategory = await this.dependencies.categoryRepository.update({
        id: input.id,
        name: values.name,
        slug: values.slug,
        active: values.active ?? existingCategory.active,
        updatedAt: this.now()
      });

      if (!updatedCategory) {
        throw new CategoryNotFoundError(input.id);
      }

      return updatedCategory;
    } catch (error) {
      if (error instanceof DuplicateCategorySlugPersistenceError) {
        throw new DuplicateCategorySlugError(values.slug);
      }

      throw error;
    }
  }
}

export type SetCategoryActiveStateInput = {
  id: string;
  active: boolean;
};

export class SetCategoryActiveStateUseCase {
  private readonly now: () => Date;

  constructor(private readonly dependencies: UpdateCategoryUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async execute(input: SetCategoryActiveStateInput): Promise<CategoryDetails> {
    const existingCategory = await this.dependencies.categoryRepository.findById(input.id);

    if (!existingCategory) {
      throw new CategoryNotFoundError(input.id);
    }

    const updatedCategory = await this.dependencies.categoryRepository.update({
      id: input.id,
      name: existingCategory.name,
      slug: existingCategory.slug,
      active: input.active,
      updatedAt: this.now()
    });

    if (!updatedCategory) {
      throw new CategoryNotFoundError(input.id);
    }

    return updatedCategory;
  }
}

export function validateCategoryInput(input: CategoryFormInput): {
  name: string;
  slug: string;
  active?: boolean;
} {
  const name = normalizeCategoryName(input.name);
  const slug = normalizeCategorySlug(input.slug);
  const fieldErrors: CategoryFieldErrors = {};

  if (!name) {
    fieldErrors.name = "Inserisci il nome della categoria.";
  } else if (name.length > CATEGORY_NAME_MAX_LENGTH) {
    fieldErrors.name = `Il nome non puo superare ${CATEGORY_NAME_MAX_LENGTH} caratteri.`;
  }

  if (!slug) {
    fieldErrors.slug = "Inserisci lo slug della categoria.";
  } else if (slug.length > CATEGORY_SLUG_MAX_LENGTH) {
    fieldErrors.slug = `Lo slug non puo superare ${CATEGORY_SLUG_MAX_LENGTH} caratteri.`;
  } else if (!CATEGORY_SLUG_PATTERN.test(slug)) {
    fieldErrors.slug = "Usa solo lettere minuscole, numeri e trattini, senza spazi iniziali o finali.";
  }

  const active = parseActiveValue(input.active);

  if (active === null) {
    fieldErrors.active = "Seleziona uno stato valido.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new CategoryValidationError(fieldErrors);
  }

  return {
    name,
    slug,
    ...(typeof active === "boolean" ? { active } : {})
  };
}

export function normalizeCategoryName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeCategorySlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function mapCategoryManagementErrorToMessage(error: unknown): string {
  if (error instanceof CategoryValidationError) {
    return "Controlla i campi evidenziati.";
  }

  if (error instanceof DuplicateCategorySlugError) {
    return "Esiste gia una categoria con questo slug.";
  }

  if (error instanceof CategoryNotFoundError) {
    return "Categoria non trovata.";
  }

  return "Si e verificato un errore inatteso. Riprova tra poco.";
}

async function ensureSlugAvailable(
  categoryRepository: CategoryRepository,
  slug: string,
  allowedCategoryId?: string
): Promise<void> {
  const categoryWithSameSlug = await categoryRepository.findBySlug(slug);

  if (categoryWithSameSlug && categoryWithSameSlug.id !== allowedCategoryId) {
    throw new DuplicateCategorySlugError(slug);
  }
}

function parseActiveValue(value: boolean | string | undefined): boolean | null | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "undefined" || value === "") {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

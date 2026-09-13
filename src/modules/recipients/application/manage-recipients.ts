import { randomUUID } from "node:crypto";
import type { CategoryRepository } from "@/modules/categories/application/category-repository";
import {
  DuplicateRecipientContactPersistenceError,
  type CategoryRecipient,
  type CategoryRecipientAssociation,
  type CategoryRecipientRepository,
  type Recipient,
  type RecipientListItem,
  type RecipientRepository
} from "./recipient-repository";

export const RECIPIENT_NAME_MAX_LENGTH = 160;
export const RECIPIENT_ORGANIZATION_MAX_LENGTH = 200;
export const RECIPIENT_CONTACT_MAX_LENGTH = 320;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RecipientFieldErrors = {
  name?: string;
  organization?: string;
  email?: string;
  pec?: string;
  active?: string;
};

export class RecipientValidationError extends Error {
  constructor(readonly fieldErrors: RecipientFieldErrors) {
    super("Recipient validation failed.");
    this.name = "RecipientValidationError";
  }
}

export class DuplicateRecipientContactError extends Error {
  constructor(readonly field: "email" | "pec", readonly value: string) {
    super(`Recipient ${field} already exists: ${value}`);
    this.name = "DuplicateRecipientContactError";
  }
}

export class RecipientNotFoundError extends Error {
  constructor(readonly recipientId: string) {
    super(`Recipient not found: ${recipientId}`);
    this.name = "RecipientNotFoundError";
  }
}

export class CategoryForRoutingNotFoundError extends Error {
  constructor(readonly categoryId: string) {
    super(`Category not found for routing: ${categoryId}`);
    this.name = "CategoryForRoutingNotFoundError";
  }
}

export class InvalidCategoryRecipientAssociationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCategoryRecipientAssociationError";
  }
}

export type RecipientFormInput = {
  name: string;
  organization: string;
  email?: string;
  pec?: string;
  active?: boolean | string;
};

export type CreateRecipientInput = RecipientFormInput;
export type UpdateRecipientInput = RecipientFormInput & { id: string };

export class ListRecipientsUseCase {
  constructor(private readonly dependencies: { recipientRepository: RecipientRepository }) {}

  execute(): Promise<RecipientListItem[]> {
    return this.dependencies.recipientRepository.listAll();
  }
}

export class CreateRecipientUseCase {
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(private readonly dependencies: {
    recipientRepository: RecipientRepository;
    createId?: () => string;
    now?: () => Date;
  }) {
    this.createId = dependencies.createId ?? (() => randomUUID());
    this.now = dependencies.now ?? (() => new Date());
  }

  async execute(input: CreateRecipientInput): Promise<Recipient> {
    const values = validateRecipientInput(input);
    await ensureContactAvailable(this.dependencies.recipientRepository, values);
    const now = this.now();

    try {
      return await this.dependencies.recipientRepository.create({
        id: this.createId(),
        name: values.name,
        organization: values.organization,
        ...(values.email ? { email: values.email } : {}),
        ...(values.pec ? { pec: values.pec } : {}),
        active: values.active ?? true,
        createdAt: now,
        updatedAt: now
      });
    } catch (error) {
      if (error instanceof DuplicateRecipientContactPersistenceError) {
        throw new DuplicateRecipientContactError(error.field, error.value);
      }

      throw error;
    }
  }
}

export class UpdateRecipientUseCase {
  private readonly now: () => Date;

  constructor(private readonly dependencies: {
    recipientRepository: RecipientRepository;
    now?: () => Date;
  }) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async execute(input: UpdateRecipientInput): Promise<Recipient> {
    const existingRecipient = await this.dependencies.recipientRepository.findById(input.id);

    if (!existingRecipient) {
      throw new RecipientNotFoundError(input.id);
    }

    const values = validateRecipientInput(input);
    await ensureContactAvailable(this.dependencies.recipientRepository, values, input.id);

    try {
      const updatedRecipient = await this.dependencies.recipientRepository.update({
        id: input.id,
        name: values.name,
        organization: values.organization,
        ...(values.email ? { email: values.email } : {}),
        ...(values.pec ? { pec: values.pec } : {}),
        active: values.active ?? existingRecipient.active,
        updatedAt: this.now()
      });

      if (!updatedRecipient) {
        throw new RecipientNotFoundError(input.id);
      }

      return updatedRecipient;
    } catch (error) {
      if (error instanceof DuplicateRecipientContactPersistenceError) {
        throw new DuplicateRecipientContactError(error.field, error.value);
      }

      throw error;
    }
  }
}

export class SetRecipientActiveStateUseCase {
  private readonly now: () => Date;

  constructor(private readonly dependencies: {
    recipientRepository: RecipientRepository;
    now?: () => Date;
  }) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async execute(input: { id: string; active: boolean }): Promise<Recipient> {
    const existingRecipient = await this.dependencies.recipientRepository.findById(input.id);

    if (!existingRecipient) {
      throw new RecipientNotFoundError(input.id);
    }

    const updatedRecipient = await this.dependencies.recipientRepository.update({
      id: existingRecipient.id,
      name: existingRecipient.name,
      organization: existingRecipient.organization,
      ...(existingRecipient.email ? { email: existingRecipient.email } : {}),
      ...(existingRecipient.pec ? { pec: existingRecipient.pec } : {}),
      active: input.active,
      updatedAt: this.now()
    });

    if (!updatedRecipient) {
      throw new RecipientNotFoundError(input.id);
    }

    return updatedRecipient;
  }
}

export class GetCategoryRecipientsUseCase {
  constructor(private readonly dependencies: { categoryRecipientRepository: CategoryRecipientRepository }) {}

  execute(input: { categoryId: string }): Promise<CategoryRecipient[]> {
    return this.dependencies.categoryRecipientRepository.listByCategory(input.categoryId);
  }
}

export class UpdateCategoryRecipientsUseCase {
  constructor(private readonly dependencies: {
    categoryRepository: CategoryRepository;
    recipientRepository: RecipientRepository;
    categoryRecipientRepository: CategoryRecipientRepository;
  }) {}

  async execute(input: { categoryId: string; recipientIds: string[]; primaryRecipientId?: string }): Promise<void> {
    const category = await this.dependencies.categoryRepository.findById(input.categoryId);

    if (!category) {
      throw new CategoryForRoutingNotFoundError(input.categoryId);
    }

    const recipientIds = uniqueNonEmpty(input.recipientIds);
    const primaryRecipientId = input.primaryRecipientId?.trim() || recipientIds[0];

    if (primaryRecipientId && !recipientIds.includes(primaryRecipientId)) {
      throw new InvalidCategoryRecipientAssociationError("Il destinatario principale deve essere tra quelli associati.");
    }

    for (const recipientId of recipientIds) {
      const recipient = await this.dependencies.recipientRepository.findById(recipientId);

      if (!recipient) {
        throw new InvalidCategoryRecipientAssociationError("Uno dei destinatari selezionati non esiste.");
      }
    }

    const associations: CategoryRecipientAssociation[] = recipientIds.map((recipientId, index) => ({
      recipientId,
      sortOrder: recipientId === primaryRecipientId ? 0 : index + 1
    })).sort((left, right) => left.sortOrder - right.sortOrder || left.recipientId.localeCompare(right.recipientId));

    await this.dependencies.categoryRecipientRepository.replaceAssociations(input.categoryId, associations);
  }
}

export class GetPreferredRecipientForCategoryUseCase {
  constructor(private readonly dependencies: { categoryRecipientRepository: CategoryRecipientRepository }) {}

  execute(input: { categoryId: string }): Promise<CategoryRecipient | null> {
    return this.dependencies.categoryRecipientRepository.getPreferred(input.categoryId);
  }
}

export function validateRecipientInput(input: RecipientFormInput): {
  name: string;
  organization: string;
  email?: string;
  pec?: string;
  active?: boolean;
} {
  const name = normalizeText(input.name);
  const organization = normalizeText(input.organization);
  const email = normalizeEmail(input.email ?? "");
  const pec = normalizeEmail(input.pec ?? "");
  const active = parseActiveValue(input.active);
  const fieldErrors: RecipientFieldErrors = {};

  if (!name) fieldErrors.name = "Inserisci il nome del destinatario.";
  else if (name.length > RECIPIENT_NAME_MAX_LENGTH) fieldErrors.name = `Il nome non puo superare ${RECIPIENT_NAME_MAX_LENGTH} caratteri.`;

  if (!organization) fieldErrors.organization = "Inserisci l'ente o organizzazione.";
  else if (organization.length > RECIPIENT_ORGANIZATION_MAX_LENGTH) fieldErrors.organization = `L'ente non puo superare ${RECIPIENT_ORGANIZATION_MAX_LENGTH} caratteri.`;

  if (!email && !pec) {
    fieldErrors.email = "Inserisci almeno un indirizzo email o PEC.";
    fieldErrors.pec = "Inserisci almeno un indirizzo email o PEC.";
  }

  if (email && (email.length > RECIPIENT_CONTACT_MAX_LENGTH || !EMAIL_PATTERN.test(email))) {
    fieldErrors.email = "Inserisci un indirizzo email valido.";
  }

  if (pec && (pec.length > RECIPIENT_CONTACT_MAX_LENGTH || !EMAIL_PATTERN.test(pec))) {
    fieldErrors.pec = "Inserisci un indirizzo PEC sintatticamente valido.";
  }

  if (active === null) fieldErrors.active = "Seleziona uno stato valido.";

  if (Object.keys(fieldErrors).length > 0) {
    throw new RecipientValidationError(fieldErrors);
  }

  return {
    name,
    organization,
    ...(email ? { email } : {}),
    ...(pec ? { pec } : {}),
    ...(typeof active === "boolean" ? { active } : {})
  };
}

export function mapRecipientManagementErrorToMessage(error: unknown): string {
  if (error instanceof RecipientValidationError) return "Controlla i campi evidenziati.";
  if (error instanceof DuplicateRecipientContactError) return error.field === "email" ? "Esiste gia un destinatario con questa email." : "Esiste gia un destinatario con questa PEC.";
  if (error instanceof RecipientNotFoundError) return "Destinatario non trovato.";
  if (error instanceof CategoryForRoutingNotFoundError) return "Categoria non trovata.";
  if (error instanceof InvalidCategoryRecipientAssociationError) return error.message;
  return "Si e verificato un errore inatteso. Riprova tra poco.";
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function parseActiveValue(value: boolean | string | undefined): boolean | null | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "undefined" || value === "") return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

async function ensureContactAvailable(
  repository: RecipientRepository,
  values: { email?: string; pec?: string },
  allowedRecipientId?: string
): Promise<void> {
  if (values.email) {
    const recipient = await repository.findByEmail(values.email);
    if (recipient && recipient.id !== allowedRecipientId) {
      throw new DuplicateRecipientContactError("email", values.email);
    }
  }

  if (values.pec) {
    const recipient = await repository.findByPec(values.pec);
    if (recipient && recipient.id !== allowedRecipientId) {
      throw new DuplicateRecipientContactError("pec", values.pec);
    }
  }
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

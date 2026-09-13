import { asc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@/shared/db/client";
import { categories, categoryRecipients, recipients } from "@/shared/db/schema";
import {
  DuplicateRecipientContactPersistenceError,
  type CategoryRecipient,
  type CategoryRecipientAssociation,
  type CategoryRecipientRepository,
  type NewRecipient,
  type Recipient,
  type RecipientListItem,
  type RecipientRepository,
  type RecipientUpdate
} from "../application/recipient-repository";

export class DrizzleRecipientRepository implements RecipientRepository, CategoryRecipientRepository {
  constructor(private readonly db: Database) {}

  async listAll(): Promise<RecipientListItem[]> {
    const recipientRows = await this.db
      .select()
      .from(recipients)
      .orderBy(asc(recipients.organization), asc(recipients.name));

    if (recipientRows.length === 0) {
      return [];
    }

    const rows = await this.db
      .select({
        recipientId: categoryRecipients.recipientId,
        categoryId: categories.id,
        categoryName: categories.name,
        categoryActive: categories.active
      })
      .from(categoryRecipients)
      .innerJoin(categories, eq(categoryRecipients.categoryId, categories.id))
      .where(inArray(categoryRecipients.recipientId, recipientRows.map((recipient) => recipient.id)))
      .orderBy(asc(categories.name));

    const categoriesByRecipient = new Map<string, RecipientListItem["categories"]>();
    for (const row of rows) {
      const list = categoriesByRecipient.get(row.recipientId) ?? [];
      list.push({ id: row.categoryId, name: row.categoryName, active: row.categoryActive });
      categoriesByRecipient.set(row.recipientId, list);
    }

    return recipientRows.map((recipient) => ({
      ...toRecipient(recipient),
      categories: categoriesByRecipient.get(recipient.id) ?? []
    }));
  }

  async findById(recipientId: string): Promise<Recipient | null> {
    const [recipient] = await this.db.select().from(recipients).where(eq(recipients.id, recipientId)).limit(1);
    return recipient ? toRecipient(recipient) : null;
  }

  async findByEmail(email: string): Promise<Recipient | null> {
    const [recipient] = await this.db.select().from(recipients).where(eq(recipients.email, email)).limit(1);
    return recipient ? toRecipient(recipient) : null;
  }

  async findByPec(pec: string): Promise<Recipient | null> {
    const [recipient] = await this.db.select().from(recipients).where(eq(recipients.pec, pec)).limit(1);
    return recipient ? toRecipient(recipient) : null;
  }

  async create(recipient: NewRecipient): Promise<Recipient> {
    try {
      const [createdRecipient] = await this.db.insert(recipients).values(toRecipientRecord(recipient)).returning();
      if (!createdRecipient) throw new Error("Recipient insert did not return a row.");
      return toRecipient(createdRecipient);
    } catch (error) {
      const duplicate = getDuplicateContact(error, recipient);
      if (duplicate) throw duplicate;
      throw error;
    }
  }

  async update(recipient: RecipientUpdate): Promise<Recipient | null> {
    try {
      const [updatedRecipient] = await this.db
        .update(recipients)
        .set({
          name: recipient.name,
          organization: recipient.organization,
          email: recipient.email ?? null,
          pec: recipient.pec ?? null,
          active: recipient.active,
          updatedAt: recipient.updatedAt
        })
        .where(eq(recipients.id, recipient.id))
        .returning();
      return updatedRecipient ? toRecipient(updatedRecipient) : null;
    } catch (error) {
      const duplicate = getDuplicateContact(error, recipient);
      if (duplicate) throw duplicate;
      throw error;
    }
  }

  async findActiveByCategory(categoryId: string): Promise<CategoryRecipient[]> {
    return this.listCategoryRecipients(categoryId, true);
  }

  async listByCategory(categoryId: string): Promise<CategoryRecipient[]> {
    return this.listCategoryRecipients(categoryId, false);
  }

  async getPreferred(categoryId: string): Promise<CategoryRecipient | null> {
    const [recipient] = await this.listCategoryRecipients(categoryId, true, 1);
    return recipient ?? null;
  }

  async replaceAssociations(categoryId: string, associations: CategoryRecipientAssociation[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(categoryRecipients).where(eq(categoryRecipients.categoryId, categoryId));

      if (associations.length > 0) {
        const now = new Date();
        await tx.insert(categoryRecipients).values(associations.map((association) => ({
          categoryId,
          recipientId: association.recipientId,
          sortOrder: association.sortOrder,
          createdAt: now,
          updatedAt: now
        })));
      }
    });
  }

  private async listCategoryRecipients(categoryId: string, activeOnly: boolean, limit?: number): Promise<CategoryRecipient[]> {
    const query = this.db
      .select({
        id: recipients.id,
        name: recipients.name,
        organization: recipients.organization,
        email: recipients.email,
        pec: recipients.pec,
        active: recipients.active,
        createdAt: recipients.createdAt,
        updatedAt: recipients.updatedAt,
        sortOrder: categoryRecipients.sortOrder
      })
      .from(categoryRecipients)
      .innerJoin(recipients, eq(categoryRecipients.recipientId, recipients.id))
      .where(activeOnly ? sql`${categoryRecipients.categoryId} = ${categoryId} and ${recipients.active} = true` : eq(categoryRecipients.categoryId, categoryId))
      .orderBy(asc(categoryRecipients.sortOrder), asc(recipients.organization), asc(recipients.name));

    const rows = typeof limit === "number" ? await query.limit(limit) : await query;

    return rows.map((row) => ({ ...toRecipient(row), sortOrder: row.sortOrder }));
  }
}

function toRecipient(record: {
  id: string;
  name: string;
  organization: string;
  email: string | null;
  pec: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}): Recipient {
  return {
    id: record.id,
    name: record.name,
    organization: record.organization,
    ...(record.email ? { email: record.email } : {}),
    ...(record.pec ? { pec: record.pec } : {}),
    active: record.active,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function toRecipientRecord(recipient: NewRecipient) {
  return {
    id: recipient.id,
    name: recipient.name,
    organization: recipient.organization,
    email: recipient.email ?? null,
    pec: recipient.pec ?? null,
    active: recipient.active,
    createdAt: recipient.createdAt,
    updatedAt: recipient.updatedAt
  };
}

function getDuplicateContact(error: unknown, recipient: { email?: string; pec?: string }): DuplicateRecipientContactPersistenceError | null {
  const postgresError = getPostgresError(error);

  if (postgresError?.code !== "23505") return null;
  if (postgresError.constraint_name === "recipients_email_unique" && recipient.email) {
    return new DuplicateRecipientContactPersistenceError("email", recipient.email);
  }
  if (postgresError.constraint_name === "recipients_pec_unique" && recipient.pec) {
    return new DuplicateRecipientContactPersistenceError("pec", recipient.pec);
  }

  return null;
}

function getPostgresError(error: unknown): PostgresError | null {
  if (isPostgresError(error)) return error;
  if (typeof error === "object" && error !== null && "cause" in error) {
    const cause = (error as { cause?: unknown }).cause;
    if (isPostgresError(cause)) return cause;
  }
  return null;
}

type PostgresError = { code?: string; constraint_name?: string };
function isPostgresError(error: unknown): error is PostgresError {
  return typeof error === "object" && error !== null && "code" in error;
}

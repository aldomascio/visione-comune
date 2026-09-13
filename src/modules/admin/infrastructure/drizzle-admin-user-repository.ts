import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Database } from "@/shared/db/client";
import { adminUsers } from "@/shared/db/schema";
import {
  DuplicateAdminEmailError,
  normalizeAdminEmail,
  type AdminUser,
  type AdminUserRepository,
  type CreateAdminUserInput
} from "../application/admin-user-repository";

export class DrizzleAdminUserRepository implements AdminUserRepository {
  constructor(private readonly db: Database) {}

  async findByEmail(email: string): Promise<AdminUser | null> {
    const [record] = await this.db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, normalizeAdminEmail(email)))
      .limit(1);

    return record ?? null;
  }

  async findActiveById(adminUserId: string): Promise<AdminUser | null> {
    const [record] = await this.db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, adminUserId))
      .limit(1);

    return record?.active ? record : null;
  }

  async create(input: CreateAdminUserInput): Promise<AdminUser> {
    const now = new Date();
    const normalizedEmail = normalizeAdminEmail(input.email);

    try {
      const [record] = await this.db
        .insert(adminUsers)
        .values({
          id: randomUUID(),
          email: normalizedEmail,
          passwordHash: input.passwordHash,
          role: input.role ?? "admin",
          active: input.active ?? true,
          createdAt: now,
          updatedAt: now
        })
        .returning();

      if (!record) {
        throw new Error("Admin user was not created.");
      }

      return record;
    } catch (error) {
      if (isAdminEmailUniqueViolation(error)) {
        throw new DuplicateAdminEmailError(normalizedEmail);
      }

      throw error;
    }
  }
}

function isAdminEmailUniqueViolation(error: unknown): boolean {
  const postgresError = getPostgresError(error);

  return (
    postgresError?.code === "23505" &&
    postgresError.constraint_name === "admin_users_email_unique"
  );
}

type PostgresError = {
  code?: string;
  constraint_name?: string;
};

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

function isPostgresError(error: unknown): error is PostgresError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "constraint_name" in error
  );
}

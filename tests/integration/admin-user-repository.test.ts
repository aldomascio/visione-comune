import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DuplicateAdminEmailError, normalizeAdminEmail } from "@/modules/admin/application/admin-user-repository";
import { hashPassword } from "@/modules/admin/application/password-hashing";
import { DrizzleAdminUserRepository } from "@/modules/admin/infrastructure/drizzle-admin-user-repository";
import { createDatabaseConnection, type DatabaseConnection } from "@/shared/db/client";
import { adminUsers } from "@/shared/db/schema";

const maybeDescribe = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const testAdminEmail = "admin.integration@example.com";

maybeDescribe("DrizzleAdminUserRepository", () => {
  let connection: DatabaseConnection;
  let repository: DrizzleAdminUserRepository;

  beforeAll(async () => {
    connection = createDatabaseConnection(process.env.TEST_DATABASE_URL);
    await migrate(connection.db, { migrationsFolder: "drizzle" });
    repository = new DrizzleAdminUserRepository(connection.db);
  });

  beforeEach(async () => {
    await cleanupTestData(connection);
  });

  afterAll(async () => {
    if (connection) {
      await cleanupTestData(connection);
      await connection.close();
    }
  });

  it("normalizes email and creates an active admin", async () => {
    const passwordHash = await hashPassword("correct horse battery staple");

    const admin = await repository.create({
      email: " ADMIN.INTEGRATION@EXAMPLE.COM ",
      passwordHash
    });

    expect(admin).toMatchObject({
      email: testAdminEmail,
      role: "admin",
      active: true
    });
    expect(admin.passwordHash).toBe(passwordHash);
    expect(normalizeAdminEmail(" ADMIN.INTEGRATION@EXAMPLE.COM ")).toBe(testAdminEmail);
  });

  it("rejects duplicate normalized email", async () => {
    const passwordHash = await hashPassword("correct horse battery staple");
    await repository.create({ email: testAdminEmail, passwordHash });

    await expect(
      repository.create({ email: "ADMIN.INTEGRATION@EXAMPLE.COM", passwordHash })
    ).rejects.toThrow(DuplicateAdminEmailError);
  });

  it("does not return inactive admins from findActiveById", async () => {
    const passwordHash = await hashPassword("correct horse battery staple");
    const admin = await repository.create({ email: testAdminEmail, passwordHash, active: false });

    await expect(repository.findActiveById(admin.id)).resolves.toBeNull();
  });
});

async function cleanupTestData(connection: DatabaseConnection): Promise<void> {
  await connection.db.delete(adminUsers).where(sql`${adminUsers.email} = ${testAdminEmail}`);
}

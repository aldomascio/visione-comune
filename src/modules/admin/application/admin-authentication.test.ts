import { describe, expect, it } from "vitest";
import type { AdminUser, AdminUserRepository } from "./admin-user-repository";
import { authenticateAdminWithPassword } from "./admin-authentication";
import { hashPassword } from "./password-hashing";

describe("authenticateAdminWithPassword", () => {
  it("authenticates an active admin and exposes no password hash", async () => {
    const passwordHash = await hashPassword("correct horse battery staple");
    const repository = new InMemoryAdminUserRepository({ passwordHash });

    const result = await authenticateAdminWithPassword({
      email: " ADMIN@EXAMPLE.COM ",
      password: "correct horse battery staple",
      adminUserRepository: repository
    });

    expect(result).toEqual({ id: "admin-1", email: "admin@example.com", role: "admin" });
    expect(JSON.stringify(result)).not.toContain(passwordHash);
  });

  it("rejects an unknown email", async () => {
    const repository = new InMemoryAdminUserRepository(null);

    await expect(
      authenticateAdminWithPassword({
        email: "missing@example.com",
        password: "correct horse battery staple",
        adminUserRepository: repository
      })
    ).resolves.toBeNull();
  });

  it("rejects a wrong password", async () => {
    const passwordHash = await hashPassword("correct horse battery staple");
    const repository = new InMemoryAdminUserRepository({ passwordHash });

    await expect(
      authenticateAdminWithPassword({
        email: "admin@example.com",
        password: "wrong password",
        adminUserRepository: repository
      })
    ).resolves.toBeNull();
  });

  it("rejects an inactive admin", async () => {
    const passwordHash = await hashPassword("correct horse battery staple");
    const repository = new InMemoryAdminUserRepository({ passwordHash, active: false });

    await expect(
      authenticateAdminWithPassword({
        email: "admin@example.com",
        password: "correct horse battery staple",
        adminUserRepository: repository
      })
    ).resolves.toBeNull();
  });
});

class InMemoryAdminUserRepository implements AdminUserRepository {
  constructor(private readonly admin: { passwordHash: string; active?: boolean } | null) {}

  async findByEmail(email: string): Promise<AdminUser | null> {
    if (!this.admin || email !== "admin@example.com") {
      return null;
    }

    return {
      id: "admin-1",
      email: "admin@example.com",
      passwordHash: this.admin.passwordHash,
      role: "admin",
      active: this.admin.active ?? true,
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      updatedAt: new Date("2026-01-01T10:00:00.000Z")
    };
  }

  async findActiveById(): Promise<AdminUser | null> {
    return null;
  }

  async create(): Promise<AdminUser> {
    throw new Error("Not implemented.");
  }
}

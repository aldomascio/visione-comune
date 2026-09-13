import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password-hashing";

describe("admin password hashing", () => {
  it("hashes and verifies a password with Argon2id", async () => {
    const passwordHash = await hashPassword("correct horse battery staple");

    expect(passwordHash).toMatch(/^argon2id\$v=19\$m=65536,t=3,p=1\$/);
    await expect(verifyPassword("correct horse battery staple", passwordHash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const passwordHash = await hashPassword("correct horse battery staple");

    await expect(verifyPassword("wrong password", passwordHash)).resolves.toBe(false);
  });
});

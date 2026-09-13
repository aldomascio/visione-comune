import { expect, test } from "@playwright/test";
import { argon2, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";

const argon2Async = promisify(argon2);
const adminEmail = "admin.e2e@example.com";
const adminPassword = "Correct horse battery staple 2026!";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await cleanupAdmin();
  await createAdmin();
});

test.afterEach(async () => {
  await cleanupAdmin();
});

test("redirects anonymous users, allows login, then protects admin again after logout", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);

  await page.getByLabel("Email").fill(adminEmail);
  await page.getByLabel("Password").fill(adminPassword);
  await page.getByRole("button", { name: "Accedi" }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Area amministrativa" })).toBeVisible();
  await expect(page.getByRole("banner").getByText(adminEmail)).toBeVisible();

  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("shows a generic error for invalid credentials", async ({ page }) => {
  await page.goto("/admin/login");

  await page.getByLabel("Email").fill(adminEmail);
  await page.getByLabel("Password").fill("wrong password");
  await page.getByRole("button", { name: "Accedi" }).click();

  await expect(page.getByText("Credenziali non valide")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("keeps public report submission accessible without authentication", async ({ page }) => {
  await page.goto("/segnala");

  await expect(page.getByRole("heading", { name: "Invia una segnalazione senza account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Invia segnalazione" })).toBeVisible();
});

async function createAdmin(): Promise<void> {
  await withDatabase(async (sql) => {
    const passwordHash = await hashPassword(adminPassword);
    await sql`
      insert into admin_users (id, email, password_hash, role, active)
      values ('e2e-admin-user', ${adminEmail}, ${passwordHash}, 'admin', true)
    `;
  });
}

async function cleanupAdmin(): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`delete from admin_users where email = ${adminEmail} or id = 'e2e-admin-user'`;
  });
}

async function withDatabase<T>(callback: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for admin auth e2e tests.");
  }

  const sql = postgres(databaseUrl, { max: 1 });

  try {
    return await callback(sql);
  } finally {
    await sql.end();
  }
}

async function hashPassword(password: string): Promise<string> {
  const nonce = randomBytes(16);
  const derivedKey = await argon2Async("argon2id", {
    message: password,
    nonce,
    memory: 65_536,
    passes: 3,
    parallelism: 1,
    tagLength: 32
  });

  return [
    "argon2id",
    "v=19",
    "m=65536,t=3,p=1",
    nonce.toString("base64url"),
    derivedKey.toString("base64url")
  ].join("$");
}

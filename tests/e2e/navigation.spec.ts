import { expect, test, type Page } from "@playwright/test";
import { argon2, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";

const argon2Async = promisify(argon2);
const adminEmail = "navigation-admin.e2e@example.com";
const adminPassword = "Correct horse battery staple navigation 2026!";
const adminId = "e2e-navigation-admin";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await cleanupAdmin();
  await createAdmin();
});

test.afterEach(async () => {
  await cleanupAdmin();
});

test("public navigation links the main public sections", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("navigation", { name: "Navigazione principale" })).toBeVisible();
  const publicNav = page.getByRole("navigation", { name: "Navigazione principale" });
  await expect(publicNav.getByRole("link", { name: "Mappa" })).toBeVisible();
  await expect(publicNav.getByRole("link", { name: "Manifesto" })).toBeVisible();
  await expect(publicNav.getByRole("link", { name: "Notizie" })).toBeVisible();
  await expect(publicNav.getByRole("link", { name: "Newsletter" })).toBeVisible();
  await expect(publicNav.getByRole("link", { name: "Home", exact: true })).toHaveCount(0);
  await expect(publicNav.getByRole("link", { name: "Segnala", exact: true })).toHaveCount(0);

  await page.getByRole("navigation", { name: "Navigazione principale" }).getByRole("link", { name: "Mappa" }).click();
  await expect(page).toHaveURL(/\/mappa$/);
  await expect(page.getByRole("heading", { name: "Mappa delle segnalazioni" })).toBeVisible();

  await page.getByRole("navigation", { name: "Navigazione principale" }).getByRole("link", { name: "Manifesto" }).click();
  await expect(page).toHaveURL(/\/manifesto$/);
  await expect(page.getByRole("heading", { name: "Manifesto", exact: true })).toBeVisible();

  await page.getByRole("navigation", { name: "Navigazione principale" }).getByRole("link", { name: "Notizie" }).click();
  await expect(page).toHaveURL(/\/notizie$/);
  await expect(page.getByRole("heading", { name: "Notizie", exact: true })).toBeVisible();

  await page.getByRole("navigation", { name: "Navigazione principale" }).getByRole("link", { name: "Newsletter" }).click();
  await expect(page).toHaveURL(/\/newsletter$/);
  await expect(page.getByRole("heading", { name: "Newsletter", exact: true })).toBeVisible();
});

test("mobile public navigation opens, navigates and closes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const menuButton = page.getByRole("button", { name: "Apri menu principale" });
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(page.getByRole("button", { name: "Chiudi menu principale" })).toBeVisible();

  await page.getByRole("navigation", { name: "Navigazione principale mobile" }).getByRole("link", { name: "Mappa" }).click();
  await expect(page).toHaveURL(/\/mappa$/);
  await expect(page.getByRole("heading", { name: "Mappa delle segnalazioni" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Apri menu principale" })).toBeVisible();
});

test("admin shell navigates protected sections and logs out", async ({ page }) => {
  await loginAdmin(page);

  const adminNav = page.getByRole("navigation", { name: "Navigazione amministrativa" });
  await expect(adminNav).toBeVisible();
  await expect(page.getByRole("banner").getByText(adminEmail)).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navigazione principale" })).toHaveCount(0);

  await adminNav.getByRole("link", { name: "Segnalazioni" }).click();
  await expect(page).toHaveURL(/\/admin\/segnalazioni$/);
  await expect(page.getByRole("heading", { name: "Segnalazioni", exact: true })).toBeVisible();

  await page.getByRole("navigation", { name: "Navigazione amministrativa" }).getByRole("link", { name: "Categorie" }).click();
  await expect(page).toHaveURL(/\/admin\/categorie$/);
  await expect(page.getByRole("heading", { name: "Categorie", exact: true })).toBeVisible();

  await page.getByRole("navigation", { name: "Navigazione amministrativa" }).getByRole("link", { name: "Destinatari" }).click();
  await expect(page).toHaveURL(/\/admin\/destinatari$/);
  await expect(page.getByRole("heading", { name: "Destinatari", exact: true })).toBeVisible();

  await page.getByRole("navigation", { name: "Navigazione amministrativa" }).getByRole("link", { name: "Smistamento" }).click();
  await expect(page).toHaveURL(/\/admin\/smistamento$/);
  await expect(page.getByRole("heading", { name: "Matrice di smistamento", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole("navigation", { name: "Navigazione amministrativa" })).toHaveCount(0);
});

async function loginAdmin(page: Page): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(adminEmail);
  await page.getByLabel("Password").fill(adminPassword);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function createAdmin(): Promise<void> {
  await withDatabase(async (sql) => {
    const passwordHash = await hashPassword(adminPassword);
    await sql`
      insert into admin_users (id, email, password_hash, role, active)
      values (${adminId}, ${adminEmail}, ${passwordHash}, 'admin', true)
    `;
  });
}

async function cleanupAdmin(): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`delete from admin_users where email = ${adminEmail} or id = ${adminId}`;
  });
}

async function withDatabase<T>(callback: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for navigation e2e tests.");
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

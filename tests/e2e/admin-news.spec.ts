import { expect, test, type Page } from "@playwright/test";
import { argon2, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";

const argon2Async = promisify(argon2);
const adminEmail = "news-admin.e2e@example.com";
const adminPassword = "Correct horse battery staple news 2026!";
const adminId = "e2e-news-admin";
const draftTitle = "Bozza notizia E2E";
const draftSlug = "bozza-notizia-e2e";
const publishedTitle = "Notizia pubblicata E2E";
const publishedSlug = "notizia-pubblicata-e2e";
const privateDraftTitle = "Bozza privata E2E";
const privateDraftSlug = "bozza-privata-e2e";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await cleanupE2eData();
  await createAdmin();
});

test.afterEach(async () => {
  await cleanupE2eData();
});

test("admin creates a draft, publishes it, and public pages show only published news", async ({ page }) => {
  await loginAdmin(page);

  await page.goto("/admin/notizie");
  await expect(page.getByRole("heading", { name: "Notizie", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Nuova notizia" }).click();

  await page.getByLabel("Titolo").fill(draftTitle);
  await expect(page.getByLabel("Slug")).toHaveValue(draftSlug);
  await page.getByLabel("Estratto").fill("Estratto bozza E2E");
  await page.getByLabel("Contenuto").fill("Contenuto iniziale della bozza E2E.");
  await page.getByLabel("Stato").selectOption("draft");
  await page.getByRole("button", { name: "Salva notizia" }).click();

  await expect(page).toHaveURL(/\/admin\/notizie\?created=1$/);
  await expect(page.getByRole("row", { name: new RegExp(draftTitle) })).toContainText("Bozza");

  await createDraftNewsPost();

  await page.getByRole("row", { name: new RegExp(draftTitle) }).getByRole("link", { name: "Modifica" }).click();
  await page.getByLabel("Titolo").fill(publishedTitle);
  await page.getByLabel("Slug").fill(publishedSlug);
  await page.getByLabel("Estratto").fill("Estratto pubblico E2E");
  await page.getByLabel("Immagine in evidenza").fill("/news/territorio.svg");
  await page.getByLabel("Testo alternativo immagine").fill("Illustrazione test notizia E2E");
  await page.getByLabel("Contenuto").fill("Contenuto pubblico aggiornato E2E.");
  await page.getByLabel("Stato").selectOption("published");
  await page.getByRole("button", { name: "Salva modifiche" }).click();

  await expect(page).toHaveURL(/\/admin\/notizie\?updated=1$/);
  await expect(page.getByRole("row", { name: new RegExp(publishedTitle) })).toContainText("Pubblicata");

  await page.goto("/notizie");
  await expect(page.getByRole("heading", { name: "Notizie", exact: true })).toBeVisible();
  await expect(page.getByText(publishedTitle)).toBeVisible();
  await expect(page.getByRole("img", { name: "Illustrazione test notizia E2E" })).toBeVisible();
  await expect(page.getByText(privateDraftTitle)).toHaveCount(0);

  await page.getByRole("link", { name: "Leggi aggiornamento" }).first().click();
  await expect(page).toHaveURL(new RegExp(`/notizie/${publishedSlug}$`));
  await expect(page.getByRole("heading", { name: publishedTitle })).toBeVisible();
  await expect(page.getByRole("img", { name: "Illustrazione test notizia E2E" })).toBeVisible();
  await expect(page.getByText("Contenuto pubblico aggiornato E2E.")).toBeVisible();

  const draftResponse = await page.goto(`/notizie/${privateDraftSlug}`);
  expect(draftResponse?.status()).toBe(404);
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

async function createDraftNewsPost(): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`
      insert into news_posts (id, title, slug, excerpt, content, status, created_at, updated_at)
      values (
        'e2e-news-private-draft',
        ${privateDraftTitle},
        ${privateDraftSlug},
        'Estratto bozza privata',
        'Contenuto bozza privata.',
        'draft',
        now(),
        now()
      )
    `;
  });
}

async function cleanupE2eData(): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`delete from news_posts where slug in ${sql([draftSlug, publishedSlug, privateDraftSlug])} or id in ${sql(["e2e-news-private-draft"])}`;
    await sql`delete from admin_users where email = ${adminEmail} or id = ${adminId}`;
  });
}

async function withDatabase<T>(callback: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for admin news e2e tests.");
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

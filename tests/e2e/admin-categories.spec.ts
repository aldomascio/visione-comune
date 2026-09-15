import { expect, test, type Page } from "@playwright/test";
import { argon2, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";

const argon2Async = promisify(argon2);
const adminEmail = "categories-admin.e2e@example.com";
const adminPassword = "Correct horse battery staple categories 2026!";
const createdCategoryName = "Categoria E2E Categorie";
const createdCategorySlug = "categoria-e2e-categorie";
const historicalCategoryId = "e2e-categories-historical-category";
const historicalCategoryName = "Categoria storica E2E";
const historicalCategorySlug = "categoria-storica-e2e";
const historicalReportId = "e2e-categories-historical-report";
const historicalPublicCode = "VC-CATHIS01";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await cleanupE2eData();
  await createAdmin();
});

test.afterEach(async () => {
  await cleanupE2eData();
});

test("admin creates a category and the public report form shows it", async ({ page }) => {
  await loginAdmin(page);

  await page.goto("/admin/categorie");
  await page.getByRole("link", { name: "Nuova categoria" }).click();
  await page.getByLabel("Nome categoria").fill(createdCategoryName);
  await expect(page.getByLabel("Slug")).toHaveValue(createdCategorySlug);
  await page.getByRole("button", { name: "Crea categoria" }).click();

  await expect(page).toHaveURL(/\/admin\/categorie\?created=1$/);
  await expect(page.getByText(createdCategoryName)).toBeVisible();
  await expect(page.getByText("Attiva").first()).toBeVisible();

  await page.goto("/segnala");
  await page.getByRole("button", { name: "Inizia la segnalazione" }).click();
  await expect(page.getByRole("radio", { name: createdCategoryName })).toBeVisible();
});

test("admin deactivates a category and the public report form hides it", async ({ page }) => {
  await createCategory({ id: "e2e-categories-created", name: createdCategoryName, slug: createdCategorySlug, active: true });
  await loginAdmin(page);

  await page.goto("/admin/categorie");
  await page.getByRole("row", { name: new RegExp(createdCategoryName) }).getByRole("link", { name: "Modifica" }).click();
  await page.getByLabel("Stato").selectOption("false");
  await page.getByRole("button", { name: "Salva modifiche" }).click();

  await expect(page).toHaveURL(/\/admin\/categorie\?updated=1$/);
  await expect(page.getByText("Disattivata").first()).toBeVisible();

  await page.goto("/segnala");
  await page.getByRole("button", { name: "Inizia la segnalazione" }).click();
  await expect(page.getByRole("radio", { name: createdCategoryName })).toHaveCount(0);
});

test("historical public reports keep showing their category after deactivation", async ({ page }) => {
  await createCategory({
    id: historicalCategoryId,
    name: historicalCategoryName,
    slug: historicalCategorySlug,
    active: true
  });
  await createApprovedReport();
  await loginAdmin(page);

  await page.goto("/admin/categorie");
  await page.getByRole("row", { name: new RegExp(historicalCategoryName) }).getByRole("link", { name: "Modifica" }).click();
  await page.getByLabel("Stato").selectOption("false");
  await page.getByRole("button", { name: "Salva modifiche" }).click();

  await page.goto(`/segnalazioni/${historicalPublicCode}`);
  await expect(page.getByRole("heading", { name: "Report storico categoria" })).toBeVisible();
  await expect(page.getByText(historicalCategoryName)).toBeVisible();
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
      values ('e2e-categories-admin', ${adminEmail}, ${passwordHash}, 'admin', true)
    `;
  });
}

async function createCategory(input: { id: string; name: string; slug: string; active: boolean }): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`
      insert into categories (id, name, slug, active)
      values (${input.id}, ${input.name}, ${input.slug}, ${input.active})
      on conflict (id) do update set
        name = excluded.name,
        slug = excluded.slug,
        active = excluded.active,
        updated_at = now()
    `;
  });
}

async function createApprovedReport(): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`
      insert into reports (
        id,
        public_code,
        title,
        description,
        category_id,
        latitude,
        longitude,
        address,
        public_status,
        moderation_status,
        created_at,
        published_at
      ) values (
        ${historicalReportId},
        ${historicalPublicCode},
        'Report storico categoria',
        'Descrizione lunga del report storico usato per verificare categorie disattivate.',
        ${historicalCategoryId},
        41.4821,
        14.0474,
        'Via storica E2E',
        'reported',
        'approved',
        now(),
        now()
      )
    `;
    await sql`
      insert into report_events (id, report_id, type, visibility, public_status, created_at)
      values ('e2e-categories-historical-report-approved', ${historicalReportId}, 'ReportApproved', 'public', 'reported', now())
    `;
  });
}

async function cleanupE2eData(): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`delete from report_confirmations where report_id = ${historicalReportId}`;
    await sql`delete from report_events where report_id = ${historicalReportId}`;
    await sql`delete from report_attachments where report_id = ${historicalReportId}`;
    await sql`delete from reports where id = ${historicalReportId}`;
    await sql`delete from categories where id in ${sql(["e2e-categories-created", historicalCategoryId])} or slug in ${sql([createdCategorySlug, historicalCategorySlug])}`;
    await sql`delete from admin_users where email = ${adminEmail} or id = 'e2e-categories-admin'`;
  });
}

async function withDatabase<T>(callback: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for admin categories e2e tests.");
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

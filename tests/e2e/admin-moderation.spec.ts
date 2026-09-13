import { expect, test, type Page } from "@playwright/test";
import { argon2, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";

const argon2Async = promisify(argon2);
const adminEmail = "moderation-admin.e2e@example.com";
const adminPassword = "Correct horse battery staple moderation 2026!";
const categoryId = "e2e-moderation-category";
const categoryName = "Categoria moderazione E2E";
const reportIds = ["e2e-moderation-approve", "e2e-moderation-reject"];
const approveCode = "VC-MODAPP01";
const rejectCode = "VC-MODREJ01";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await cleanupE2eData();
  await createAdmin();
  await createCategory();
});

test.afterEach(async () => {
  await cleanupE2eData();
});

test("admin approves a pending report from the backoffice", async ({ page }) => {
  await createPendingReport({ id: reportIds[0], publicCode: approveCode, title: "Buca da approvare" });
  await loginAdmin(page);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Area amministrativa" })).toBeVisible();
  await expect(page.getByText("Buca da approvare")).toBeVisible();

  await page.getByRole("link", { name: /VC-MODAPP01/ }).click();
  await expect(page.getByRole("heading", { name: "Buca da approvare" })).toBeVisible();
  await page.getByRole("button", { name: "Approva" }).click();

  await expect(page.getByText("Segnalazione approvata e pubblicata come Segnalata.")).toBeVisible();
  await expect(page.getByText("Approvata").first()).toBeVisible();
  await expect(page.getByText("Segnalata").first()).toBeVisible();

  await page.goto("/admin/segnalazioni");
  await expect(page.getByText("Buca da approvare")).toHaveCount(0);
});

test("admin rejects a pending report from the backoffice", async ({ page }) => {
  await createPendingReport({ id: reportIds[1], publicCode: rejectCode, title: "Segnalazione da rifiutare" });
  await loginAdmin(page);

  await page.goto(`/admin/segnalazioni/${rejectCode}`);
  await expect(page.getByRole("heading", { name: "Segnalazione da rifiutare" })).toBeVisible();
  await page.getByLabel("Nota interna opzionale").fill("Test rifiuto E2E");
  await page.getByRole("button", { name: "Rifiuta" }).click();

  await expect(page.getByText("Segnalazione rifiutata.")).toBeVisible();
  await expect(page.getByText("Rifiutata").first()).toBeVisible();
  await expect(page.getByText("Non pubblica").first()).toBeVisible();

  await page.goto("/admin/segnalazioni");
  await expect(page.getByText("Segnalazione da rifiutare")).toHaveCount(0);
});

test("redirects anonymous users away from the reports moderation list", async ({ page }) => {
  await page.goto("/admin/segnalazioni");

  await expect(page).toHaveURL(/\/admin\/login$/);
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
      values ('e2e-moderation-admin', ${adminEmail}, ${passwordHash}, 'admin', true)
    `;
  });
}

async function createCategory(): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`
      insert into categories (id, name, slug, active)
      values (${categoryId}, ${categoryName}, 'categoria-moderazione-e2e', true)
      on conflict (id) do update set name = excluded.name, slug = excluded.slug, active = true
    `;
  });
}

async function createPendingReport(input: { id: string; publicCode: string; title: string }): Promise<void> {
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
        moderation_status,
        created_at
      ) values (
        ${input.id},
        ${input.publicCode},
        ${input.title},
        'Descrizione lunga della segnalazione di moderazione usata nei test end-to-end.',
        ${categoryId},
        41.4821,
        14.0474,
        'Via Roma, Venafro',
        'pending_review',
        now()
      )
    `;
    await sql`
      insert into report_events (id, report_id, type, visibility, created_at)
      values (${`${input.id}-created`}, ${input.id}, 'ReportCreated', 'internal', now())
    `;
  });
}

async function cleanupE2eData(): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`delete from report_events where report_id in ${sql(reportIds)} or report_id like 'e2e-moderation-%'`;
    await sql`delete from reports where id in ${sql(reportIds)} or id like 'e2e-moderation-%'`;
    await sql`delete from categories where id = ${categoryId} or slug = 'categoria-moderazione-e2e'`;
    await sql`delete from admin_users where email = ${adminEmail} or id = 'e2e-moderation-admin'`;
  });
}

async function withDatabase<T>(callback: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for admin moderation e2e tests.");
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

import { expect, test, type Page } from "@playwright/test";
import { argon2, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";

const argon2Async = promisify(argon2);
const adminEmail = "public-tracking-admin.e2e@example.com";
const adminPassword = "Correct horse battery staple tracking 2026!";
const adminId = "e2e-public-tracking-admin";
const categoryId = "e2e-public-tracking-category";
const categoryName = "Categoria tracking E2E";
const directPendingCode = "VC-DIRPEND1";
const directRejectedCode = "VC-DIRREJ11";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await cleanupE2eData();
  await createAdmin();
  await createCategory();
});

test.afterEach(async () => {
  await cleanupE2eData();
});

test("tracks a newly submitted pending report without exposing a public detail page", async ({ page }) => {
  const publicCode = await submitReport(page, "Segnalazione E2E pending da controllare tramite codice pubblico.");

  await trackCode(page, publicCode);

  await expect(page.getByText("Segnalazione ricevuta")).toBeVisible();
  await expect(page.getByText("Stiamo verificando la tua segnalazione.")).toBeVisible();
  await expect(page.getByText("Segnalazione E2E pending da controllare")).toHaveCount(0);
});

test("tracks an approved report and opens the public detail page", async ({ page }) => {
  const description = "Segnalazione E2E approvata con descrizione visibile nella scheda pubblica.";
  const publicCode = await submitReport(page, description);
  await loginAdmin(page);
  await page.goto(`/admin/segnalazioni/${publicCode}`);
  await page.getByRole("button", { name: "Approva" }).click();
  await expect(page.getByText("Segnalazione approvata e pubblicata come Segnalata.")).toBeVisible();

  await trackCode(page, publicCode);

  await expect(page).toHaveURL(new RegExp(`/segnalazioni/${publicCode}$`));
  await expect(page.getByRole("heading", { name: /Categoria tracking E2E/ })).toBeVisible();
  await expect(page.getByText(description)).toBeVisible();
  await expect(page.getByText(categoryName, { exact: true })).toBeVisible();
  await expect(page.getByText("Segnalata").first()).toBeVisible();
  await expect(page.getByText("Segnalazione verificata e pubblicata")).toBeVisible();
});

test("tracks a rejected report with a generic message and hides the internal note", async ({ page }) => {
  const publicCode = await submitReport(page, "Segnalazione E2E rifiutata da controllare tramite codice pubblico.");
  await loginAdmin(page);
  await page.goto(`/admin/segnalazioni/${publicCode}`);
  await page.getByLabel("Nota interna opzionale").fill("Nota interna segreta E2E");
  await page.getByRole("button", { name: "Rifiuta" }).click();
  await expect(page.getByText("Segnalazione rifiutata.")).toBeVisible();

  await trackCode(page, publicCode);

  await expect(page.getByText("La segnalazione non e stata pubblicata")).toBeVisible();
  await expect(page.getByText("Nota interna segreta E2E")).toHaveCount(0);
  await expect(page.getByText("Segnalazione E2E rifiutata")).toHaveCount(0);
});

test("does not render public detail pages for pending or rejected reports", async ({ page }) => {
  await createPendingReport({ id: "e2e-direct-pending", publicCode: directPendingCode, title: "Pending diretto" });
  await createRejectedReport({ id: "e2e-direct-rejected", publicCode: directRejectedCode, title: "Rejected diretto" });

  const pendingResponse = await page.goto(`/segnalazioni/${directPendingCode}`);
  expect(pendingResponse?.status()).toBe(404);
  await expect(page.getByText("Pending diretto")).toHaveCount(0);

  const rejectedResponse = await page.goto(`/segnalazioni/${directRejectedCode}`);
  expect(rejectedResponse?.status()).toBe(404);
  await expect(page.getByText("Rejected diretto")).toHaveCount(0);
});

async function submitReport(page: Page, description: string): Promise<string> {
  await page.goto("/segnala");
  await page.getByLabel("Che tipo di problema vuoi segnalare?").selectOption(categoryId);
  await page.getByLabel("Inserisci indirizzo").fill("Via Roma, Venafro");
  await page.getByLabel("Latitudine").fill("41.4821");
  await page.getByLabel("Longitudine").fill("14.0474");
  await page.getByLabel("Descrivi il problema").fill(description);
  await page.getByRole("button", { name: "Invia segnalazione" }).click();
  await expect(page.getByRole("heading", { name: "Conserva il tuo codice" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Controlla lo stato della segnalazione" })).toBeVisible();

  const text = await page.locator("body").textContent();
  const publicCode = text?.match(/VC-[0-9A-Z]{8}/)?.[0];

  if (!publicCode) {
    throw new Error("Public code not found after report submission.");
  }

  return publicCode;
}

async function trackCode(page: Page, publicCode: string): Promise<void> {
  await page.goto("/segnalazione");
  await page.getByLabel("Codice segnalazione").fill(publicCode);
  await page.getByRole("button", { name: "Controlla segnalazione" }).click();
}

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

async function createCategory(): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`
      insert into categories (id, name, slug, active)
      values (${categoryId}, ${categoryName}, 'categoria-tracking-e2e', true)
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
        'Descrizione diretta non pubblica per test sicurezza.',
        ${categoryId},
        41.4821,
        14.0474,
        'Via Roma, Venafro',
        'pending_review',
        now()
      )
    `;
  });
}

async function createRejectedReport(input: { id: string; publicCode: string; title: string }): Promise<void> {
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
        'Descrizione diretta rifiutata non pubblica per test sicurezza.',
        ${categoryId},
        41.4821,
        14.0474,
        'Via Roma, Venafro',
        'rejected',
        now()
      )
    `;
  });
}

async function cleanupE2eData(): Promise<void> {
  await withDatabase(async (sql) => {
    const reportRows = await sql<{ id: string }[]>`
      select id from reports where category_id = ${categoryId} or id like 'e2e-direct-%'
    `;
    const reportIds = reportRows.map((row) => row.id);

    if (reportIds.length > 0) {
      await sql`delete from report_events where report_id in ${sql(reportIds)}`;
      await sql`delete from reports where id in ${sql(reportIds)}`;
    }

    await sql`delete from categories where id = ${categoryId} or slug = 'categoria-tracking-e2e'`;
    await sql`delete from admin_users where email = ${adminEmail} or id = ${adminId}`;
  });
}

async function withDatabase<T>(callback: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for public tracking e2e tests.");
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

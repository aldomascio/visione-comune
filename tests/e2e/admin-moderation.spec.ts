import { expect, test, type Page } from "@playwright/test";
import { argon2, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";

const argon2Async = promisify(argon2);
const adminEmail = "moderation-admin.e2e@example.com";
const adminPassword = "Correct horse battery staple moderation 2026!";
const categoryId = "e2e-moderation-category";
const categoryName = "Categoria moderazione E2E";
const reportIds = ["e2e-moderation-approve", "e2e-moderation-reject", "e2e-moderation-admin-manual"];
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
  await expect(page.getByRole("heading", { name: "Registro operativo" })).toBeVisible();
  await expect(page.getByText("Segnalazione ricevuta")).toBeVisible();
  await expect(page.getByText("Segnalazione pubblicata")).toBeVisible();
  await expect(page.getByText("Interno").first()).toBeVisible();
  await expect(page.getByText("Pubblico").first()).toBeVisible();

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
  await expect(page.getByRole("heading", { name: "Registro operativo" })).toBeVisible();
  await expect(page.getByText("Segnalazione ricevuta")).toBeVisible();
  await expect(page.getByText("Segnalazione rifiutata", { exact: true })).toBeVisible();
  await expect(page.getByText("Test rifiuto E2E")).toBeVisible();

  const publicResponse = await page.goto(`/segnalazioni/${rejectCode}`);
  expect(publicResponse?.status()).toBe(404);
  await expect(page.getByText("Test rifiuto E2E")).toHaveCount(0);

  await page.goto("/admin/segnalazioni");
  await expect(page.getByText("Segnalazione da rifiutare")).toHaveCount(0);
});


test("admin creates a manual report with source and pending status", async ({ page }) => {
  await mockGeocoding(page);
  await loginAdmin(page);

  await page.goto("/admin/segnalazioni");
  const newReportLink = page.getByRole("link", { name: "Nuova segnalazione" });
  await expect(newReportLink).toHaveAttribute("href", "/admin/segnalazioni/nuova");

  await page.goto("/admin/segnalazioni/nuova");
  await expect(page).toHaveURL(/\/admin\/segnalazioni\/nuova$/);
  await page.getByLabel("Categoria").selectOption(categoryId);
  await page.getByLabel("Fonte").selectOption("email");
  await page.getByLabel("Inserisci indirizzo").fill("Via manuale");
  await page.getByRole("option", { name: "Via manuale, Venafro, Molise, Italia" }).click();
  await expect(page.locator('input[name="latitude"]')).not.toHaveValue("");
  await expect(page.locator('input[name="longitude"]')).not.toHaveValue("");
  await page.getByLabel("Descrizione").fill("Segnalazione ricevuta via email e inserita manualmente dal backoffice per verifica.");
  await page.getByRole("button", { name: "Salva segnalazione" }).click();

  await expect(page.getByText("Segnalazione registrata da verificare")).toBeVisible();
  const codeText = await page.locator("text=/VC-[0-9A-Z]{8}/").first().textContent();
  const publicCode = codeText?.match(/VC-[0-9A-Z]{8}/)?.[0];

  if (!publicCode) {
    throw new Error("Manual report public code not found.");
  }

  await expect(readReportAudit(publicCode)).resolves.toEqual({
    source: "email",
    moderationStatus: "pending_review",
    createdByAdminId: "e2e-moderation-admin"
  });
  await page.getByRole("link", { name: "Apri dettaglio" }).click();
  await expect(page.getByRole("heading", { name: /Categoria moderazione E2E: Via manuale, Venafro/ })).toBeVisible();
  await expect(page.getByText("Fonte").first()).toBeVisible();
  await expect(page.getByText("Email").first()).toBeVisible();
  await expect(page.getByText("Da verificare").first()).toBeVisible();
  await expect(page.getByText("Creato da").first()).toBeVisible();
  await expect(page.getByText(adminEmail).first()).toBeVisible();

  await page.getByRole("button", { name: "Approva" }).click();
  await expect(page.getByText("Segnalazione approvata e pubblicata come Segnalata.")).toBeVisible();

  const publicResponse = await page.request.get(`/segnalazioni/${publicCode}`);
  expect(publicResponse.status()).toBe(200);
  const publicHtml = await publicResponse.text();
  expect(publicHtml).not.toContain("Creato da");
  expect(publicHtml).not.toContain(adminEmail);
});

test("redirects anonymous users away from the reports moderation list", async ({ page }) => {
  await page.goto("/admin/segnalazioni");

  await expect(page).toHaveURL(/\/admin\/login$/);
});


async function mockGeocoding(page: Page): Promise<void> {
  await page.route("**/api/geocoding/search**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [
          {
            id: "mock-via-manuale",
            label: "Via manuale, Venafro, Molise, Italia",
            latitude: 41.4821,
            longitude: 14.0474
          }
        ]
      })
    });
  });
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


async function readReportAudit(publicCode: string): Promise<{ source: string; moderationStatus: string; createdByAdminId: string | null }> {
  return withDatabase(async (sql) => {
    const rows = await sql<{ source: string; moderation_status: string; created_by_admin_id: string | null }[]>`
      select source, moderation_status, created_by_admin_id from reports where public_code = ${publicCode}
    `;
    const row = rows[0];

    if (!row) {
      throw new Error(`Manual report not found for ${publicCode}`);
    }

    return { source: row.source, moderationStatus: row.moderation_status, createdByAdminId: row.created_by_admin_id };
  });
}

async function cleanupE2eData(): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`
      delete from report_events
      where report_id in (
        select id from reports
        where id in ${sql(reportIds)} or id like 'e2e-moderation-%' or category_id = ${categoryId}
      )
    `;
    await sql`
      delete from report_attachments
      where report_id in (
        select id from reports
        where id in ${sql(reportIds)} or id like 'e2e-moderation-%' or category_id = ${categoryId}
      )
    `;
    await sql`delete from reports where id in ${sql(reportIds)} or id like 'e2e-moderation-%' or category_id = ${categoryId}`;
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

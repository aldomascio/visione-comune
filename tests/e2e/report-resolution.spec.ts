import { expect, test, type Page } from "@playwright/test";
import { argon2, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";

const argon2Async = promisify(argon2);
const adminEmail = "resolution-admin.e2e@example.com";
const adminPassword = "Correct horse battery staple resolution 2026!";
const adminId = "e2e-resolution-admin";
const categoryId = "e2e-resolution-category";
const recipientId = "e2e-resolution-recipient";
const resolvedReportId = "e2e-resolution-report-resolved";
const reportedReportId = "e2e-resolution-report-reported";
const resolvedCode = "VC-RESOE201";
const reportedCode = "VC-RESOE202";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await cleanupE2eData();
  await createAdmin();
  await createCategoryAndRecipient();
});

test.afterEach(async () => {
  await cleanupE2eData();
});

test("admin resolves a communicated report and the public detail and map remain visible", async ({ page }) => {
  await createApprovedReport({ id: resolvedReportId, publicCode: resolvedCode, title: "Segnalazione da risolvere E2E" });
  await loginAdmin(page);

  await page.goto(`/admin/segnalazioni/${resolvedCode}`);
  await expect(page.getByRole("button", { name: "Segna come risolta" })).toHaveCount(0);

  await page.getByLabel("Stato iniziale").selectOption("sent");
  await page.getByRole("button", { name: "Registra comunicazione" }).click();
  await expect(page.getByText("Comunicazione registrata.")).toBeVisible();

  await page.getByRole("button", { name: "Marca consegnata" }).click();
  await expect(page.getByText("Comunicazione marcata come consegnata.")).toBeVisible();
  await expect(page.getByText("Comunicata").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Segna come risolta" })).toBeVisible();

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("Segnare questa segnalazione come risolta?");
    await dialog.accept();
  });
  await page.getByLabel("Nota interna opzionale").fill("Sopralluogo E2E completato");
  await page.getByRole("button", { name: "Segna come risolta" }).click();

  await expect(page.getByText("Segnalazione marcata come risolta.")).toBeVisible();
  await expect(page.getByText("Risolta").first()).toBeVisible();
  await expect(page.getByText("Problema risolto")).toBeVisible();
  await expect(page.getByText("Sopralluogo E2E completato")).toBeVisible();
  await expect(page.getByRole("button", { name: "Segna come risolta" })).toHaveCount(0);

  await page.goto(`/segnalazioni/${resolvedCode}`);
  await expect(page.getByText("Risolta").first()).toBeVisible();
  await expect(page.getByText("Data risoluzione")).toBeVisible();
  await expect(page.getByText("Problema risolto")).toBeVisible();
  await expect(page.getByText("Visione Comune ha verificato la risoluzione del problema.")).toBeVisible();
  await expect(page.getByText("Sopralluogo E2E completato")).toHaveCount(0);

  await page.goto("/mappa");
  await page.getByLabel("Filtra per stato").selectOption("resolved");
  await expect(page.getByRole("heading", { name: "Segnalazione da risolvere E2E" })).toBeVisible();
  await expect(page.locator("li").filter({ hasText: "Segnalazione da risolvere E2E" }).getByText("Risolta")).toBeVisible();
});

test("admin cannot resolve a report that is only Segnalata from the UI", async ({ page }) => {
  await createApprovedReport({ id: reportedReportId, publicCode: reportedCode, title: "Segnalazione non comunicata E2E" });
  await loginAdmin(page);

  await page.goto(`/admin/segnalazioni/${reportedCode}`);

  await expect(page.getByText("La CTA di risoluzione sara disponibile dopo che una comunicazione sara marcata come consegnata")).toBeVisible();
  await expect(page.getByRole("button", { name: "Segna come risolta" })).toHaveCount(0);
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

async function createCategoryAndRecipient(): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`
      insert into categories (id, name, slug, active)
      values (${categoryId}, 'Categoria risoluzione E2E', 'categoria-risoluzione-e2e', true)
    `;
    await sql`
      insert into recipients (id, name, organization, email, pec, active)
      values (${recipientId}, 'Ufficio Risoluzioni', 'Comune di Venafro', 'ufficio-risoluzioni@example.test', 'ufficio-risoluzioni@pec.example.test', true)
    `;
    await sql`
      insert into category_recipients (category_id, recipient_id, sort_order)
      values (${categoryId}, ${recipientId}, 0)
    `;
  });
}

async function createApprovedReport(input: { id: string; publicCode: string; title: string }): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`
      insert into reports (
        id, public_code, title, description, category_id, latitude, longitude, address,
        public_status, moderation_status, created_at, published_at
      ) values (
        ${input.id}, ${input.publicCode}, ${input.title},
        'Descrizione della segnalazione usata per la risoluzione E2E.',
        ${categoryId}, 41.4821, 14.0474, 'Via Roma, Venafro',
        'reported', 'approved', '2026-01-01T10:00:00Z', '2026-01-02T10:00:00Z'
      )
    `;
    await sql`
      insert into report_events (id, report_id, type, visibility, created_at)
      values (${`${input.id}-created`}, ${input.id}, 'ReportCreated', 'internal', '2026-01-01T10:00:00Z')
    `;
    await sql`
      insert into report_events (id, report_id, type, visibility, public_status, created_at)
      values (${`${input.id}-approved`}, ${input.id}, 'ReportApproved', 'public', 'reported', '2026-01-02T10:00:00Z')
    `;
  });
}

async function cleanupE2eData(): Promise<void> {
  await withDatabase(async (sql) => {
    const reportIds = [resolvedReportId, reportedReportId];
    await sql`delete from outbound_communications where report_id in ${sql(reportIds)}`;
    await sql`delete from report_events where report_id in ${sql(reportIds)}`;
    await sql`delete from report_confirmations where report_id in ${sql(reportIds)}`;
    await sql`delete from report_attachments where report_id in ${sql(reportIds)}`;
    await sql`delete from reports where id in ${sql(reportIds)}`;
    await sql`delete from category_recipients where category_id = ${categoryId} or recipient_id = ${recipientId}`;
    await sql`delete from recipients where id = ${recipientId} or pec = 'ufficio-risoluzioni@pec.example.test'`;
    await sql`delete from categories where id = ${categoryId} or slug = 'categoria-risoluzione-e2e'`;
    await sql`delete from admin_users where id = ${adminId} or email = ${adminEmail}`;
  });
}

async function withDatabase<T>(callback: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for report resolution e2e tests.");
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

import { expect, test, type Page } from "@playwright/test";
import { argon2, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";

const argon2Async = promisify(argon2);
const adminEmail = "routing-admin.e2e@example.com";
const adminPassword = "Correct horse battery staple routing 2026!";
const categoryId = "e2e-routing-category";
const categoryName = "Categoria routing E2E";
const emptyCategoryId = "e2e-routing-empty-category";
const emptyCategoryName = "Categoria senza destinatari E2E";
const recipientName = "Ufficio Tecnico E2E";
const recipientOrganization = "Comune di Venafro";
const reportIds = ["e2e-routing-report-a", "e2e-routing-report-b", "e2e-routing-report-c"];
const publicCodes = ["VC-RT013A01", "VC-RT013B01", "VC-RT013C01"];

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await cleanupE2eData();
  await createAdmin();
  await createCategory(categoryId, categoryName);
  await createCategory(emptyCategoryId, emptyCategoryName);
});

test.afterEach(async () => {
  await cleanupE2eData();
});

test("admin creates a recipient, links it to a category, and sees it on report moderation detail", async ({ page }) => {
  await loginAdmin(page);

  await page.goto("/admin/destinatari/nuovo");
  await page.getByLabel("Nome destinatario").fill(recipientName);
  await page.getByLabel("Ente / organizzazione").fill(recipientOrganization);
  await page.getByLabel("PEC").fill("ufficio-tecnico-e2e@pec.example.test");
  await page.getByRole("button", { name: "Crea destinatario" }).click();
  await expect(page).toHaveURL(/\/admin\/destinatari\?created=1$/);

  await page.goto("/admin/smistamento");
  const routingCard = page.getByRole("heading", { name: categoryName }).locator("xpath=ancestor::section[1]");
  await routingCard.getByLabel(`Associa ${recipientName}`).check();
  await routingCard.getByLabel(`Principale ${recipientName}`).check();
  await routingCard.getByRole("button", { name: "Salva associazioni" }).click();
  await expect(page).toHaveURL(/\/admin\/smistamento\?updated=1$/);

  await createPendingReport({ id: reportIds[0], publicCode: publicCodes[0], categoryId, title: "Report routing E2E" });
  await page.goto(`/admin/segnalazioni/${publicCodes[0]}`);
  await page.getByRole("button", { name: "Approva" }).click();
  await expect(page.getByText(`Destinatario suggerito: ${recipientName} — ${recipientOrganization}`)).toBeVisible();
});

test("inactive recipients stay configured but are not proposed as operational recipients", async ({ page }) => {
  const recipientId = await createRecipient({ active: true });
  await linkRecipient(categoryId, recipientId);
  await createApprovedReport({ id: reportIds[1], publicCode: publicCodes[1], categoryId, title: "Report con destinatario inattivo" });
  await loginAdmin(page);

  await page.goto("/admin/destinatari");
  await page.getByRole("row", { name: new RegExp(recipientName) }).getByRole("link", { name: "Modifica" }).click();
  await page.getByLabel("Stato").selectOption("false");
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(page).toHaveURL(/\/admin\/destinatari\?updated=1$/);

  await page.goto(`/admin/segnalazioni/${publicCodes[1]}`);
  await expect(page.getByText("Nessun destinatario configurato per questa categoria.")).toBeVisible();
});

test("category without recipients shows missing routing configuration", async ({ page }) => {
  await createApprovedReport({ id: reportIds[2], publicCode: publicCodes[2], categoryId: emptyCategoryId, title: "Report senza destinatario" });
  await loginAdmin(page);

  await page.goto(`/admin/segnalazioni/${publicCodes[2]}`);
  await expect(page.getByText("Nessun destinatario configurato per questa categoria.")).toBeVisible();
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
    await sql`insert into admin_users (id, email, password_hash, role, active) values ('e2e-routing-admin', ${adminEmail}, ${passwordHash}, 'admin', true)`;
  });
}

async function createCategory(id: string, name: string): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`insert into categories (id, name, slug, active) values (${id}, ${name}, ${id}, true) on conflict (id) do update set name = excluded.name, slug = excluded.slug, active = true`;
  });
}

async function createRecipient(input: { active: boolean }): Promise<string> {
  const id = "e2e-routing-recipient";
  await withDatabase(async (sql) => {
    await sql`insert into recipients (id, name, organization, pec, active) values (${id}, ${recipientName}, ${recipientOrganization}, 'ufficio-tecnico-e2e@pec.example.test', ${input.active})`;
  });
  return id;
}

async function linkRecipient(categoryIdValue: string, recipientId: string): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`insert into category_recipients (category_id, recipient_id, sort_order) values (${categoryIdValue}, ${recipientId}, 0)`;
  });
}

async function createPendingReport(input: { id: string; publicCode: string; categoryId: string; title: string }): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`insert into reports (id, public_code, title, description, category_id, latitude, longitude, address, moderation_status, created_at) values (${input.id}, ${input.publicCode}, ${input.title}, 'Descrizione lunga del report routing E2E.', ${input.categoryId}, 41.4821, 14.0474, 'Via routing', 'pending_review', now())`;
    await sql`insert into report_events (id, report_id, type, visibility, created_at) values (${`${input.id}-created`}, ${input.id}, 'ReportCreated', 'internal', now())`;
  });
}

async function createApprovedReport(input: { id: string; publicCode: string; categoryId: string; title: string }): Promise<void> {
  await createPendingReport(input);
  await withDatabase(async (sql) => {
    await sql`update reports set moderation_status = 'approved', public_status = 'reported', published_at = now() where id = ${input.id}`;
    await sql`insert into report_events (id, report_id, type, visibility, public_status, created_at) values (${`${input.id}-approved`}, ${input.id}, 'ReportApproved', 'public', 'reported', now())`;
  });
}

async function cleanupE2eData(): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`delete from report_confirmations where report_id in ${sql(reportIds)}`;
    await sql`delete from report_events where report_id in ${sql(reportIds)}`;
    await sql`delete from report_attachments where report_id in ${sql(reportIds)}`;
    await sql`delete from reports where id in ${sql(reportIds)}`;
    await sql`delete from category_recipients where category_id in ${sql([categoryId, emptyCategoryId])} or recipient_id = 'e2e-routing-recipient'`;
    await sql`delete from recipients where id = 'e2e-routing-recipient' or pec = 'ufficio-tecnico-e2e@pec.example.test'`;
    await sql`delete from categories where id in ${sql([categoryId, emptyCategoryId])}`;
    await sql`delete from admin_users where email = ${adminEmail} or id = 'e2e-routing-admin'`;
  });
}

async function withDatabase<T>(callback: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for routing e2e tests.");
  const sql = postgres(databaseUrl, { max: 1 });
  try { return await callback(sql); } finally { await sql.end(); }
}

async function hashPassword(password: string): Promise<string> {
  const nonce = randomBytes(16);
  const derivedKey = await argon2Async("argon2id", { message: password, nonce, memory: 65_536, passes: 3, parallelism: 1, tagLength: 32 });
  return ["argon2id", "v=19", "m=65536,t=3,p=1", nonce.toString("base64url"), derivedKey.toString("base64url")].join("$");
}

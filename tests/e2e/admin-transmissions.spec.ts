import { expect, test, type Page } from "@playwright/test";
import { argon2, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";

const argon2Async = promisify(argon2);
const adminEmail = "transmissions-admin.e2e@example.com";
const adminPassword = "Correct horse battery staple transmissions 2026!";
const adminId = "e2e-transmissions-admin";
const categoryId = "e2e-transmissions-category";
const recipientId = "e2e-transmissions-recipient";
const reportIds = ["e2e-transmission-report-1", "e2e-transmission-report-2", "e2e-transmission-report-3"];
const pendingReportId = "e2e-transmission-report-pending";
const duplicateReportId = "e2e-transmission-report-duplicate";
const reportCodes = ["VC-TRAN0001", "VC-TRAN0002", "VC-TRAN0003"];
const pendingCode = "VC-TRAN0004";
const duplicateCode = "VC-TRAN0005";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await cleanupE2eData();
  await createAdmin();
  await createCategoryAndRecipient();
});

test.afterEach(async () => {
  await cleanupE2eData();
});

test("admin creates a multi-report transmission and delivery communicates eligible reports", async ({ page }) => {
  await createApprovedReport({ id: reportIds[0], publicCode: reportCodes[0], title: "Trasmissione buca stradale" });
  await createApprovedReport({ id: reportIds[1], publicCode: reportCodes[1], title: "Trasmissione lampione spento" });
  await createApprovedReport({ id: reportIds[2], publicCode: reportCodes[2], title: "Trasmissione erba alta" });
  await createPendingReport();
  await createApprovedReport({ id: duplicateReportId, publicCode: duplicateCode, title: "Trasmissione duplicata", duplicateOfReportId: reportIds[0] });

  await loginAdmin(page);
  await page.goto("/admin/trasmissioni");
  await expect(page.getByRole("heading", { name: "Trasmissioni", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Nuova trasmissione" }).click();

  const recipientSelect = page.locator('select[name="recipientId"]');
  await recipientSelect.selectOption(recipientId);
  await expect(recipientSelect).toHaveValue(recipientId);
  await page.goto(`/admin/trasmissioni/nuova?recipientId=${recipientId}&channel=pec`);

  await expect(page.locator(`input[name="reportIds"][value="${reportIds[0]}"]`)).toBeVisible();
  await expect(page.locator(`input[name="reportIds"][value="${reportIds[1]}"]`)).toBeVisible();
  await expect(page.locator(`input[name="reportIds"][value="${reportIds[2]}"]`)).toBeVisible();
  await expect(page.locator(`input[name="reportIds"][value="${pendingReportId}"]`)).toHaveCount(0);
  await expect(page.locator(`input[name="reportIds"][value="${duplicateReportId}"]`)).toHaveCount(0);

  await page.getByRole("button", { name: "Salva bozza" }).click();
  await expect(page.getByText("Trasmissione salvata come bozza.")).toBeVisible();
  await expect(page.locator("article").filter({ hasText: "Trasmissione buca stradale" })).toBeVisible();
  await expect(page.locator("article").filter({ hasText: "Trasmissione lampione spento" })).toBeVisible();
  await expect(page.locator("article").filter({ hasText: "Trasmissione erba alta" })).toBeVisible();

  await page.getByRole("button", { name: "Marca inviata" }).click();
  await expect(page.getByText("Trasmissione marcata come inviata.")).toBeVisible();
  await page.goto(`/segnalazioni/${reportCodes[0]}`);
  await expect(page.getByText("Segnalata").first()).toBeVisible();

  await page.goto("/admin/trasmissioni");
  await page.getByRole("link", { name: "Apri" }).first().click();
  await page.getByRole("button", { name: "Marca consegnata" }).click();
  await expect(page.getByText("Trasmissione marcata come consegnata.")).toBeVisible();
  await expect(page.getByText("Consegnata").first()).toBeVisible();

  await page.goto(`/segnalazioni/${reportCodes[0]}`);
  await expect(page.getByText("Comunicata").first()).toBeVisible();
  await expect(page.getByText("Segnalazione comunicata all'ente competente")).toBeVisible();

  await page.goto(`/admin/segnalazioni/${reportCodes[0]}`);
  await expect(page.getByRole("heading", { name: "Trasmissioni", exact: true })).toBeVisible();
  await expect(page.getByText("Ufficio Trasmissioni — Comune di Venafro").first()).toBeVisible();
  await expect(page.locator("section").filter({ hasText: "Registro delle trasmissioni" }).getByText(/PEC · 3 segnalazioni · Consegnata/)).toBeVisible();
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
    await sql`insert into admin_users (id, email, password_hash, role, active) values (${adminId}, ${adminEmail}, ${passwordHash}, 'admin', true)`;
  });
}

async function createCategoryAndRecipient(): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`insert into categories (id, name, slug, active) values (${categoryId}, 'Categoria trasmissioni E2E', 'categoria-trasmissioni-e2e', true)`;
    await sql`insert into recipients (id, name, organization, email, pec, active) values (${recipientId}, 'Ufficio Trasmissioni', 'Comune di Venafro', 'trasmissioni@example.test', 'trasmissioni@pec.example.test', true)`;
    await sql`insert into category_recipients (category_id, recipient_id, sort_order) values (${categoryId}, ${recipientId}, 0)`;
  });
}

async function createApprovedReport(input: { id: string; publicCode: string; title: string; duplicateOfReportId?: string }): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`
      insert into reports (
        id, public_code, title, description, category_id, latitude, longitude, address,
        duplicate_of_report_id, public_status, moderation_status, created_at, published_at
      ) values (
        ${input.id}, ${input.publicCode}, ${input.title},
        'Descrizione della segnalazione usata per le trasmissioni E2E.',
        ${categoryId}, 41.4821, 14.0474, 'Via Roma, Venafro',
        ${input.duplicateOfReportId ?? null}, 'reported', 'approved', '2026-01-01T10:00:00Z', '2026-01-02T10:00:00Z'
      )
    `;
    await sql`insert into report_events (id, report_id, type, visibility, created_at) values (${`${input.id}-created`}, ${input.id}, 'ReportCreated', 'internal', '2026-01-01T10:00:00Z')`;
    await sql`insert into report_events (id, report_id, type, visibility, public_status, created_at) values (${`${input.id}-approved`}, ${input.id}, 'ReportApproved', 'public', 'reported', '2026-01-02T10:00:00Z')`;
  });
}

async function createPendingReport(): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`
      insert into reports (id, public_code, title, description, category_id, latitude, longitude, address, moderation_status, created_at)
      values (${pendingReportId}, ${pendingCode}, 'Trasmissione pending', 'Pending non selezionabile.', ${categoryId}, 41.4821, 14.0474, 'Via Roma, Venafro', 'pending_review', '2026-01-01T10:00:00Z')
    `;
  });
}

async function cleanupE2eData(): Promise<void> {
  await withDatabase(async (sql) => {
    const ids = [...reportIds, pendingReportId, duplicateReportId];
    await sql`delete from transmission_reports where report_id in ${sql(ids)}`;
    await sql`delete from outbound_communications where report_id in ${sql(ids)}`;
    await sql`delete from report_events where report_id in ${sql(ids)}`;
    await sql`delete from reports where id in ${sql(ids)}`;
    await sql`delete from category_recipients where category_id = ${categoryId} or recipient_id = ${recipientId}`;
    await sql`delete from recipients where id = ${recipientId}`;
    await sql`delete from categories where id = ${categoryId} or slug = 'categoria-trasmissioni-e2e'`;
    await sql`delete from admin_users where id = ${adminId} or email = ${adminEmail}`;
  });
}

async function withDatabase<T>(callback: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for transmissions e2e tests.");
  const sql = postgres(databaseUrl, { max: 1 });
  try { return await callback(sql); } finally { await sql.end(); }
}

async function hashPassword(password: string): Promise<string> {
  const nonce = randomBytes(16);
  const derivedKey = await argon2Async("argon2id", { message: password, nonce, memory: 65_536, passes: 3, parallelism: 1, tagLength: 32 });
  return ["argon2id", "v=19", "m=65536,t=3,p=1", nonce.toString("base64url"), derivedKey.toString("base64url")].join("$");
}

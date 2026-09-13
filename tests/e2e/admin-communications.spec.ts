import { expect, test, type Page } from "@playwright/test";
import { argon2, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";

const argon2Async = promisify(argon2);
const adminEmail = "communications-admin.e2e@example.com";
const adminPassword = "Correct horse battery staple communications 2026!";
const adminId = "e2e-communications-admin";
const categoryId = "e2e-communications-category";
const recipientId = "e2e-communications-recipient";
const reportDeliveredId = "e2e-communications-report-delivered";
const reportFailedId = "e2e-communications-report-failed";
const reportSnapshotId = "e2e-communications-report-snapshot";
const deliveredCode = "VC-COME2E01";
const failedCode = "VC-COME2E02";
const snapshotCode = "VC-COME2E03";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await cleanupE2eData();
  await createAdmin();
  await createCategoryAndRecipient();
});

test.afterEach(async () => {
  await cleanupE2eData();
});

test("admin registers a sent communication, marks it delivered, and public timeline becomes Comunicata", async ({ page }) => {
  await createApprovedReport({ id: reportDeliveredId, publicCode: deliveredCode, title: "Comunicazione da consegnare" });
  await loginAdmin(page);

  await page.goto(`/admin/segnalazioni/${deliveredCode}`);
  await expect(page.getByRole("heading", { name: "Comunicazione da consegnare" })).toBeVisible();
  await expect(page.getByText("Destinatario per comunicazione: Ufficio Comunicazioni — Comune di Venafro")).toBeVisible();
  await page.getByLabel("Canale").selectOption("pec");
  await page.getByLabel("Stato iniziale").selectOption("sent");
  await page.getByRole("button", { name: "Registra comunicazione" }).click();

  await expect(page.getByText("Comunicazione registrata.")).toBeVisible();
  await expect(page.getByText("Inviata").first()).toBeVisible();
  await expect(page.getByText("Segnalata").first()).toBeVisible();

  await page.getByRole("button", { name: "Marca consegnata" }).click();
  await expect(page.getByText("Comunicazione marcata come consegnata.")).toBeVisible();
  await expect(page.getByText("Comunicata").first()).toBeVisible();
  await expect(page.getByText("Consegna comunicazione confermata")).toBeVisible();

  await page.goto(`/segnalazioni/${deliveredCode}`);
  await expect(page.getByText("Comunicata").first()).toBeVisible();
  await expect(page.getByText("Segnalazione comunicata all'ente competente")).toBeVisible();
  await expect(page.getByText("La segnalazione e stata comunicata all'ente competente.")).toBeVisible();
  await expect(page.getByText("ufficio-comunicazioni@pec.example.test")).toHaveCount(0);
});

test("admin marks a communication as failed and the report remains Segnalata", async ({ page }) => {
  await createApprovedReport({ id: reportFailedId, publicCode: failedCode, title: "Comunicazione fallita" });
  await loginAdmin(page);

  await page.goto(`/admin/segnalazioni/${failedCode}`);
  await page.getByRole("button", { name: "Registra comunicazione" }).click();
  await expect(page.getByText("Comunicazione registrata.")).toBeVisible();

  await page.getByRole("button", { name: "Marca fallita" }).click();
  await expect(page.getByText("Comunicazione marcata come fallita.")).toBeVisible();
  await expect(page.getByText("Fallita").first()).toBeVisible();
  await expect(page.getByText("Segnalata").first()).toBeVisible();
  await expect(page.getByText("Comunicata")).toHaveCount(0);
});

test("communication history keeps the original recipient snapshot after recipient changes", async ({ page }) => {
  await createApprovedReport({ id: reportSnapshotId, publicCode: snapshotCode, title: "Snapshot destinatario" });
  await loginAdmin(page);

  await page.goto(`/admin/segnalazioni/${snapshotCode}`);
  await page.getByRole("button", { name: "Registra comunicazione" }).click();
  await expect(page.getByText("Comunicazione registrata.")).toBeVisible();

  await updateRecipientAfterCommunication();
  await page.reload();

  const historicalCommunication = page.locator("article").filter({ hasText: "Oggetto" });
  await expect(historicalCommunication.getByText("Ufficio Comunicazioni — Comune di Venafro")).toBeVisible();
  await expect(historicalCommunication.getByText("ufficio-comunicazioni@pec.example.test")).toBeVisible();
  await expect(historicalCommunication.getByText("Ufficio Modificato — Comune Modificato")).toHaveCount(0);
  await expect(historicalCommunication.getByText("modificato@pec.example.test")).toHaveCount(0);
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
      values (${categoryId}, 'Categoria comunicazioni E2E', 'categoria-comunicazioni-e2e', true)
    `;
    await sql`
      insert into recipients (id, name, organization, email, pec, active)
      values (${recipientId}, 'Ufficio Comunicazioni', 'Comune di Venafro', 'ufficio-comunicazioni@example.test', 'ufficio-comunicazioni@pec.example.test', true)
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
        'Descrizione della segnalazione usata per le comunicazioni manuali E2E.',
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

async function updateRecipientAfterCommunication(): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`
      update recipients
      set name = 'Ufficio Modificato', organization = 'Comune Modificato', pec = 'modificato@pec.example.test', email = 'modificato@example.test'
      where id = ${recipientId}
    `;
  });
}

async function cleanupE2eData(): Promise<void> {
  await withDatabase(async (sql) => {
    const reportIds = [reportDeliveredId, reportFailedId, reportSnapshotId];
    await sql`delete from outbound_communications where report_id in ${sql(reportIds)}`;
    await sql`delete from report_events where report_id in ${sql(reportIds)}`;
    await sql`delete from reports where id in ${sql(reportIds)}`;
    await sql`delete from category_recipients where category_id = ${categoryId} or recipient_id = ${recipientId}`;
    await sql`delete from recipients where id = ${recipientId} or pec in ('ufficio-comunicazioni@pec.example.test', 'modificato@pec.example.test')`;
    await sql`delete from categories where id = ${categoryId} or slug = 'categoria-comunicazioni-e2e'`;
    await sql`delete from admin_users where id = ${adminId} or email = ${adminEmail}`;
  });
}

async function withDatabase<T>(callback: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for communications e2e tests.");
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

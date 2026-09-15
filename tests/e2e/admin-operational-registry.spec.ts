import { expect, test, type Page } from "@playwright/test";
import { argon2, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";

const argon2Async = promisify(argon2);
const adminEmail = "operational-registry-admin.e2e@example.com";
const adminPassword = "Correct horse battery staple registry 2026!";
const adminId = "e2e-operational-registry-admin";
const categoryId = "e2e-operational-registry-roads";
const changedCategoryId = "e2e-operational-registry-lighting";
const recipientId = "e2e-operational-registry-recipient";
const reportIds = [
  "e2e-operational-pending",
  "e2e-operational-to-transmit",
  "e2e-operational-transmitting",
  "e2e-operational-communicated",
  "e2e-operational-resolved",
  "e2e-operational-duplicate-primary",
  "e2e-operational-duplicate",
];

const codes = {
  pending: "VC-REGPEND1",
  toTransmit: "VC-REGTRNS1",
  transmitting: "VC-REGSENT1",
  communicated: "VC-REGCOMM1",
  resolved: "VC-REGRESO1",
  duplicatePrimary: "VC-REGPRIM1",
  duplicate: "VC-REGDUPL1",
};

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await cleanupE2eData();
  await createAdmin();
  await createCategoriesAndRecipient();
});

test.afterEach(async () => {
  await cleanupE2eData();
});

test("admin changes category and sees the internal operational registry", async ({ page }) => {
  await createApprovedReport({ id: reportIds[1], publicCode: codes.toTransmit, title: "Categoria da aggiornare" });
  await loginAdmin(page);

  await page.goto(`/admin/segnalazioni/${codes.toTransmit}`);
  await expect(page.getByRole("heading", { name: "Quadro operativo" })).toBeVisible();
  await expect(page.getByText("Da trasmettere").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Registro operativo" })).toBeVisible();

  await page.locator('select[name="categoryId"]').selectOption(changedCategoryId);
  await page.getByRole("button", { name: "Aggiorna categoria" }).click();

  await expect(page.getByText("Categoria aggiornata e registrata nel registro operativo.")).toBeVisible();
  await expect(page.getByText("Categoria illuminazione registro E2E").first()).toBeVisible();
  await expect(page.getByText("Categoria modificata")).toBeVisible();
  await expect(page.getByText("Categoria aggiornata da Categoria strade registro E2E a Categoria illuminazione registro E2E.")).toBeVisible();
  await expect(page.getByText(adminEmail).first()).toBeVisible();
  await expect(readReportCategory(codes.toTransmit)).resolves.toBe(changedCategoryId);
});

test("internal notes stay in admin registry and never appear on the public report", async ({ page }) => {
  await createApprovedReport({ id: reportIds[1], publicCode: codes.toTransmit, title: "Nota interna invisibile" });
  await loginAdmin(page);

  await page.goto(`/admin/segnalazioni/${codes.toTransmit}`);
  await page.getByLabel("Nuova nota").fill("Nota interna E2E da non pubblicare.");
  await page.getByRole("button", { name: "Aggiungi nota" }).click();

  await expect(page.getByText("Nota interna aggiunta al registro operativo.")).toBeVisible();
  await expect(page.getByText("Nota interna aggiunta", { exact: true })).toBeVisible();
  await expect(page.getByText("Nota interna E2E da non pubblicare.")).toBeVisible();
  await expect(page.getByText(adminEmail).first()).toBeVisible();

  await page.goto(`/segnalazioni/${codes.toTransmit}`);
  await expect(page.getByRole("heading", { name: "Nota interna invisibile" })).toBeVisible();
  await expect(page.getByText("Nota interna E2E da non pubblicare.")).toHaveCount(0);
  await expect(page.getByText("Nota interna aggiunta")).toHaveCount(0);
});

test("admin detail shows derived operational labels for pending, transmitting, communicated, resolved and duplicate reports", async ({ page }) => {
  await createPendingReport();
  await createApprovedReport({ id: reportIds[1], publicCode: codes.toTransmit, title: "Report da trasmettere" });
  await createApprovedReport({ id: reportIds[2], publicCode: codes.transmitting, title: "Report in trasmissione" });
  await createApprovedReport({ id: reportIds[3], publicCode: codes.communicated, title: "Report comunicato", publicStatus: "communicated" });
  await createApprovedReport({ id: reportIds[4], publicCode: codes.resolved, title: "Report risolto", publicStatus: "resolved" });
  await createApprovedReport({ id: reportIds[5], publicCode: codes.duplicatePrimary, title: "Report principale" });
  await createApprovedReport({ id: reportIds[6], publicCode: codes.duplicate, title: "Report duplicato", duplicateOfReportId: reportIds[5] });
  await createSentTransmission(reportIds[2]);
  await loginAdmin(page);

  await expectOperationalState(page, codes.pending, "Da verificare");
  await expectOperationalState(page, codes.toTransmit, "Da trasmettere");
  await expectOperationalState(page, codes.transmitting, "In trasmissione");
  await expectOperationalState(page, codes.communicated, "Comunicata");
  await expectOperationalState(page, codes.resolved, "Risolta");
  await expectOperationalState(page, codes.duplicate, "Duplicata");
});

async function expectOperationalState(page: Page, publicCode: string, label: string): Promise<void> {
  await page.goto(`/admin/segnalazioni/${publicCode}`);
  const quadroOperativo = page.locator("section,div").filter({ hasText: "Quadro operativo" }).first();
  await expect(quadroOperativo.getByText(label, { exact: true }).first()).toBeVisible();
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
    await sql`insert into admin_users (id, email, password_hash, role, active) values (${adminId}, ${adminEmail}, ${passwordHash}, 'admin', true)`;
  });
}

async function createCategoriesAndRecipient(): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`insert into categories (id, name, slug, active) values (${categoryId}, 'Categoria strade registro E2E', 'categoria-strade-registro-e2e', true)`;
    await sql`insert into categories (id, name, slug, active) values (${changedCategoryId}, 'Categoria illuminazione registro E2E', 'categoria-illuminazione-registro-e2e', true)`;
    await sql`insert into recipients (id, name, organization, email, pec, active) values (${recipientId}, 'Ufficio Registro', 'Comune di Venafro', 'registro@example.test', 'registro@pec.example.test', true)`;
    await sql`insert into category_recipients (category_id, recipient_id, sort_order) values (${categoryId}, ${recipientId}, 0)`;
    await sql`insert into category_recipients (category_id, recipient_id, sort_order) values (${changedCategoryId}, ${recipientId}, 0)`;
  });
}

async function createPendingReport(): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`
      insert into reports (id, public_code, title, description, category_id, latitude, longitude, address, moderation_status, created_at)
      values (${reportIds[0]}, ${codes.pending}, 'Report pending', 'Descrizione report pending registro operativo.', ${categoryId}, 41.4821, 14.0474, 'Via Roma, Venafro', 'pending_review', '2026-01-01T10:00:00Z')
    `;
    await sql`insert into report_events (id, report_id, type, visibility, created_at) values (${`${reportIds[0]}-created`}, ${reportIds[0]}, 'ReportCreated', 'internal', '2026-01-01T10:00:00Z')`;
  });
}

async function createApprovedReport(input: {
  id: string;
  publicCode: string;
  title: string;
  publicStatus?: "reported" | "communicated" | "resolved";
  duplicateOfReportId?: string;
}): Promise<void> {
  const publicStatus = input.publicStatus ?? "reported";
  await withDatabase(async (sql) => {
    await sql`
      insert into reports (
        id, public_code, title, description, category_id, latitude, longitude, address,
        duplicate_of_report_id, public_status, moderation_status, created_at, published_at, communicated_at, resolved_at
      ) values (
        ${input.id}, ${input.publicCode}, ${input.title},
        'Descrizione report registro operativo E2E.',
        ${categoryId}, 41.4821, 14.0474, 'Via Roma, Venafro',
        ${input.duplicateOfReportId ?? null}, ${publicStatus}, 'approved', '2026-01-01T10:00:00Z', '2026-01-02T10:00:00Z',
        ${publicStatus === "communicated" || publicStatus === "resolved" ? "2026-01-03T10:00:00Z" : null},
        ${publicStatus === "resolved" ? "2026-01-04T10:00:00Z" : null}
      )
    `;
    await sql`insert into report_events (id, report_id, type, visibility, created_at) values (${`${input.id}-created`}, ${input.id}, 'ReportCreated', 'internal', '2026-01-01T10:00:00Z')`;
    await sql`insert into report_events (id, report_id, type, visibility, public_status, created_at) values (${`${input.id}-approved`}, ${input.id}, 'ReportApproved', 'public', 'reported', '2026-01-02T10:00:00Z')`;
    if (publicStatus === "communicated" || publicStatus === "resolved") {
      await sql`insert into report_events (id, report_id, type, visibility, public_status, created_at) values (${`${input.id}-communicated`}, ${input.id}, 'ReportCommunicated', 'public', 'communicated', '2026-01-03T10:00:00Z')`;
    }
    if (publicStatus === "resolved") {
      await sql`insert into report_events (id, report_id, type, visibility, public_status, created_at) values (${`${input.id}-resolved`}, ${input.id}, 'ReportResolved', 'public', 'resolved', '2026-01-04T10:00:00Z')`;
    }
  });
}

async function createSentTransmission(reportId: string): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`
      insert into outbound_communications (
        id, report_id, recipient_id, recipient_name_snapshot, recipient_organization_snapshot, recipient_address_snapshot,
        channel, subject, body, status, created_at, sent_at
      ) values (
        'e2e-operational-transmission', ${reportId}, ${recipientId}, 'Ufficio Registro', 'Comune di Venafro', 'registro@pec.example.test',
        'pec', 'Oggetto registro', 'Corpo registro', 'sent', '2026-01-05T10:00:00Z', '2026-01-05T10:30:00Z'
      )
    `;
    await sql`insert into transmission_reports (transmission_id, report_id, created_at) values ('e2e-operational-transmission', ${reportId}, '2026-01-05T10:00:00Z')`;
    await sql`insert into report_events (id, report_id, type, visibility, metadata, created_at) values (${`${reportId}-transmission-sent`}, ${reportId}, 'TransmissionSent', 'internal', '{"transmissionId":"e2e-operational-transmission","transmissionStatus":"sent"}'::jsonb, '2026-01-05T10:30:00Z')`;
  });
}

async function readReportCategory(publicCode: string): Promise<string> {
  return withDatabase(async (sql) => {
    const rows = await sql<{ category_id: string }[]>`select category_id from reports where public_code = ${publicCode}`;
    return rows[0]?.category_id ?? "";
  });
}

async function cleanupE2eData(): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`delete from transmission_reports where report_id in ${sql(reportIds)} or transmission_id = 'e2e-operational-transmission'`;
    await sql`delete from outbound_communications where report_id in ${sql(reportIds)} or id = 'e2e-operational-transmission'`;
    await sql`delete from report_events where report_id in ${sql(reportIds)}`;
    await sql`delete from report_confirmations where report_id in ${sql(reportIds)}`;
    await sql`delete from report_attachments where report_id in ${sql(reportIds)}`;
    await sql`delete from reports where id in ${sql(reportIds)}`;
    await sql`delete from category_recipients where category_id in ${sql([categoryId, changedCategoryId])} or recipient_id = ${recipientId}`;
    await sql`delete from recipients where id = ${recipientId}`;
    await sql`delete from categories where id in ${sql([categoryId, changedCategoryId])}`;
    await sql`delete from admin_users where id = ${adminId} or email = ${adminEmail}`;
  });
}

async function withDatabase<T>(callback: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for operational registry e2e tests.");
  const sql = postgres(databaseUrl, { max: 1 });
  try { return await callback(sql); } finally { await sql.end(); }
}

async function hashPassword(password: string): Promise<string> {
  const nonce = randomBytes(16);
  const derivedKey = await argon2Async("argon2id", { message: password, nonce, memory: 65_536, passes: 3, parallelism: 1, tagLength: 32 });
  return ["argon2id", "v=19", "m=65536,t=3,p=1", nonce.toString("base64url"), derivedKey.toString("base64url")].join("$");
}

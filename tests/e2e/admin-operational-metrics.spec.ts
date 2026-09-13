import { expect, test, type Page } from "@playwright/test";
import { argon2, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";

const argon2Async = promisify(argon2);
const adminEmail = "metrics-admin.e2e@example.com";
const adminPassword = "Correct horse battery staple metrics 2026!";
const adminId = "e2e-metrics-admin";
const categoryIds = ["e2e-metrics-roads", "e2e-metrics-lighting"];
const reportIds = [
  "e2e-metrics-pending",
  "e2e-metrics-reported",
  "e2e-metrics-communicated",
  "e2e-metrics-resolved",
  "e2e-metrics-rejected"
];

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await cleanupE2eData();
  await createAdmin();
  await seedMetricsData();
});

test.afterEach(async () => {
  await cleanupE2eData();
});

test("admin sees operational metrics on the dashboard", async ({ page }) => {
  await loginAdmin(page);

  await expect(page.getByRole("heading", { name: "Area amministrativa" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Utilizzo e risultati" })).toBeVisible();
  await expect(page.getByTestId("metric-total-received")).toContainText(/Totale ricevute\d+/);
  await expect(page.getByTestId("metric-published")).toContainText(/Pubblicate\d+/);
  await expect(page.getByTestId("metric-communicated")).toContainText(/Comunicate\d+/);
  await expect(page.getByTestId("metric-resolved")).toContainText(/Risolte\d+/);
  await expect(page.getByTestId("metric-total-confirmations")).toContainText(/Conferme totali\d+/);
  await expect(page.getByTestId("metric-resolution-rate")).toContainText("Tasso di risoluzione");
  await expect(page.getByRole("row", { name: /Categoria E2E metriche strade\s+2\s+0/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Categoria E2E metriche luce\s+1\s+1/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Andamento ultimi 6 mesi" })).toBeVisible();
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

async function seedMetricsData(): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`
      insert into categories (id, name, slug, active)
      values
        ('e2e-metrics-roads', 'Categoria E2E metriche strade', 'e2e-metrics-roads', true),
        ('e2e-metrics-lighting', 'Categoria E2E metriche luce', 'e2e-metrics-lighting', true)
    `;

    await sql`
      insert into reports (
        id, public_code, title, description, category_id, latitude, longitude, address,
        public_status, moderation_status, created_at, published_at, communicated_at, resolved_at
      ) values
        (
          'e2e-metrics-pending', 'VC-E2EMETP1', 'Segnalazione metriche pending',
          'Descrizione E2E metriche pending.', 'e2e-metrics-roads', 41.482, 14.043, 'Venafro',
          null, 'pending_review', '2026-09-01T10:00:00Z', null, null, null
        ),
        (
          'e2e-metrics-reported', 'VC-E2EMETR1', 'Segnalazione metriche pubblicata',
          'Descrizione E2E metriche pubblicata.', 'e2e-metrics-roads', 41.482, 14.043, 'Venafro',
          'reported', 'approved', '2026-09-02T10:00:00Z', '2026-09-03T10:00:00Z', null, null
        ),
        (
          'e2e-metrics-communicated', 'VC-E2EMETC1', 'Segnalazione metriche comunicata',
          'Descrizione E2E metriche comunicata.', 'e2e-metrics-roads', 41.482, 14.043, 'Venafro',
          'communicated', 'approved', '2026-09-04T10:00:00Z', '2026-09-05T10:00:00Z', '2026-09-06T10:00:00Z', null
        ),
        (
          'e2e-metrics-resolved', 'VC-E2EMETS1', 'Segnalazione metriche risolta',
          'Descrizione E2E metriche risolta.', 'e2e-metrics-lighting', 41.482, 14.043, 'Venafro',
          'resolved', 'approved', '2026-09-07T10:00:00Z', '2026-09-08T10:00:00Z', '2026-09-09T10:00:00Z', '2026-09-10T10:00:00Z'
        ),
        (
          'e2e-metrics-rejected', 'VC-E2EMETJ1', 'Segnalazione metriche rifiutata',
          'Descrizione E2E metriche rifiutata.', 'e2e-metrics-lighting', 41.482, 14.043, 'Venafro',
          null, 'rejected', '2026-09-11T10:00:00Z', null, null, null
        )
    `;

    await sql`
      insert into report_confirmations (id, report_id, anti_abuse_key)
      values
        ('e2e-metrics-confirmation-a', 'e2e-metrics-reported', 'e2e-metrics-a'),
        ('e2e-metrics-confirmation-b', 'e2e-metrics-resolved', 'e2e-metrics-b')
    `;
  });
}

async function cleanupE2eData(): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`delete from report_confirmations where report_id in ${sql(reportIds)} or id like 'e2e-metrics-confirmation-%'`;
    await sql`delete from report_events where report_id in ${sql(reportIds)}`;
    await sql`delete from report_attachments where report_id in ${sql(reportIds)}`;
    await sql`delete from reports where id in ${sql(reportIds)}`;
    await sql`delete from categories where id in ${sql(categoryIds)} or slug in ('e2e-metrics-roads', 'e2e-metrics-lighting')`;
    await sql`delete from admin_users where id = ${adminId} or email = ${adminEmail}`;
  });
}

async function withDatabase<T>(callback: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for operational metrics e2e tests.");
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


import { expect, test, type Browser, type Page } from "@playwright/test";
import postgres from "postgres";

const categoryId = "e2e-confirmations-category";
const approvedCode = "VC-E2ECONF1";
const pendingCode = "VC-E2EPEND1";
const rejectedCode = "VC-E2EREJ11";
const reportIds = [
  "e2e-confirmation-approved",
  "e2e-confirmation-pending",
  "e2e-confirmation-rejected"
];

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await cleanupE2eData();
  await withDatabase(async (sql) => {
    await sql`
      insert into categories (id, name, slug, active)
      values (${categoryId}, 'Categoria conferme E2E', 'categoria-conferme-e2e', true)
    `;
    await createReport(sql, {
      id: "e2e-confirmation-approved",
      publicCode: approvedCode,
      moderationStatus: "approved",
      publicStatus: "reported",
      publishedAt: "2026-01-04T10:00:00.000Z"
    });
    await createReport(sql, {
      id: "e2e-confirmation-pending",
      publicCode: pendingCode,
      moderationStatus: "pending_review",
      publicStatus: null,
      publishedAt: null
    });
    await createReport(sql, {
      id: "e2e-confirmation-rejected",
      publicCode: rejectedCode,
      moderationStatus: "rejected",
      publicStatus: null,
      publishedAt: null
    });
  });
});

test.afterEach(async () => {
  await cleanupE2eData();
});

test("confirms a public report once per browser and counts a second anonymous browser", async ({ browser, page }) => {
  await page.goto(`/segnalazioni/${approvedCode}`);

  await expect(page.getByText("Nessuna conferma ricevuta")).toBeVisible();
  await page.getByRole("button", { name: "Conferma anche tu" }).click();
  await expect(page.getByText("Hai confermato questa segnalazione.")).toBeVisible();
  await expect(page.getByText("1 conferma ricevuta")).toBeVisible();
  await expect(page.getByRole("button", { name: "Segnalazione confermata" })).toBeDisabled();

  await page.reload();
  await expect(page.getByText("1 conferma ricevuta")).toBeVisible();
  await expect(page.getByRole("button", { name: "Segnalazione confermata" })).toBeDisabled();

  const secondPage = await newAnonymousPage(browser);
  await secondPage.goto(`/segnalazioni/${approvedCode}`);
  await expect(secondPage.getByText("1 conferma ricevuta")).toBeVisible();
  await secondPage.getByRole("button", { name: "Conferma anche tu" }).click();
  await expect(secondPage.getByText("2 conferme ricevute")).toBeVisible();
  await secondPage.context().close();
});

test("does not expose confirmation CTA for pending or rejected reports", async ({ page }) => {
  await expectPublicDetailNotFound(page, pendingCode);
  await expectPublicDetailNotFound(page, rejectedCode);
});

async function expectPublicDetailNotFound(page: Page, publicCode: string): Promise<void> {
  const response = await page.goto(`/segnalazioni/${publicCode}`);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("button", { name: "Conferma anche tu" })).toHaveCount(0);
}

async function newAnonymousPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  return context.newPage();
}

async function createReport(
  sql: postgres.Sql,
  input: {
    id: string;
    publicCode: string;
    moderationStatus: "pending_review" | "approved" | "rejected";
    publicStatus: "reported" | null;
    publishedAt: string | null;
  }
): Promise<void> {
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
      ${input.id},
      ${input.publicCode},
      'Segnalazione conferme E2E',
      'Descrizione pubblica lunga della segnalazione usata nei test delle conferme.',
      ${categoryId},
      41.4821,
      14.0474,
      'Via Roma, Venafro',
      ${input.publicStatus},
      ${input.moderationStatus},
      '2026-01-01T10:00:00.000Z',
      ${input.publishedAt}
    )
  `;

  if (input.publicStatus) {
    await sql`
      insert into report_events (id, report_id, type, visibility, public_status, created_at)
      values (${`${input.id}-approved`}, ${input.id}, 'ReportApproved', 'public', ${input.publicStatus}, ${input.publishedAt})
    `;
  }
}

async function cleanupE2eData(): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`delete from report_confirmations where report_id in ${sql(reportIds)}`;
    await sql`delete from report_events where report_id in ${sql(reportIds)}`;
    await sql`delete from reports where id in ${sql(reportIds)} or category_id = ${categoryId}`;
    await sql`delete from categories where id = ${categoryId} or slug = 'categoria-conferme-e2e'`;
  });
}

async function withDatabase<T>(callback: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for report confirmation e2e tests.");
  }

  const sql = postgres(databaseUrl, { max: 1 });

  try {
    return await callback(sql);
  } finally {
    await sql.end();
  }
}

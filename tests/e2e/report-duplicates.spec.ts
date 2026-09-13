import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const categoryId = "e2e-duplicates-roads";
const otherCategoryId = "e2e-duplicates-lighting";
const categoryName = "Duplicati E2E strade";
const otherCategoryName = "Duplicati E2E illuminazione";
const existingDuplicateCode = "VC-E2EDUP01";
const existingDifferentCategoryCode = "VC-E2EDIF01";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await cleanupE2eData();
  await withDatabase(async (sql) => {
    await sql`
      insert into categories (id, name, slug, active)
      values
        (${categoryId}, ${categoryName}, 'duplicati-e2e-strade', true),
        (${otherCategoryId}, ${otherCategoryName}, 'duplicati-e2e-illuminazione', true)
    `;
  });
});

test.afterEach(async () => {
  await cleanupE2eData();
});

test("shows a nearby approved report as a possible duplicate and opens its public detail", async ({ page }) => {
  await createApprovedReport({
    id: "e2e-duplicate-existing",
    publicCode: existingDuplicateCode,
    category: categoryId,
    title: "Buca gia segnalata in Via Roma",
    latitude: 41.4821,
    longitude: 14.0474
  });

  await fillReportForm(page, { category: categoryId, latitude: "41.48215", longitude: "14.04745" });
  await page.getByRole("button", { name: "Invia segnalazione" }).click();

  await expect(page.getByRole("heading", { name: "Potrebbe esistere gia una segnalazione simile" })).toBeVisible();
  await expect(page.getByText("Buca gia segnalata in Via Roma")).toBeVisible();
  await expect(page.getByText(/Circa \d+ m/)).toBeVisible();

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("link", { name: "Vedi segnalazione" }).click();
  const detailPage = await popupPromise;
  await expect(detailPage).toHaveURL(new RegExp(`/segnalazioni/${existingDuplicateCode}$`));
  await expect(detailPage.getByRole("heading", { name: "Buca gia segnalata in Via Roma" })).toBeVisible();
});

test("does not show a duplicate warning for the same area but a different category", async ({ page }) => {
  await createApprovedReport({
    id: "e2e-duplicate-different-category",
    publicCode: existingDifferentCategoryCode,
    category: otherCategoryId,
    title: "Lampione gia segnalato nella stessa zona",
    latitude: 41.4821,
    longitude: 14.0474
  });

  await fillReportForm(page, { category: categoryId, latitude: "41.48215", longitude: "14.04745" });
  await page.getByRole("button", { name: "Invia segnalazione" }).click();

  await expect(page.getByRole("heading", { name: "Potrebbe esistere gia una segnalazione simile" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Conserva il tuo codice" })).toBeVisible();
});

test("lets the user continue and create a report after declaring the problem is different", async ({ page }) => {
  await createApprovedReport({
    id: "e2e-duplicate-existing",
    publicCode: existingDuplicateCode,
    category: categoryId,
    title: "Buca gia segnalata in Via Roma",
    latitude: 41.4821,
    longitude: 14.0474
  });

  await fillReportForm(page, { category: categoryId, latitude: "41.48215", longitude: "14.04745" });
  await page.getByRole("button", { name: "Invia segnalazione" }).click();

  await expect(page.getByRole("heading", { name: "Potrebbe esistere gia una segnalazione simile" })).toBeVisible();
  await page.getByRole("button", { name: "Il mio problema e diverso, continua" }).click();

  await expect(page.getByRole("heading", { name: "Conserva il tuo codice" })).toBeVisible();
  await expect(page.getByText(/VC-[0-9A-Z]{8}/)).toBeVisible();
});

async function fillReportForm(
  page: Page,
  input: { category: string; latitude: string; longitude: string }
): Promise<void> {
  await page.goto("/segnala");
  await page.getByLabel("Che tipo di problema vuoi segnalare?").selectOption(input.category);
  await page.getByLabel("Inserisci indirizzo").fill("Via Roma, Venafro");
  await page.getByLabel("Latitudine").fill(input.latitude);
  await page.getByLabel("Longitudine").fill(input.longitude);
  await page
    .getByLabel("Descrivi il problema")
    .fill("Una buca profonda rende difficile il passaggio pedonale vicino alla scuola.");
}

async function createApprovedReport(input: {
  id: string;
  publicCode: string;
  category: string;
  title: string;
  latitude: number;
  longitude: number;
}): Promise<void> {
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
        public_status,
        moderation_status,
        created_at,
        published_at
      ) values (
        ${input.id},
        ${input.publicCode},
        ${input.title},
        'Descrizione pubblica lunga della segnalazione duplicata usata nei test end-to-end.',
        ${input.category},
        ${input.latitude},
        ${input.longitude},
        'Via Roma, Venafro',
        'reported',
        'approved',
        '2026-01-05T09:00:00.000Z',
        now()
      )
    `;
    await sql`
      insert into report_events (id, report_id, type, visibility, public_status, created_at)
      values (${`${input.id}-approved`}, ${input.id}, 'ReportApproved', 'public', 'reported', now())
    `;
  });
}

async function cleanupE2eData(): Promise<void> {
  await withDatabase(async (sql) => {
    const reportRows = await sql<{ id: string }[]>`
      select id from reports where id like 'e2e-duplicate-%' or category_id in (${categoryId}, ${otherCategoryId})
    `;
    const reportIds = reportRows.map((row) => row.id);

    if (reportIds.length > 0) {
      await sql`delete from report_events where report_id in ${sql(reportIds)}`;
      await sql`delete from report_attachments where report_id in ${sql(reportIds)}`;
      await sql`delete from reports where id in ${sql(reportIds)}`;
    }

    await sql`delete from categories where id in (${categoryId}, ${otherCategoryId})`;
  });
}

async function withDatabase<T>(callback: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for report duplicate e2e tests.");
  }

  const sql = postgres(databaseUrl, { max: 1 });

  try {
    return await callback(sql);
  } finally {
    await sql.end();
  }
}

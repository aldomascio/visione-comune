import { expect, test } from "@playwright/test";
import postgres from "postgres";

const categoryId = "e2e-home-category";
const newsPublishedId = "e2e-home-news-published";
const newsDraftId = "e2e-home-news-draft";
const reportedReportId = "e2e-home-reported";
const communicatedReportId = "e2e-home-communicated";
const resolvedReportId = "e2e-home-resolved";
const confirmationId = "e2e-home-confirmation";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await cleanupE2eData();
  await seedHomeData();
});

test.afterEach(async () => {
  await cleanupE2eData();
});

test("public home explains the platform and links to the main public flows", async ({ page }) => {
  await page.goto("/");

  const main = page.locator("main");
  await expect(main.getByRole("heading", { level: 1, name: /Segnala un problema, segui il percorso/ })).toBeVisible();
  await expect(main.getByText("Visione Comune raccoglie segnalazioni civiche")).toBeVisible();
  await expect(main.getByRole("heading", { name: "Le funzioni principali" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Dal primo invio alla traccia pubblica" })).toBeVisible();

  await main.getByRole("link", { name: "Segnala un problema", exact: true }).first().click();
  await expect(page).toHaveURL(/\/segnala$/);

  await page.goto("/");
  await main.getByRole("link", { name: "Esplora la mappa", exact: true }).first().click();
  await expect(page).toHaveURL(/\/mappa$/);

  await page.goto("/");
  await main.getByRole("link", { name: "Controlla lo stato", exact: true }).click();
  await expect(page).toHaveURL(/\/segnalazione$/);

  await page.goto("/");
  await main.getByRole("link", { name: "Vedi tutte le notizie", exact: true }).click();
  await expect(page).toHaveURL(/\/notizie$/);

  await page.goto("/");
  await main.getByRole("link", { name: "Iscriviti alla newsletter", exact: true }).click();
  await expect(page).toHaveURL(/\/newsletter$/);
});

test("public home shows public metrics, latest published news and recent resolved reports", async ({ page }) => {
  await page.goto("/");
  const main = page.locator("main");

  await expect(page.getByTestId("home-metric-published")).toContainText("Segnalazioni pubblicate");
  await expect(page.getByTestId("home-metric-communicated")).toContainText("Comunicate agli enti");
  await expect(page.getByTestId("home-metric-resolved")).toContainText("Problemi risolti");
  await expect(page.getByTestId("home-metric-totalConfirmations")).toContainText("Conferme ricevute");
  await expect(page.getByTestId("home-metric-resolutionRate")).toContainText("Tasso di risoluzione");

  await expect(main.getByRole("heading", { name: "Notizia Home E2E pubblicata" })).toBeVisible();
  await expect(main.getByText("Bozza Home E2E nascosta")).toHaveCount(0);
  await main.getByRole("link", { name: "Leggi aggiornamento" }).first().click();
  await expect(page).toHaveURL(/\/notizie\/notizia-home-e2e-pubblicata$/);

  await page.goto("/");
  await expect(main.getByRole("heading", { name: "Segnalazione Home E2E risolta" })).toBeVisible();
  await main
    .getByRole("link", { name: /Segnalazione Home E2E risolta/ })
    .click();
  await expect(page).toHaveURL(/\/segnalazioni\/VC-E2EHM4CC$/);
});

test("public home remains usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: /Segnala un problema, segui il percorso/ })).toBeVisible();
  await page.getByRole("button", { name: "Apri menu principale" }).click();
  await expect(page.getByRole("navigation", { name: "Navigazione principale mobile" })).toBeVisible();
  await page.getByRole("navigation", { name: "Navigazione principale mobile" }).getByRole("link", { name: "Newsletter" }).click();
  await expect(page).toHaveURL(/\/newsletter$/);
});

async function seedHomeData(): Promise<void> {
  const publishedContentJson = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Contenuto della notizia pubblicata." }] }] };
  const draftContentJson = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Contenuto bozza." }] }] };

  await withDatabase(async (sql) => {
    await sql`
      insert into categories (id, name, slug, active)
      values (${categoryId}, 'Categoria Home E2E', 'categoria-home-e2e', true)
    `;

    await sql`
      insert into reports (
        id, public_code, title, description, category_id, latitude, longitude, address,
        public_status, moderation_status, created_at, published_at, communicated_at, resolved_at
      ) values
        (
          ${reportedReportId}, 'VC-E2EHM2AA', 'Segnalazione Home E2E pubblicata',
          'Descrizione E2E pubblicata.', ${categoryId}, 41.482, 14.043, 'Venafro',
          'reported', 'approved', '2026-09-01T10:00:00Z', '2026-09-02T10:00:00Z', null, null
        ),
        (
          ${communicatedReportId}, 'VC-E2EHM3BB', 'Segnalazione Home E2E comunicata',
          'Descrizione E2E comunicata.', ${categoryId}, 41.483, 14.044, 'Venafro',
          'communicated', 'approved', '2026-09-03T10:00:00Z', '2026-09-04T10:00:00Z', '2026-09-05T10:00:00Z', null
        ),
        (
          ${resolvedReportId}, 'VC-E2EHM4CC', 'Segnalazione Home E2E risolta',
          'Descrizione E2E risolta.', ${categoryId}, 41.484, 14.045, 'Venafro',
          'resolved', 'approved', '2026-09-06T10:00:00Z', '2026-09-07T10:00:00Z', '2026-09-08T10:00:00Z', '2026-09-09T10:00:00Z'
        )
    `;

    await sql`
      insert into report_confirmations (id, report_id, anti_abuse_key)
      values (${confirmationId}, ${reportedReportId}, 'e2e-home-confirmation-key')
    `;

    await sql`
      insert into news_posts (
        id, title, slug, excerpt, featured_image_url, featured_image_alt, content, content_json,
        status, published_at, created_at, updated_at
      ) values
        (
          ${newsPublishedId}, 'Notizia Home E2E pubblicata', 'notizia-home-e2e-pubblicata',
          'Estratto della notizia pubblicata visibile in Home.', null, null,
          'Contenuto della notizia pubblicata.',
          ${sql.json(publishedContentJson)},
          'published', '2026-09-10T10:00:00Z', '2026-09-10T09:00:00Z', '2026-09-10T09:00:00Z'
        ),
        (
          ${newsDraftId}, 'Bozza Home E2E nascosta', 'bozza-home-e2e-nascosta',
          'Questa bozza non deve comparire in Home.', null, null,
          'Contenuto bozza.',
          ${sql.json(draftContentJson)},
          'draft', null, '2026-09-10T09:00:00Z', '2026-09-10T09:00:00Z'
        )
    `;
  });
}

async function cleanupE2eData(): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`delete from report_confirmations where id = ${confirmationId} or report_id in (${reportedReportId}, ${communicatedReportId}, ${resolvedReportId})`;
    await sql`delete from report_events where report_id in (${reportedReportId}, ${communicatedReportId}, ${resolvedReportId})`;
    await sql`delete from report_attachments where report_id in (${reportedReportId}, ${communicatedReportId}, ${resolvedReportId})`;
    await sql`delete from reports where id in (${reportedReportId}, ${communicatedReportId}, ${resolvedReportId})`;
    await sql`delete from categories where id = ${categoryId} or slug = 'categoria-home-e2e'`;
    await sql`delete from news_posts where id in (${newsPublishedId}, ${newsDraftId}) or slug in ('notizia-home-e2e-pubblicata', 'bozza-home-e2e-nascosta')`;
  });
}

async function withDatabase<T>(callback: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for home e2e tests.");
  }

  const sql = postgres(databaseUrl, { max: 1 });

  try {
    return await callback(sql);
  } finally {
    await sql.end();
  }
}

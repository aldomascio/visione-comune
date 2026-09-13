import { expect, test } from "@playwright/test";
import postgres from "postgres";

const categoryId = "e2e-public-map-category";
const categoryName = "Categoria mappa E2E";
const approvedCode = "VC-MAPAPP01";
const secondApprovedCode = "VC-MAPAPP02";
const pendingCode = "VC-MAPPEN01";
const rejectedCode = "VC-MAPREJ01";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await cleanupE2eData();
  await seedPublicMapData();
});

test.afterEach(async () => {
  await cleanupE2eData();
});

test("shows only approved public reports on the map page and opens the public detail", async ({ page }) => {
  await page.goto("/mappa");

  await expect(page.getByRole("heading", { name: "Mappa delle segnalazioni" })).toBeVisible();
  await expect(page.getByTestId("public-reports-map")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Segnalazione approvata mappa E2E", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Seconda segnalazione approvata mappa E2E", exact: true })).toBeVisible();
  await expect(page.getByText("Segnalazione pending mappa E2E")).toHaveCount(0);
  await expect(page.getByText("Segnalazione rifiutata mappa E2E")).toHaveCount(0);

  await page
    .locator("li")
    .filter({ hasText: "Seconda segnalazione approvata mappa E2E" })
    .getByRole("link", { name: "Vedi segnalazione" })
    .click();

  await expect(page).toHaveURL(new RegExp(`/segnalazioni/${secondApprovedCode}$`));
  await expect(page.getByText(secondApprovedCode)).toBeVisible();
  await expect(page.getByText("Seconda descrizione pubblica per la mappa E2E.")).toBeVisible();
});

async function seedPublicMapData(): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`
      insert into categories (id, name, slug, active)
      values (${categoryId}, ${categoryName}, 'categoria-mappa-e2e', true)
      on conflict (id) do update set name = excluded.name, slug = excluded.slug, active = true
    `;

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
      ) values
        (
          'e2e-map-approved-1',
          ${approvedCode},
          'Segnalazione approvata mappa E2E',
          'Descrizione pubblica per la mappa E2E.',
          ${categoryId},
          41.4821,
          14.0474,
          'Via Roma, Venafro',
          'reported',
          'approved',
          '2026-01-01T09:00:00.000Z',
          '2026-01-02T09:00:00.000Z'
        ),
        (
          'e2e-map-approved-2',
          ${secondApprovedCode},
          'Seconda segnalazione approvata mappa E2E',
          'Seconda descrizione pubblica per la mappa E2E.',
          ${categoryId},
          41.486,
          14.05,
          'Corso Campano, Venafro',
          'reported',
          'approved',
          '2026-01-03T09:00:00.000Z',
          '2026-01-04T09:00:00.000Z'
        ),
        (
          'e2e-map-pending',
          ${pendingCode},
          'Segnalazione pending mappa E2E',
          'Descrizione non pubblica pending mappa E2E.',
          ${categoryId},
          41.49,
          14.052,
          'Via non pubblica, Venafro',
          null,
          'pending_review',
          '2026-01-05T09:00:00.000Z',
          null
        ),
        (
          'e2e-map-rejected',
          ${rejectedCode},
          'Segnalazione rifiutata mappa E2E',
          'Descrizione non pubblica rifiutata mappa E2E.',
          ${categoryId},
          41.491,
          14.053,
          'Via rifiutata, Venafro',
          null,
          'rejected',
          '2026-01-06T09:00:00.000Z',
          null
        )
    `;
  });
}

async function cleanupE2eData(): Promise<void> {
  await withDatabase(async (sql) => {
    const reportRows = await sql<{ id: string }[]>`
      select id from reports where id like 'e2e-map-%' or category_id = ${categoryId}
    `;
    const reportIds = reportRows.map((row) => row.id);

    if (reportIds.length > 0) {
      await sql`delete from report_events where report_id in ${sql(reportIds)}`;
      await sql`delete from reports where id in ${sql(reportIds)}`;
    }

    await sql`delete from categories where id = ${categoryId} or slug = 'categoria-mappa-e2e'`;
  });
}

async function withDatabase<T>(callback: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for public map e2e tests.");
  }

  const sql = postgres(databaseUrl, { max: 1 });

  try {
    return await callback(sql);
  } finally {
    await sql.end();
  }
}

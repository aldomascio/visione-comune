import { expect, test } from "@playwright/test";
import postgres from "postgres";

const categoryId = "e2e-report-category";
const categoryName = "Categoria E2E (provvisoria)";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await cleanupE2eData();
  await withDatabase(async (sql) => {
    await sql`
      insert into categories (id, name, slug, active)
      values (${categoryId}, ${categoryName}, 'categoria-e2e-provvisoria', true)
      on conflict (id) do update set name = excluded.name, slug = excluded.slug, active = true
    `;
  });
});

test.afterEach(async () => {
  await cleanupE2eData();
});

test("submits an anonymous report and shows the public code", async ({ page }) => {
  await page.goto("/segnala");

  await page.getByLabel("Che tipo di problema vuoi segnalare?").selectOption(categoryId);
  await page.getByLabel("Inserisci indirizzo").fill("Via Roma, Venafro");
  await page.getByLabel("Latitudine").fill("41.4821");
  await page.getByLabel("Longitudine").fill("14.0474");
  await page
    .getByLabel("Descrivi il problema")
    .fill("Una buca profonda rende difficile il passaggio pedonale vicino alla scuola.");
  await page.getByRole("button", { name: "Invia segnalazione" }).click();

  await expect(page.getByRole("heading", { name: "Conserva il tuo codice" })).toBeVisible();
  await expect(page.getByText(/VC-[0-9A-Z]{8}/)).toBeVisible();
  await expect(page.getByText("La segnalazione non viene pubblicata automaticamente.")).toBeVisible();
});

test("continues when geolocation permission is denied", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (
          _success: PositionCallback,
          error?: PositionErrorCallback
        ) => {
          error?.({
            code: 1,
            message: "User denied Geolocation",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3
          } as GeolocationPositionError);
        }
      }
    });
  });

  await page.goto("/segnala");

  await page.getByRole("button", { name: "Usa la mia posizione" }).click();
  await expect(page.getByText("Permesso negato.")).toBeVisible();

  await page.getByLabel("Che tipo di problema vuoi segnalare?").selectOption(categoryId);
  await page.getByLabel("Inserisci indirizzo").fill("Via Roma, Venafro");
  await page.getByLabel("Latitudine").fill("41.4821");
  await page.getByLabel("Longitudine").fill("14.0474");
  await page
    .getByLabel("Descrivi il problema")
    .fill("Una buca profonda rende difficile il passaggio pedonale vicino alla scuola.");
  await page.getByRole("button", { name: "Invia segnalazione" }).click();

  await expect(page.getByRole("heading", { name: "Conserva il tuo codice" })).toBeVisible();
  await expect(page.getByText(/VC-[0-9A-Z]{8}/)).toBeVisible();
});

async function cleanupE2eData(): Promise<void> {
  await withDatabase(async (sql) => {
    const reportRows = await sql<{ id: string }[]>`
      select id from reports where category_id = ${categoryId}
    `;
    const reportIds = reportRows.map((row) => row.id);

    if (reportIds.length > 0) {
      await sql`delete from report_events where report_id in ${sql(reportIds)}`;
      await sql`delete from reports where id in ${sql(reportIds)}`;
    }

    await sql`delete from categories where id = ${categoryId} or slug = 'categoria-e2e-provvisoria'`;
  });
}

async function withDatabase<T>(callback: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for report submission e2e tests.");
  }

  const sql = postgres(databaseUrl, { max: 1 });

  try {
    return await callback(sql);
  } finally {
    await sql.end();
  }
}

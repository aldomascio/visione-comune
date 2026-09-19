import { expect, test, type Page } from "@playwright/test";
import { argon2, randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";
import { promisify } from "node:util";
import postgres from "postgres";
import sharp from "sharp";

const categoryId = "e2e-report-category";
const categoryName = "Categoria E2E (provvisoria)";
const adminEmail = "report-upload-admin.e2e@example.com";
const adminPassword = "Correct horse battery upload 2026!";
const argon2Async = promisify(argon2);
const defaultTitle = "Buca profonda vicino alla scuola";
const defaultDescription = "Una buca profonda rende difficile il passaggio pedonale vicino alla scuola.";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await cleanupE2eData();
  await withDatabase(async (sql) => {
    await createAdmin(sql);
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

test("submits an anonymous report from an address suggestion and shows the public code", async ({ page }) => {
  await mockGeocoding(page);
  await page.goto("/segnala");

  await completeProblemStep(page);
  await completeLocationStepWithAddress(page);
  await skipPhotoStep(page);
  await submitReviewStep(page);

  await expectSuccessState(page);

  const publicCode = await readPublicCode(page);
  await expect(readReportLocation(publicCode)).resolves.toEqual({
    address: "Via Roma, Venafro, Molise, Italia",
    latitude: 41.4821,
    longitude: 14.0474,
    source: "platform",
    createdByAdminId: null
  });
  await expect(page.getByLabel("Fonte")).toHaveCount(0);
});

test("preserves entered data while moving back and forward through the wizard", async ({ page }) => {
  await mockGeocoding(page);
  await page.goto("/segnala");

  await startWizard(page);
  await page.getByText(categoryName, { exact: true }).click();
  await page.getByLabel("Titolo").fill(defaultTitle);
  await page.getByLabel("Descrivi il problema").fill(defaultDescription);
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Dove si trova?" })).toBeVisible();

  await page.getByRole("button", { name: "Indietro" }).click();
  await expect(page.getByRole("radio", { name: categoryName })).toBeChecked();
  await expect(page.getByLabel("Titolo")).toHaveValue(defaultTitle);
  await expect(page.getByLabel("Descrivi il problema")).toHaveValue(defaultDescription);

  await page.getByRole("button", { name: "Continua" }).click();
  await selectAddressSuggestion(page, "Via Roma, Venafro");
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Vuoi aggiungere una foto?" })).toBeVisible();

  await page.getByRole("button", { name: "Indietro" }).click();
  await expect(page.getByLabel("Inserisci indirizzo")).toHaveValue("Via Roma, Venafro, Molise, Italia");
  await expect(page.getByTestId("report-location-map")).toBeVisible();
  await expect(page.getByTestId("report-location-marker")).toHaveCount(0);
});

test("continues when geolocation permission is denied and the user selects an address", async ({ page }) => {
  await mockGeocoding(page);
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
  await completeProblemStep(page);

  await page.getByRole("button", { name: "Usa la mia posizione" }).click();
  await expect(page.getByText(/Permesso negato/)).toBeVisible();
  await expect(page.getByTestId("report-location-map")).toBeVisible();
  await expect(page.getByTestId("report-location-marker")).toHaveCount(0);
  await selectAddressSuggestion(page, "Via Roma, Venafro");
  await page.getByRole("button", { name: "Continua" }).click();
  await skipPhotoStep(page);
  await submitReviewStep(page);

  await expectSuccessState(page);
});

test("uses browser geolocation and reverse geocoding", async ({ page }) => {
  await mockGeocoding(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) => {
          success({
            coords: {
              latitude: 41.4836,
              longitude: 14.0443,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null
            },
            timestamp: Date.now()
          } as GeolocationPosition);
        }
      }
    });
  });

  await page.goto("/segnala");
  await completeProblemStep(page, "Un punto luce spento rende poco sicuro il passaggio serale.");
  await page.getByRole("button", { name: "Usa la mia posizione" }).click();
  await expect(page.getByLabel("Inserisci indirizzo")).toHaveValue("Corso Campano, Venafro, Molise, Italia");
  await page.getByRole("button", { name: "Continua" }).click();
  await skipPhotoStep(page);
  await submitReviewStep(page);

  await expectSuccessState(page);
});

test("requires a new location confirmation after editing a selected address", async ({ page }) => {
  await mockGeocoding(page);
  await page.goto("/segnala");

  await completeProblemStep(page);
  await selectAddressSuggestion(page, "Via Roma, Venafro");
  await page.getByLabel("Inserisci indirizzo").fill("Via modificata senza selezione");
  await expect(page.getByLabel("Inserisci indirizzo")).toHaveValue("Via modificata senza selezione");
  await expect(page.locator('input[name="latitude"]')).toHaveValue("");
  await expect(page.locator('input[name="longitude"]')).toHaveValue("");
  await page.getByRole("button", { name: "Continua" }).click();

  await expect(page.getByText("Seleziona la posizione del problema.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Segnalazione ricevuta" })).toHaveCount(0);
});

test("continues with address selection after address search provider fails", async ({ page }) => {
  await mockGeocoding(page);
  await page.goto("/segnala");

  await completeProblemStep(page);
  await page.getByLabel("Inserisci indirizzo").fill("fail provider");
  await expect(page.getByText(/Non siamo riusciti a trovare l'indirizzo/)).toBeVisible();
  await expect(page.getByTestId("report-location-map")).toBeVisible();
  await expect(page.getByTestId("report-location-marker")).toHaveCount(0);
  await selectAddressSuggestion(page, "Via Roma, Venafro");
  await page.getByRole("button", { name: "Continua" }).click();
  await skipPhotoStep(page);
  await submitReviewStep(page);

  await expectSuccessState(page);
});

test("previews, removes, and reselects a photo before submitting", async ({ page }) => {
  await mockGeocoding(page);
  await page.goto("/segnala");

  await completeProblemStep(page, "Una buca profonda con foto rende difficile il passaggio pedonale vicino alla scuola.");
  await completeLocationStepWithAddress(page);
  await expect(page.getByRole("heading", { name: "Vuoi aggiungere una foto?" })).toBeVisible();

  await page.setInputFiles("#photo", { name: "prima.png", mimeType: "image/png", buffer: await validPng("red") });
  await expect(page.getByAltText("Anteprima della foto selezionata")).toBeVisible();
  await expect(page.getByText("prima.png")).toHaveCount(0);
  await page.getByRole("button", { name: "Rimuovi foto" }).click();
  await expect(page.getByAltText("Anteprima della foto selezionata")).toHaveCount(0);

  await page.setInputFiles("#photo", { name: "problema.png", mimeType: "image/png", buffer: await validPng("blue") });
  await expect(page.getByAltText("Anteprima della foto selezionata")).toBeVisible();
  await expect(page.getByText("problema.png")).toHaveCount(0);
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Controlla la segnalazione" })).toBeVisible();
  await expect(page.getByText("problema.png")).toHaveCount(0);
  await submitReviewStep(page);

  await expectSuccessState(page);
});

test("submits a report with a photo, shows it to admin, then publishes it", async ({ page }) => {
  await mockGeocoding(page);
  await page.goto("/segnala");

  await completeProblemStep(page, "Una buca profonda con foto rende difficile il passaggio pedonale vicino alla scuola.");
  await completeLocationStepWithAddress(page);
  await page.setInputFiles("#photo", { name: "problema.png", mimeType: "image/png", buffer: await validPng("red") });
  await expect(page.getByAltText("Anteprima della foto selezionata")).toBeVisible();
  await page.getByRole("button", { name: "Continua" }).click();
  await submitReviewStep(page);

  await expectSuccessState(page);
  const publicCode = await readPublicCode(page);

  const pendingPhotoResponse = await page.request.get(`/api/report-images/${publicCode}`);
  expect(pendingPhotoResponse.status()).toBe(404);

  await loginAdmin(page);
  await page.goto(`/admin/segnalazioni/${publicCode}`);
  await expect(page.getByAltText(`Foto segnalazione ${publicCode}`)).toBeVisible();
  await expect(page.getByText("Foto da verificare")).toBeVisible();
  await page.getByRole("button", { name: "Approva", exact: true }).click();
  await expect(page.getByText("Segnalazione approvata e pubblicata come Segnalata.")).toBeVisible();

  const stillPendingPhotoResponse = await page.request.get(`/api/report-images/${publicCode}`);
  expect(stillPendingPhotoResponse.status()).toBe(404);

  await page.getByRole("button", { name: "Approva foto" }).click();
  await expect(page.getByText("Foto approvata.")).toBeVisible();

  const approvedPhotoResponse = await page.request.get(`/api/report-images/${publicCode}`);
  expect(approvedPhotoResponse.status()).toBe(200);
  expect(approvedPhotoResponse.headers()["content-type"]).toContain("image/jpeg");

  await page.goto(`/segnalazioni/${publicCode}`);
  await expect(page.getByAltText(`Foto della segnalazione ${publicCode}`)).toBeVisible();
  await expect(page.locator("body")).not.toContainText(".local-storage");
  await expect(page.getByText("Creato da")).toHaveCount(0);
  await expect(page.getByText(adminEmail)).toHaveCount(0);
});

test("rejects an invalid photo without creating a successful report", async ({ page }) => {
  await mockGeocoding(page);
  await page.goto("/segnala");

  await completeProblemStep(page, "Una buca profonda con allegato non valido vicino alla scuola.");
  await completeLocationStepWithAddress(page);
  await page.setInputFiles("#photo", {
    name: "problema.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image")
  });
  await page.getByRole("button", { name: "Continua" }).click();
  await submitReviewStep(page);

  await expect(page.getByRole("heading", { name: "Vuoi aggiungere una foto?" })).toBeVisible();
  await expect(page.locator("#photo-error")).toHaveText("La foto deve essere JPEG, PNG o WebP.");
  await expect(page.getByRole("heading", { name: "Segnalazione ricevuta" })).toHaveCount(0);
});

test("works on a narrow mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockGeocoding(page);
  await page.goto("/segnala");

  await completeProblemStep(page);
  await completeLocationStepWithAddress(page);
  await skipPhotoStep(page);
  await submitReviewStep(page);

  await expectSuccessState(page);
});

async function startWizard(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Segnala un problema" })).toBeVisible();
  await page.getByRole("button", { name: "Inizia la segnalazione" }).click();
  await expect(page.getByRole("heading", { name: "Cosa vuoi segnalare?" })).toBeVisible();
}

async function completeProblemStep(page: Page, description = defaultDescription): Promise<void> {
  await startWizard(page);
  await page.getByText(categoryName, { exact: true }).click();
  await page.getByLabel("Titolo").fill(defaultTitle);
  await page.getByLabel("Descrivi il problema").fill(description);
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Dove si trova?" })).toBeVisible();
  await expect(page.getByTestId("report-location-map")).toBeVisible();
  await expect(page.getByTestId("report-location-marker")).toHaveCount(0);
}

async function completeLocationStepWithAddress(page: Page): Promise<void> {
  await selectAddressSuggestion(page, "Via Roma, Venafro");
  await expect(page.locator('input[name="latitude"]')).not.toHaveValue("");
  await expect(page.locator('input[name="longitude"]')).not.toHaveValue("");
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Vuoi aggiungere una foto?" })).toBeVisible();
}

async function skipPhotoStep(page: Page): Promise<void> {
  await expect(page.getByText("Puoi continuare anche senza foto.")).toBeVisible();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Controlla la segnalazione" })).toBeVisible();
}

async function submitReviewStep(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Invia segnalazione" }).click();
}

async function expectSuccessState(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Segnalazione ricevuta" })).toBeVisible();
  await expect(page.getByText(/VC-[0-9A-Z]{8}/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Controlla lo stato" })).toBeVisible();
}

async function mockGeocoding(page: Page): Promise<void> {
  await page.route("**/api/geocoding/search**", async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get("q") ?? "";
    if (query.toLowerCase().includes("fail")) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ results: [], error: "Provider unavailable" }) });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [
          {
            id: "mock-via-roma",
            label: "Via Roma, Venafro, Molise, Italia",
            latitude: 41.4821,
            longitude: 14.0474
          }
        ]
      })
    });
  });

  await page.route("**/api/geocoding/reverse**", async (route) => {
    const url = new URL(route.request().url());
    const latitude = Number(url.searchParams.get("lat"));
    const longitude = Number(url.searchParams.get("lon"));
    const isCorso = Math.abs(latitude - 41.4836) < 0.001 && Math.abs(longitude - 14.0443) < 0.001;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: {
          id: "mock-reverse",
          label: isCorso ? "Corso Campano, Venafro, Molise, Italia" : "Punto selezionato sulla mappa, Venafro, Italia",
          latitude,
          longitude
        }
      })
    });
  });
}

async function selectAddressSuggestion(page: Page, query: string): Promise<void> {
  await page.getByLabel("Inserisci indirizzo").fill(query);
  await page.getByRole("option", { name: "Via Roma, Venafro, Molise, Italia" }).click();
  await expect(page.locator('input[name="latitude"]')).not.toHaveValue("");
  await expect(page.locator('input[name="longitude"]')).not.toHaveValue("");
}

async function readReportLocation(publicCode: string): Promise<{ address: string | null; latitude: number; longitude: number; source: string; createdByAdminId: string | null }> {
  return withDatabase(async (sql) => {
    const [row] = await sql<{ address: string | null; latitude: number; longitude: number; source: string; created_by_admin_id: string | null }[]>`
      select address, latitude, longitude, source, created_by_admin_id from reports where public_code = ${publicCode}
    `;

    if (!row) {
      throw new Error(`Report not found for ${publicCode}`);
    }

    return {
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      source: row.source,
      createdByAdminId: row.created_by_admin_id
    };
  });
}

async function cleanupE2eData(): Promise<void> {
  await withDatabase(async (sql) => {
    const reportRows = await sql<{ id: string }[]>`
      select id from reports where category_id = ${categoryId}
    `;
    const reportIds = reportRows.map((row) => row.id);

    if (reportIds.length > 0) {
      await sql`delete from report_confirmations where report_id in ${sql(reportIds)}`;
      await sql`delete from report_events where report_id in ${sql(reportIds)}`;
      await sql`delete from report_attachments where report_id in ${sql(reportIds)}`;
      await sql`delete from reports where id in ${sql(reportIds)}`;
    }

    await sql`delete from categories where id = ${categoryId} or slug = 'categoria-e2e-provvisoria'`;
    await sql`delete from admin_users where email = ${adminEmail} or id = 'e2e-report-upload-admin'`;
    await rm(".local-storage/report-images", { recursive: true, force: true });
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

async function readPublicCode(page: Page): Promise<string> {
  const text = await page.locator("body").textContent();
  const publicCode = text?.match(/VC-[0-9A-Z]{8}/)?.[0];

  if (!publicCode) {
    throw new Error("Public code not found.");
  }

  return publicCode;
}

async function loginAdmin(page: Page): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(adminEmail);
  await page.getByLabel("Password").fill(adminPassword);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function createAdmin(sql: postgres.Sql): Promise<void> {
  const passwordHash = await hashPassword(adminPassword);
  await sql`
    insert into admin_users (id, email, password_hash, role, active)
    values ('e2e-report-upload-admin', ${adminEmail}, ${passwordHash}, 'admin', true)
    on conflict (id) do update set email = excluded.email, password_hash = excluded.password_hash, active = true
  `;
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

async function validPng(background: string): Promise<Buffer> {
  return sharp({ create: { width: 16, height: 16, channels: 3, background } })
    .png()
    .toBuffer();
}

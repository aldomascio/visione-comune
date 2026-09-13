import { expect, test, type Page } from "@playwright/test";
import { argon2, randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";
import { promisify } from "node:util";
import sharp from "sharp";
import postgres from "postgres";

const categoryId = "e2e-report-category";
const categoryName = "Categoria E2E (provvisoria)";
const adminEmail = "report-upload-admin.e2e@example.com";
const adminPassword = "Correct horse battery upload 2026!";
const argon2Async = promisify(argon2);

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

  await page.getByLabel("Che tipo di problema vuoi segnalare?").selectOption(categoryId);
  await selectAddressSuggestion(page, "Via Roma, Venafro");
  await page
    .getByLabel("Descrivi il problema")
    .fill("Una buca profonda rende difficile il passaggio pedonale vicino alla scuola.");
  await page.getByRole("button", { name: "Invia segnalazione" }).click();

  await expect(page.getByRole("heading", { name: "Conserva il tuo codice" })).toBeVisible();
  await expect(page.getByText(/VC-[0-9A-Z]{8}/)).toBeVisible();
  await expect(page.getByText("La segnalazione non viene pubblicata automaticamente.")).toBeVisible();

  const publicCode = await readPublicCode(page);
  await expect(readReportLocation(publicCode)).resolves.toEqual({
    address: "Via Roma, Venafro, Molise, Italia",
    latitude: 41.4821,
    longitude: 14.0474
  });
});

test("continues when geolocation permission is denied and the user selects the map", async ({ page }) => {
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

  await page.getByRole("button", { name: "Usa la mia posizione" }).click();
  await expect(page.getByText("Permesso negato.")).toBeVisible();

  await page.getByLabel("Che tipo di problema vuoi segnalare?").selectOption(categoryId);
  await clickLocationMap(page);
  await page
    .getByLabel("Descrivi il problema")
    .fill("Una buca profonda rende difficile il passaggio pedonale vicino alla scuola.");
  await page.getByRole("button", { name: "Invia segnalazione" }).click();

  await expect(page.getByRole("heading", { name: "Conserva il tuo codice" })).toBeVisible();
  await expect(page.getByText(/VC-[0-9A-Z]{8}/)).toBeVisible();
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
  await page.getByLabel("Che tipo di problema vuoi segnalare?").selectOption(categoryId);
  await page.getByRole("button", { name: "Usa la mia posizione" }).click();
  await expect(page.getByLabel("Inserisci indirizzo")).toHaveValue("Corso Campano, Venafro, Molise, Italia");
  await page
    .getByLabel("Descrivi il problema")
    .fill("Un punto luce spento rende poco sicuro il passaggio serale.");
  await page.getByRole("button", { name: "Invia segnalazione" }).click();

  await expect(page.getByRole("heading", { name: "Conserva il tuo codice" })).toBeVisible();
});

test("requires a new location confirmation after editing a selected address", async ({ page }) => {
  await mockGeocoding(page);
  await page.goto("/segnala");

  await page.getByLabel("Che tipo di problema vuoi segnalare?").selectOption(categoryId);
  await selectAddressSuggestion(page, "Via Roma, Venafro");
  await page.getByLabel("Inserisci indirizzo").fill("Via modificata senza selezione");
  await page
    .getByLabel("Descrivi il problema")
    .fill("Una buca profonda rende difficile il passaggio pedonale vicino alla scuola.");
  await page.getByRole("button", { name: "Invia segnalazione" }).click();

  await expect(page.getByText("Inserisci una latitudine valida tra -90 e 90.", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Conserva il tuo codice" })).toHaveCount(0);
});

test("continues with map selection when address search provider fails", async ({ page }) => {
  await mockGeocoding(page);
  await page.goto("/segnala");

  await page.getByLabel("Che tipo di problema vuoi segnalare?").selectOption(categoryId);
  await page.getByLabel("Inserisci indirizzo").fill("fail provider");
  await expect(page.getByText("Non siamo riusciti a trovare l'indirizzo.")).toBeVisible();
  await clickLocationMap(page);
  await page
    .getByLabel("Descrivi il problema")
    .fill("Una buca profonda rende difficile il passaggio pedonale vicino alla scuola.");
  await page.getByRole("button", { name: "Invia segnalazione" }).click();

  await expect(page.getByRole("heading", { name: "Conserva il tuo codice" })).toBeVisible();
});


test("submits a report with a photo, shows it to admin, then publishes it", async ({ page }) => {
  await page.goto("/segnala");

  await mockGeocoding(page);
  await page.getByLabel("Che tipo di problema vuoi segnalare?").selectOption(categoryId);
  await selectAddressSuggestion(page, "Via Roma, Venafro");
  await page
    .getByLabel("Descrivi il problema")
    .fill("Una buca profonda con foto rende difficile il passaggio pedonale vicino alla scuola.");
  await page.setInputFiles("#photo", { name: "problema.png", mimeType: "image/png", buffer: await validPng() });

  await expect(page.getByAltText("Anteprima della foto selezionata")).toBeVisible();
  await page.getByRole("button", { name: "Invia segnalazione" }).click();

  await expect(page.getByRole("heading", { name: "Conserva il tuo codice" })).toBeVisible();
  const publicCode = await readPublicCode(page);

  const pendingPhotoResponse = await page.request.get(`/api/report-images/${publicCode}`);
  expect(pendingPhotoResponse.status()).toBe(404);

  await loginAdmin(page);
  await page.goto(`/admin/segnalazioni/${publicCode}`);
  await expect(page.getByAltText(`Foto allegata alla segnalazione ${publicCode}`)).toBeVisible();
  await page.getByRole("button", { name: "Approva" }).click();
  await expect(page.getByText("Segnalazione approvata e pubblicata come Segnalata.")).toBeVisible();

  const approvedPhotoResponse = await page.request.get(`/api/report-images/${publicCode}`);
  expect(approvedPhotoResponse.status()).toBe(200);
  expect(approvedPhotoResponse.headers()["content-type"]).toContain("image/jpeg");

  await page.goto(`/segnalazioni/${publicCode}`);
  await expect(page.getByAltText(`Foto della segnalazione ${publicCode}`)).toBeVisible();
  await expect(page.locator("body")).not.toContainText(".local-storage");
});

test("rejects an invalid photo without creating a successful report", async ({ page }) => {
  await page.goto("/segnala");

  await mockGeocoding(page);
  await page.getByLabel("Che tipo di problema vuoi segnalare?").selectOption(categoryId);
  await selectAddressSuggestion(page, "Via Roma, Venafro");
  await page
    .getByLabel("Descrivi il problema")
    .fill("Una buca profonda con allegato non valido vicino alla scuola.");
  await page.setInputFiles("#photo", {
    name: "problema.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image")
  });
  await page.getByRole("button", { name: "Invia segnalazione" }).click();

  await expect(page.getByText("La foto deve essere JPEG, PNG o WebP.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Conserva il tuo codice" })).toHaveCount(0);
});

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
  await expect(page.getByText("Indirizzo selezionato e posizione confermata.")).toBeVisible();
}

async function clickLocationMap(page: Page): Promise<void> {
  const map = page.getByTestId("report-location-map");
  await expect(map).toBeVisible();
  await map.click({ position: { x: 250, y: 160 } });
  await expect(page.getByText(/Posizione confermata/)).toBeVisible();
}

async function readReportLocation(publicCode: string): Promise<{ address: string | null; latitude: number; longitude: number }> {
  return withDatabase(async (sql) => {
    const [row] = await sql<{ address: string | null; latitude: number; longitude: number }[]>`
      select address, latitude, longitude from reports where public_code = ${publicCode}
    `;

    if (!row) {
      throw new Error(`Report not found for ${publicCode}`);
    }

    return row;
  });
}

async function cleanupE2eData(): Promise<void> {
  await withDatabase(async (sql) => {
    const reportRows = await sql<{ id: string }[]>`
      select id from reports where category_id = ${categoryId}
    `;
    const reportIds = reportRows.map((row) => row.id);

    if (reportIds.length > 0) {
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

async function validPng(): Promise<Buffer> {
  return sharp({ create: { width: 16, height: 16, channels: 3, background: "red" } })
    .png()
    .toBuffer();
}

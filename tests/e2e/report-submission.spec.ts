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


test("submits a report with a photo, shows it to admin, then publishes it", async ({ page }) => {
  await page.goto("/segnala");

  await page.getByLabel("Che tipo di problema vuoi segnalare?").selectOption(categoryId);
  await page.getByLabel("Inserisci indirizzo").fill("Via Roma, Venafro");
  await page.getByLabel("Latitudine").fill("41.4821");
  await page.getByLabel("Longitudine").fill("14.0474");
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

  await page.getByLabel("Che tipo di problema vuoi segnalare?").selectOption(categoryId);
  await page.getByLabel("Inserisci indirizzo").fill("Via Roma, Venafro");
  await page.getByLabel("Latitudine").fill("41.4821");
  await page.getByLabel("Longitudine").fill("14.0474");
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

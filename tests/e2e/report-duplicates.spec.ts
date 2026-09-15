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
  await page.getByRole("link", { name: "Vedi e conferma" }).click();
  const detailPage = await popupPromise;
  await expect(detailPage).toHaveURL(new RegExp(`/segnalazioni/${existingDuplicateCode}#conferma$`));
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
  await mockGeocoding(page, {
    latitude: Number(input.latitude),
    longitude: Number(input.longitude),
    label: "Via Roma, Venafro, Molise, Italia"
  });
  await page.goto("/segnala");
  await page.getByLabel("Che tipo di problema vuoi segnalare?").selectOption(input.category);
  await page.getByLabel("Inserisci indirizzo").fill("Via Roma, Venafro");
  await page.getByRole("option", { name: "Via Roma, Venafro, Molise, Italia" }).click();
  await page
    .getByLabel("Descrivi il problema")
    .fill("Una buca profonda rende difficile il passaggio pedonale vicino alla scuola.");
}

async function mockGeocoding(
  page: Page,
  result: { latitude: number; longitude: number; label: string }
): Promise<void> {
  await page.route("**/api/geocoding/search**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [
          {
            id: "mock-duplicate-location",
            label: result.label,
            latitude: result.latitude,
            longitude: result.longitude
          }
        ]
      })
    });
  });

  await page.route("**/api/geocoding/reverse**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ result })
    });
  });
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
      await sql`delete from report_confirmations where report_id in ${sql(reportIds)}`;
      await sql`delete from report_events where report_id in ${sql(reportIds)}`;
      await sql`delete from report_attachments where report_id in ${sql(reportIds)}`;
      await sql`delete from reports where id in ${sql(reportIds)}`;
    }

    await sql`delete from categories where id in (${categoryId}, ${otherCategoryId})`;
    await sql`delete from admin_users where id = ${adminId} or email = ${adminEmail}`;
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

const adminEmail = "duplicates-admin.e2e@example.com";
const adminPassword = "Correct horse battery staple duplicates 2026!";
const adminId = "e2e-duplicates-admin";
const primaryPostSubmitCode = "VC-E2EPRI01";
const publishedDuplicatePostSubmitCode = "VC-E2EDPA01";
const pendingDuplicatePostSubmitCode = "VC-E2EDPN01";

test("admin links a post-submit duplicate without breaking public tracking", async ({ page }) => {
  await createAdmin();
  await createApprovedReport({
    id: "e2e-duplicate-primary-post-submit",
    publicCode: primaryPostSubmitCode,
    category: categoryId,
    title: "Problema principale post-submit",
    latitude: 41.482,
    longitude: 14.043
  });
  await createApprovedReport({
    id: "e2e-duplicate-published-post-submit",
    publicCode: publishedDuplicatePostSubmitCode,
    category: categoryId,
    title: "Problema duplicato gia pubblicato",
    latitude: 41.4822,
    longitude: 14.0432
  });
  await createPendingReport({
    id: "e2e-duplicate-pending-post-submit",
    publicCode: pendingDuplicatePostSubmitCode,
    title: "Problema duplicato pending"
  });

  await loginAdmin(page);
  await page.goto(`/admin/segnalazioni/${publishedDuplicatePostSubmitCode}?duplicateQuery=${primaryPostSubmitCode}`);
  await expect(page.getByRole("heading", { name: "Problema duplicato gia pubblicato" })).toBeVisible();
  await page.getByRole("button", { name: new RegExp(`Segna come duplicata di ${primaryPostSubmitCode}`) }).click();
  await expect(page.getByText("Segnalazione collegata come duplicata.")).toBeVisible();
  await expect(page.getByText(`Duplicata di ${primaryPostSubmitCode}`)).toBeVisible();

  await page.goto(`/admin/segnalazioni/${primaryPostSubmitCode}`);
  await expect(page.getByText("Segnalazioni collegate")).toBeVisible();
  await expect(page.getByText(publishedDuplicatePostSubmitCode)).toBeVisible();

  await page.goto(`/segnalazioni/${publishedDuplicatePostSubmitCode}`);
  await expect(page.getByText("Questa segnalazione riguarda un problema gia segnalato.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Vai alla segnalazione principale" })).toHaveAttribute("href", `/segnalazioni/${primaryPostSubmitCode}`);
  await expect(page.getByRole("button", { name: "Conferme raccolte sulla principale" })).toBeDisabled();
  await expect(page.getByText("Le nuove conferme vengono raccolte sulla segnalazione principale")).toBeVisible();

  await page.goto(`/segnalazione?codice=${publishedDuplicatePostSubmitCode}`);
  await expect(page).toHaveURL(new RegExp(`/segnalazioni/${publishedDuplicatePostSubmitCode}$`));
  await expect(page.getByText("Questa segnalazione riguarda un problema gia segnalato.")).toBeVisible();

  await page.goto("/mappa");
  await expect(page.getByText("Problema principale post-submit")).toBeVisible();
  await expect(page.getByText("Problema duplicato gia pubblicato")).toHaveCount(0);
  await expect(page.getByTestId(`map-marker-${publishedDuplicatePostSubmitCode}`)).toHaveCount(0);
});

async function createPendingReport(input: { id: string; publicCode: string; title: string }): Promise<void> {
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
        moderation_status,
        created_at
      ) values (
        ${input.id},
        ${input.publicCode},
        ${input.title},
        'Descrizione lunga della segnalazione pending duplicata usata nei test end-to-end.',
        ${categoryId},
        41.4824,
        14.0434,
        'Via Roma, Venafro',
        'pending_review',
        now()
      )
    `;
    await sql`
      insert into report_events (id, report_id, type, visibility, created_at)
      values (${`${input.id}-created`}, ${input.id}, 'ReportCreated', 'internal', now())
    `;
  });
}

async function createAdmin(): Promise<void> {
  await withDatabase(async (sql) => {
    const passwordHash = await hashPassword(adminPassword);
    await sql`
      insert into admin_users (id, email, password_hash, role, active)
      values (${adminId}, ${adminEmail}, ${passwordHash}, 'admin', true)
      on conflict (id) do update set email = excluded.email, password_hash = excluded.password_hash, active = true
    `;
  });
}

async function loginAdmin(page: Page): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(adminEmail);
  await page.getByLabel("Password").fill(adminPassword);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function hashPassword(password: string): Promise<string> {
  const { argon2, randomBytes } = await import("node:crypto");
  const { promisify } = await import("node:util");
  const argon2Async = promisify(argon2);
  const nonce = randomBytes(16);
  const derivedKey = await argon2Async("argon2id", {
    message: password,
    nonce,
    memory: 65_536,
    passes: 3,
    parallelism: 1,
    tagLength: 32
  });

  return `argon2id$v=19$m=65536,t=3,p=1$${nonce.toString("base64")}$${Buffer.from(derivedKey).toString("base64")}`;
}

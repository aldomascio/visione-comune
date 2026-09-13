import { expect, test } from "@playwright/test";

test("shows the public home page", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: /Segnala un problema, segui il percorso/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Segnala un problema" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Esplora la mappa" })).toBeVisible();
});

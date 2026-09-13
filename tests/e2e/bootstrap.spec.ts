import { expect, test } from "@playwright/test";

test("shows the bootstrap page", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Visione Comune" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Segnala un problema" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Vai alla mappa" })).toBeVisible();
});


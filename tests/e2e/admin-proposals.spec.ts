import { expect, test } from "@playwright/test";

test("the proposals backoffice requires an authenticated administrator", async ({ page }) => {
  await page.goto("/admin/proposte");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { name: "Accesso amministratori" })).toBeVisible();
});

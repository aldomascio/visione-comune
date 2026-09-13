import { expect, test } from "@playwright/test";

test("shows the bootstrap page", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Visione Comune" })).toBeVisible();
  await expect(page.getByText("Bootstrap tecnico")).toBeVisible();
});


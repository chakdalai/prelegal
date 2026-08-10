import { expect, test } from "@playwright/test";

/**
 * The dashboard's "not sure which document?" chat (PL-6): maps a free-form
 * description to the closest catalog document and links into its builder —
 * the "engage with the user ... offer the closest document" half of PL-6.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "prelegal:session",
      JSON.stringify({ id: "e2e-user", email: "e2e@example.com" }),
    );
  });
});

test("suggests the closest document and links into its builder", async ({ page }) => {
  await page.route("**/api/documents/route", async (route) => {
    await route.fulfill({
      json: {
        reply: "The Cloud Service Agreement is the closest fit for a SaaS product.",
        suggestedFilename: "cloud-service-agreement.md",
      },
    });
  });

  await page.goto("/dashboard/");
  await page.getByLabel("Message").fill("We're building a SaaS product for customers.");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText(/closest fit for a SaaS product/)).toBeVisible();

  const suggestion = page.getByRole("link", { name: /Start drafting: Cloud Service Agreement/ });
  await expect(suggestion).toBeVisible();
  await suggestion.click();

  await expect(page).toHaveURL(/\/documents\/cloud-service-agreement\/?$/);
});

test("asks a follow-up question instead of suggesting nothing", async ({ page }) => {
  await page.route("**/api/documents/route", async (route) => {
    await route.fulfill({
      json: { reply: "What kind of deal is this for?", suggestedFilename: null },
    });
  });

  await page.goto("/dashboard/");
  await page.getByLabel("Message").fill("Hi");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("What kind of deal is this for?")).toBeVisible();
  await expect(page.getByRole("link", { name: /Start drafting/ })).toHaveCount(0);
});

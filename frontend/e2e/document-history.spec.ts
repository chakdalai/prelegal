import { expect, test } from "@playwright/test";

/**
 * End-to-end coverage of PL-7's document history: a builder autosaves as the
 * user types, the dashboard lists it under "Your documents", and opening it
 * shows a read-only view with no form or chat present.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "prelegal:session",
      JSON.stringify({ id: "e2e-user", email: "e2e@example.com" }),
    );
  });
});

test("autosaves a document, then finds and opens it read-only from the dashboard", async ({
  page,
}) => {
  let saved: Record<string, unknown> | null = null;

  await page.route("**/api/saved-documents/*", async (route) => {
    if (route.request().method() !== "PUT") return route.fallback();

    const body = route.request().postDataJSON();
    saved = { id: "e2e-doc", createdAt: "2026-08-10 00:00:00", updatedAt: "2026-08-10 00:01:00", ...body };
    await route.fulfill({ json: saved });
  });

  await page.goto("/nda/");
  await page.getByLabel("Governing law").fill("Delaware");

  // The autosave hook debounces for ~1.5s before writing.
  await expect.poll(() => saved, { timeout: 5000 }).not.toBeNull();

  await page.route("**/api/saved-documents?**", async (route) => {
    await route.fulfill({
      json: [
        {
          id: "e2e-doc",
          slug: "mutual-nda",
          title: "Mutual NDA",
          createdAt: "2026-08-10 00:00:00",
          updatedAt: "2026-08-10 00:01:00",
        },
      ],
    });
  });
  await page.route("**/api/saved-documents/e2e-doc?**", async (route) => {
    await route.fulfill({
      json: {
        id: "e2e-doc",
        slug: "mutual-nda",
        title: "Mutual NDA",
        formData: {},
        markdown: "# Mutual Non-Disclosure Agreement\n\nGoverning Law: Delaware",
        createdAt: "2026-08-10 00:00:00",
        updatedAt: "2026-08-10 00:01:00",
      },
    });
  });

  await page.goto("/dashboard/");
  const entry = page.getByRole("link", { name: "Mutual NDA" });
  await expect(entry).toBeVisible();

  await entry.click();
  await expect(page).toHaveURL(/\/documents\/view\/?\?id=e2e-doc/);

  await expect(page.getByRole("heading", { name: "Mutual NDA" })).toBeVisible();
  const preview = page.getByRole("article", { name: "Agreement preview" });
  await expect(preview).toContainText("Governing Law: Delaware");

  // Read-only: no form fields or chat input on this page.
  await expect(page.getByLabel("Governing law")).toHaveCount(0);
  await expect(page.getByLabel("Message")).toHaveCount(0);
});

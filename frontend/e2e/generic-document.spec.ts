import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

/**
 * End-to-end coverage of the generic document builder added in PL-6, for one
 * representative document (Cloud Service Agreement). Per-document field
 * configs and rendering are covered exhaustively in
 * `lib/documents/render.test.ts`; this only needs to prove the real browser
 * flow — form fill, chat fill, and a download that actually lands on disk —
 * works the same way `e2e/mutual-nda.spec.ts` proves it for the Mutual NDA.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "prelegal:session",
      JSON.stringify({ id: "e2e-user", email: "e2e@example.com" }),
    );
  });
  // Autosave fires in the background as the form is filled; stub it so these
  // tests (which exercise the builder itself) don't depend on it succeeding.
  await page.route("**/api/saved-documents/**", async (route) => {
    const body = route.request().postDataJSON() ?? {};
    await route.fulfill({ json: { id: "e2e-doc", createdAt: "", updatedAt: "", ...body } });
  });
  await page.goto("/documents/cloud-service-agreement/");
});

test("shows placeholders, then updates the agreement as the user types", async ({ page }) => {
  const preview = page.getByRole("article", { name: "Agreement preview" });

  await expect(preview).toContainText("[Governing Law]");

  await page.getByLabel("Governing law").fill("Delaware");

  await expect(preview).toContainText("Delaware");
  await expect(preview).not.toContainText("[Governing Law]");
});

test("fills the form from a chat reply", async ({ page }) => {
  await page.route("**/api/documents/cloud-service-agreement/chat", async (route) => {
    const request = route.request().postDataJSON();
    await route.fulfill({
      json: {
        reply: "Got it, governing law is Delaware.",
        fields: {
          ...request.fields,
          values: { ...request.fields.values, governingLaw: "Delaware" },
        },
      },
    });
  });

  const preview = page.getByRole("article", { name: "Agreement preview" });

  await page.getByLabel("Message").fill("Governing law is Delaware.");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Got it, governing law is Delaware.")).toBeVisible();
  await expect(preview).toContainText("Delaware");
  await expect(page.getByLabel("Governing law")).toHaveValue("Delaware");
});

test("downloads a draft with the required CC BY 4.0 attribution and no unresolved markup", async ({
  page,
}) => {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Markdown" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("cloud-service-agreement.md");

  const contents = await readFile((await download.path())!, "utf8");

  expect(contents).toContain("# Cloud Service Agreement");
  // The Cloud Service Agreement template carries no inline attribution of
  // its own, unlike the Mutual NDA's — the app must add one.
  expect(contents).toContain("CC BY 4.0");
  expect(contents).not.toContain("_link");
});

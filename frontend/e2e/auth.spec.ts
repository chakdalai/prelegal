import { expect, test } from "@playwright/test";

/**
 * Covers the fake-login-to-dashboard shell added in PL-4. The backend isn't
 * running against this static export in CI, so /api/auth/login is stubbed —
 * the real endpoint has its own pytest coverage in backend/tests.
 */

test("redirects an unauthenticated visitor to /login", async ({ page }) => {
  await page.goto("/dashboard/");
  await expect(page).toHaveURL(/\/login\/?$/);

  await page.goto("/nda/");
  await expect(page).toHaveURL(/\/login\/?$/);
});

test("signs in, lands on the dashboard, and opens the Mutual NDA builder", async ({ page }) => {
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "fake-id", email: "user@example.com" }),
    });
  });

  await page.goto("/login/");
  await page.getByLabel("Email").fill("user@example.com");
  await page.getByLabel("Password").fill("anything");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard\/?$/);
  await expect(page.getByText("Signed in as user@example.com.")).toBeVisible();

  const liveCard = page.getByRole("link", { name: /Mutual Non-Disclosure Agreement — Cover Page/ });
  await expect(liveCard).toBeVisible();
  // Every document is a live builder as of PL-6 except the Mutual NDA
  // Standard Terms, which are incorporated by reference into the Cover Page
  // rather than a starting point a user picks on their own.
  await expect(page.getByText("Included by reference")).toHaveCount(1);

  await liveCard.click();
  await expect(page).toHaveURL(/\/nda\/?$/);
  await expect(page.getByRole("heading", { name: "Mutual NDA creator" })).toBeVisible();
});

test("signing out clears the session and re-gates the dashboard", async ({ page }) => {
  // A one-time write, not addInitScript: that reruns on every navigation in
  // this context, which would silently re-seed the session right after
  // sign-out clears it and defeat the second assertion below.
  await page.goto("/login/");
  await page.evaluate(() => {
    window.localStorage.setItem(
      "prelegal:session",
      JSON.stringify({ id: "e2e-user", email: "e2e@example.com" }),
    );
  });

  await page.goto("/dashboard/");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login\/?$/);

  await page.goto("/dashboard/");
  await expect(page).toHaveURL(/\/login\/?$/);
});

import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

/**
 * End-to-end coverage of the two things the unit and component tests cannot
 * reach: a download that actually lands on disk, and print output produced by
 * a real browser.
 */

const PARTY_1 = {
  company: "Acme, Inc.",
  name: "Ada Lovelace",
  title: "Chief Executive Officer",
  address: "1 Main St\nWilmington, DE 19801",
};

const PARTY_2 = {
  company: "Globex Ltd",
  name: "Grace Hopper",
  title: "Chief Technology Officer",
  address: "legal@globex.example",
};

async function fillParty(page: Page, section: string, party: typeof PARTY_1) {
  const fields = page.getByRole("region", { name: section });

  await fields.getByLabel("Company").fill(party.company);
  await fields.getByLabel("Print name").fill(party.name);
  await fields.getByLabel("Title", { exact: true }).fill(party.title);
  await fields.getByLabel("Notice address").fill(party.address);
}

async function completeAgreement(page: Page) {
  // Exact: the term radios' labels also mention "the effective date".
  await page.getByLabel("Effective date", { exact: true }).fill("2026-08-09");
  await page.getByLabel("Governing law").fill("Delaware");
  await page.getByLabel("Jurisdiction").fill("New Castle, DE");
  await fillParty(page, "Party 1", PARTY_1);
  await fillParty(page, "Party 2", PARTY_2);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("builds the agreement as the user fills the form", async ({ page }) => {
  const preview = page.getByRole("article", { name: "Agreement preview" });

  await expect(preview).toContainText("Governing Law: [Governing Law]");
  await expect(page.getByRole("status")).toContainText("11 fields still to complete");

  await completeAgreement(page);

  await expect(preview).toContainText("Governing Law: Delaware");
  await expect(preview).toContainText("August 9, 2026");
  await expect(preview).toContainText("the laws of the State of Delaware");
  await expect(page.getByRole("status")).toContainText("All fields complete.");
});

test("puts the parties into the signature block", async ({ page }) => {
  await completeAgreement(page);

  const signatureBlock = page.getByRole("table");
  await expect(signatureBlock.getByRole("row", { name: /Company/ })).toContainText("Acme, Inc.");
  await expect(signatureBlock.getByRole("row", { name: /Company/ })).toContainText("Globex Ltd");

  // Signature and Date stay empty for a human to complete.
  const signatureRow = signatureBlock.getByRole("row", { name: /^Signature/ });
  await expect(signatureRow.getByRole("cell").nth(1)).toBeEmpty();
});

test("downloads a complete agreement as Markdown", async ({ page }) => {
  await completeAgreement(page);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Markdown" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("mutual-nda-acme-inc-and-globex-ltd.md");

  const contents = await readFile((await download.path())!, "utf8");

  // The agreement the user actually receives.
  expect(contents).toContain("# Mutual Non-Disclosure Agreement");
  expect(contents).toContain("Governing Law: Delaware");
  expect(contents).toContain("August 9, 2026");
  expect(contents).toContain("| Company | Acme, Inc. | Globex Ltd |");
  expect(contents).toContain("| Notice Address | 1 Main St, Wilmington, DE 19801 |");
  expect(contents).toContain("the laws of the State of **Delaware**");

  // Both halves are present, with nothing left unresolved.
  expect(contents).toContain("# Standard Terms");
  expect(contents).toContain("**Equitable Relief**");
  expect(contents).not.toContain("coverpage_link");
  expect(contents).not.toContain("<span");

  // Attribution is a condition of the CC BY 4.0 licence.
  expect(contents).toContain("CC BY 4.0");
});

test("downloads a draft before the form is complete", async ({ page }) => {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Markdown" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("mutual-nda.md");

  const contents = await readFile((await download.path())!, "utf8");
  expect(contents).toContain("Governing Law: [Governing Law]");
});

test("prints the agreement alone, without the app around it", async ({ page }) => {
  await completeAgreement(page);
  await page.emulateMedia({ media: "print" });

  await expect(page.getByRole("article", { name: "Agreement preview" })).toBeVisible();

  // The form, the buttons and the page heading are all app chrome.
  await expect(page.getByRole("button", { name: "Download Markdown" })).toBeHidden();
  await expect(page.getByLabel("Governing law")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Mutual NDA creator" })).toBeHidden();
  await expect(page.getByRole("status")).toBeHidden();
});

test("produces a readable multi-page PDF", async ({ page }, testInfo) => {
  await completeAgreement(page);

  const pdf = await page.pdf({ format: "A4", printBackground: true });
  // Kept as a test artifact so the layout can be eyeballed after a run.
  await testInfo.attach("mutual-nda.pdf", { body: pdf, contentType: "application/pdf" });

  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");

  // The full agreement runs to several pages; a one-page PDF would mean the
  // print stylesheet had collapsed or hidden the document.
  const pageCount = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  expect(pageCount).toBeGreaterThan(1);
  expect(pdf.byteLength).toBeGreaterThan(10_000);
});

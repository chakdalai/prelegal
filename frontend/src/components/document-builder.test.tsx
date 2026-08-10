import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubObjectUrls } from "@/test-support/object-urls";
import type { DocumentConfig } from "@/lib/documents/registry";

import { DocumentBuilder } from "./document-builder";

/**
 * A small stand-in config, so these tests stay about the generic UI rather
 * than any one document's actual fields. The real configs are exercised in
 * `lib/documents/render.test.ts` and `lib/documents/registry.test.ts`.
 */
const CONFIG: DocumentConfig = {
  slug: "test-agreement",
  filename: "test-agreement.md",
  title: "Test Agreement",
  party1Label: "Provider",
  party2Label: "Customer",
  fields: [
    { name: "effectiveDate", label: "Effective Date", type: "date" },
    { name: "fees", label: "Fees", type: "text" },
  ],
};

const STANDARD_TERMS = [
  "# Standard Terms",
  "",
  '1. **Fees**. As described in <span class="keyterms_link">Fees</span>.',
  "",
].join("\n");

function renderBuilder() {
  return {
    user: userEvent.setup(),
    ...render(<DocumentBuilder config={CONFIG} standardTerms={STANDARD_TERMS} />),
  };
}

const preview = () => screen.getByRole("article", { name: /agreement preview/i });

async function completeTheForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/fees/i), "$1,000/month");
  await user.type(screen.getByLabelText(/effective date/i), "2026-08-09");

  for (const section of ["Provider", "Customer"]) {
    const fields = within(screen.getByRole("region", { name: section }));
    await user.type(fields.getByLabelText(/company/i), `${section} Ltd`);
    await user.type(fields.getByLabelText(/print name/i), "Ada Lovelace");
    await user.type(fields.getByLabelText(/^title$/i), "CEO");
    await user.type(fields.getByLabelText(/notice address/i), "legal@example.com");
  }
}

describe("DocumentBuilder", () => {
  it("shows the agreement with placeholders before anything is filled in", () => {
    renderBuilder();

    expect(preview()).toHaveTextContent("Test Agreement");
    expect(preview()).toHaveTextContent("[Fees]");
  });

  it("lists what is still outstanding", () => {
    renderBuilder();

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("still to complete");
    expect(notice).toHaveTextContent("Fees");
  });

  it("updates the agreement as the user types", async () => {
    const { user } = renderBuilder();

    await user.type(screen.getByLabelText(/fees/i), "$1,000/month");

    expect(preview()).toHaveTextContent("$1,000/month");
    expect(preview()).not.toHaveTextContent("[Fees]");
  });

  it("resolves the standard terms' cross-references without substituting values", async () => {
    const { user } = renderBuilder();

    await user.type(screen.getByLabelText(/fees/i), "$1,000/month");

    expect(preview()).toHaveTextContent("As described in Fees.");
    expect(preview().innerHTML).not.toContain("keyterms_link");
  });

  it("adds the required CC BY 4.0 attribution the template itself doesn't carry", () => {
    renderBuilder();

    expect(preview()).toHaveTextContent("CC BY 4.0");
  });

  it("confirms when nothing is outstanding", async () => {
    const { user } = renderBuilder();

    await completeTheForm(user);

    expect(screen.getByRole("status")).toHaveTextContent("All fields complete.");
    expect(preview()).not.toHaveTextContent("[Company]");
  });

  describe("downloading", () => {
    let blobs: Blob[];

    beforeEach(() => {
      blobs = stubObjectUrls().created;
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it("downloads the agreement named after the document and both parties", async () => {
      const { user } = renderBuilder();
      const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

      await completeTheForm(user);
      await user.click(screen.getByRole("button", { name: /download markdown/i }));

      const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement;
      expect(anchor.download).toBe("test-agreement-provider-ltd-and-customer-ltd.md");
      expect(blobs[0].type).toBe("text/markdown");
    });
  });

  it("opens the browser's print dialog to save a PDF", async () => {
    const { user } = renderBuilder();
    const print = vi.fn();
    vi.stubGlobal("print", print);

    await user.click(screen.getByRole("button", { name: /print \/ save as pdf/i }));

    expect(print).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
  });
});

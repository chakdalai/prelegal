import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubObjectUrls } from "@/test-support/object-urls";

import { NdaBuilder } from "./nda-builder";

/**
 * A stand-in for the Standard Terms carrying one cross-reference of each kind,
 * so these tests stay about the UI rather than the agreement's wording. The
 * real template is exercised in `lib/mnda/template.test.ts`.
 */
const STANDARD_TERMS = [
  "# Standard Terms",
  "",
  '1. **Introduction**. Used for the <span class="coverpage_link">Purpose</span>.',
  "",
  '2. **Governing Law**. The laws of the State of <span class="coverpage_link">Governing Law</span> apply.',
  "",
].join("\n");

function renderBuilder() {
  return {
    user: userEvent.setup(),
    ...render(<NdaBuilder standardTerms={STANDARD_TERMS} />),
  };
}

const preview = () => screen.getByRole("article", { name: /agreement preview/i });

/** Fills everything the completeness check asks for. */
async function completeTheForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/governing law/i), "Delaware");
  await user.type(screen.getByLabelText(/jurisdiction/i), "New Castle, DE");
  await user.click(screen.getByRole("button", { name: /today/i }));

  for (const section of ["Party 1", "Party 2"]) {
    const fields = within(screen.getByRole("region", { name: section }));
    await user.type(fields.getByLabelText(/company/i), `${section} Ltd`);
    await user.type(fields.getByLabelText(/print name/i), "Ada Lovelace");
    await user.type(fields.getByLabelText(/^title$/i), "CEO");
    await user.type(fields.getByLabelText(/notice address/i), "legal@example.com");
  }
}

describe("NdaBuilder", () => {
  it("shows the agreement with placeholders before anything is filled in", () => {
    renderBuilder();

    expect(preview()).toHaveTextContent("Mutual Non-Disclosure Agreement");
    expect(preview()).toHaveTextContent("Governing Law: [Governing Law]");
    expect(preview()).toHaveTextContent("[Company]");
  });

  it("lists what is still outstanding", () => {
    renderBuilder();

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("11 fields still to complete");
    expect(notice).toHaveTextContent("Effective Date");
    expect(notice).toHaveTextContent("Party 2 Notice Address");
  });

  it("updates the agreement as the user types", async () => {
    const { user } = renderBuilder();

    await user.type(screen.getByLabelText(/governing law/i), "Delaware");

    expect(preview()).toHaveTextContent("Governing Law: Delaware");
    expect(preview()).not.toHaveTextContent("[Governing Law]");
  });

  it("resolves the standard terms' cross-references without substituting values", async () => {
    const { user } = renderBuilder();

    await user.type(screen.getByLabelText(/governing law/i), "Delaware");

    // The value belongs on the Cover Page; the boilerplate keeps its defined term.
    expect(preview()).toHaveTextContent("Governing Law: Delaware");
    expect(preview()).toHaveTextContent("The laws of the State of Governing Law apply.");
    expect(preview().innerHTML).not.toContain("coverpage_link");
  });

  it("fills today's date on request", async () => {
    const { user } = renderBuilder();

    await user.click(screen.getByRole("button", { name: /today/i }));

    const today = new Date();
    const expected = today.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    expect(screen.getByLabelText("Effective date")).toHaveValue(
      // The input keeps ISO format even though the agreement reads long-form.
      `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, "0")}-${`${today.getDate()}`.padStart(2, "0")}`,
    );
    expect(preview()).toHaveTextContent(expected);
  });

  it("switches between the term options", async () => {
    const { user } = renderBuilder();

    expect(preview()).toHaveTextContent("Expires 1 year from the Effective Date.");

    await user.click(screen.getByRole("radio", { name: /continues until terminated/i }));
    expect(preview()).toHaveTextContent("Continues until terminated");

    await user.click(screen.getByRole("radio", { name: /in perpetuity/i }));
    expect(preview()).toHaveTextContent("In perpetuity.");
  });

  it("keeps the years input in step with its radio", async () => {
    const { user } = renderBuilder();

    const years = screen.getByLabelText("Length of the MNDA in years");
    await user.clear(years);
    await user.type(years, "3");

    expect(preview()).toHaveTextContent("Expires 3 years from the Effective Date.");
  });

  it("disables the years input of the option that is not selected", async () => {
    const { user } = renderBuilder();

    await user.click(screen.getByRole("radio", { name: /continues until terminated/i }));

    expect(screen.getByLabelText("Length of the MNDA in years")).toBeDisabled();
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

    it("downloads the agreement named after both parties", async () => {
      const { user } = renderBuilder();
      const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

      await completeTheForm(user);
      await user.click(screen.getByRole("button", { name: /download markdown/i }));

      const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement;
      expect(anchor.download).toBe("mutual-nda-party-1-ltd-and-party-2-ltd.md");
      expect(blobs[0].type).toBe("text/markdown");
    });

    it("downloads even while fields are outstanding", async () => {
      const { user } = renderBuilder();
      const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

      await user.click(screen.getByRole("button", { name: /download markdown/i }));

      const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement;
      expect(anchor.download).toBe("mutual-nda.md");
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

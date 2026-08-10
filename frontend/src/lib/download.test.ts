import { afterEach, describe, expect, it, vi } from "vitest";

import { readBlob, stubObjectUrls } from "@/test-support/object-urls";

import { downloadTextFile } from "./download";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("downloadTextFile", () => {
  it("saves the contents under the requested filename", async () => {
    const { created } = stubObjectUrls();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadTextFile("mutual-nda.md", "# Agreement", "text/markdown");

    expect(click).toHaveBeenCalledOnce();

    const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.download).toBe("mutual-nda.md");
    expect(anchor.href).toBe("blob:test/1");

    expect(created).toHaveLength(1);
    expect(created[0].type).toBe("text/markdown");
    await expect(readBlob(created[0])).resolves.toBe("# Agreement");
  });

  /**
   * Firefox and Safari drop the download if the object URL is revoked on the
   * same tick as the click, so it has to outlive the synchronous call.
   */
  it("keeps the object URL alive past the click, then releases it", () => {
    vi.useFakeTimers();
    const { revoked } = stubObjectUrls();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadTextFile("mutual-nda.md", "# Agreement", "text/markdown");
    expect(revoked).toEqual([]);

    vi.runAllTimers();
    expect(revoked).toEqual(["blob:test/1"]);
  });
});

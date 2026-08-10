import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadTextFile } from "./download";

/**
 * jsdom implements neither object URLs nor navigation, so both are stubbed and
 * the resulting anchor is inspected instead.
 */
function stubObjectUrls() {
  const created: Blob[] = [];
  const revoked: string[] = [];

  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: (blob: Blob) => {
      created.push(blob);
      return `blob:test/${created.length}`;
    },
    revokeObjectURL: (url: string) => revoked.push(url),
  });

  return { created, revoked };
}

/** jsdom's Blob has no `text()`, so read it the long way. */
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

  it("releases the object URL it created", () => {
    const { revoked } = stubObjectUrls();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadTextFile("mutual-nda.md", "# Agreement", "text/markdown");

    expect(revoked).toEqual(["blob:test/1"]);
  });
});

import { vi } from "vitest";

/**
 * jsdom implements neither object URLs nor navigation, so both are stubbed and
 * the anchor the download helper builds is inspected instead.
 *
 * Call `vi.unstubAllGlobals()` afterwards.
 */
export function stubObjectUrls() {
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
export function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

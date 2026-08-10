/** Saves text to the user's machine as a file, without a round trip to a server. */
export function downloadTextFile(filename: string, contents: string, mimeType: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  // Revoking on this tick makes Firefox and Safari drop the download: the URL
  // has to stay valid until the browser has started reading from it.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

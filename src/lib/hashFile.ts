/**
 * Client-side utility to generate a SHA-256 hash of a file for content-addressable storage.
 */
export async function hashFile(file: File): Promise<{ hash: string; size: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return { hash: hashHex, size: file.size };
}

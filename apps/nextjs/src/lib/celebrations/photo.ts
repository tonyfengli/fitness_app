/**
 * The member's photo from GymMaster. `memberimage` is a URL for a real photo and an inline
 * SVG (initials) when there is none; only real photos are used.
 */

export function hasRealPhoto(memberimage: unknown): memberimage is string {
  return typeof memberimage === "string" && /^https?:\/\//.test(memberimage);
}

export async function fetchMemberPhoto(url: string): Promise<Buffer | null> {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) }).catch(() => null);
  if (!response?.ok) return null;
  const type = response.headers.get("content-type") ?? "";
  if (!type.startsWith("image/") || type.includes("svg")) return null;
  return Buffer.from(await response.arrayBuffer());
}

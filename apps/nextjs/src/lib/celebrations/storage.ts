/**
 * Where rendered cards and theme backgrounds live: Vercel Blob (BLOB_READ_WRITE_TOKEN).
 * Paths are deterministic, so re-rendering a card overwrites it instead of piling up copies.
 * Public URLs: the cards are meant to be downloaded and posted; they hold a first name, a
 * photo the member gave the gym or uses in the members' GroupMe group, and no other member data.
 */

import { put } from "@vercel/blob";

export async function storePng(path: string, png: Buffer): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN is not set");
  const blob = await put(`celebrations/${path}`, png, {
    access: "public",
    contentType: "image/png",
    addRandomSuffix: false, // same path again = overwrite (0.27 behavior)
    cacheControlMaxAge: 60,
  });
  return blob.url;
}

export const cardPath = (celebrationId: string) => `cards/${celebrationId}.png`;
export const backgroundPath = (themeKey: string) => `backgrounds/${themeKey}.png`;
/** Art made for one card alone, when a founder asks for a new background */
export const cardBackgroundPath = (celebrationId: string) => `backgrounds/cards/${celebrationId}.png`;
/** A member's cleaned-up portrait, made once from an approved GroupMe picture and reused each year */
export const portraitPath = (memberId: string) => `portraits/${memberId}.png`;

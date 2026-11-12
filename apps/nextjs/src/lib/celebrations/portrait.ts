/**
 * Turns a profile picture a founder approved into a clean portrait of just the member, with the
 * image model. This is the one place a member's photo is sent to OpenAI on its own (Tony's
 * decision, Nov 12 2026: "AI cleans up the photo only", after a founder's yes). The result is
 * stored and reused, so it happens once per member per picture.
 */

import sharp from "sharp";

import { editImage } from "../ai/images";
import type { ImageResult } from "../ai/images";

/** Any raster sharp reads (a GIF gives its first frame) → PNG no larger than 1536 px, upright */
export async function toPng(image: Buffer): Promise<Buffer> {
  return sharp(image, { pages: 1 }).rotate().resize(1536, 1536, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
}

export async function cleanPortrait(photo: Buffer, who?: string): Promise<ImageResult> {
  const subject = who?.trim() ? `this person: ${who.trim().slice(0, 200)}` : "the main person in the photo (if there are several, the adult most prominent in the frame)";
  const prompt =
    `Turn this photo into a clean head-and-shoulders portrait of one person only: ${subject}. ` +
    "Keep their face, hair, skin tone, expression, glasses and clothing exactly as they are in the photo: same person, same likeness, " +
    "no beautifying, no restyling, no change of age or features. Remove every other person, any text, stickers and distracting objects. " +
    "Square image, the person centered with their whole head and shoulders visible and room around the head, " +
    "a simple softly blurred neutral background, natural photographic look.";
  return editImage({ images: [await toPng(photo)], prompt, purpose: "celebrations:portrait", quality: "medium" });
}

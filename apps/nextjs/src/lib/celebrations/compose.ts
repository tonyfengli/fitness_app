/**
 * Builds the celebration card in code: a cached AI background, the words and the Elev8 mark.
 * Deterministic; no model involved. Two layouts:
 *   photo     the member's photo in a ringed circle, the headline under it
 *   no photo  the headline large in the middle of the card (members without a photo, or a
 *             founder turned the photo off)
 *
 * Output: 1080×1080 PNG (square posts well everywhere, GroupMe included).
 * Text goes in as outlines from the bundled Montserrat (text.ts), so Vercel renders it the
 * same as a Mac; no system fonts are involved.
 */

import sharp from "sharp";

import { fitLines, fitSize, textPath } from "./text";

export const CARD = 1080;
const PHOTO = 440;
const PHOTO_TOP = 200;
const RING = 10;

export interface ComposeInput {
  background: Buffer;
  /** The member's photo, any raster format sharp reads; null = the no-photo layout */
  photo: Buffer | null;
  headline: string;
  subline?: string;
  /** Ring, second line and rule color (the theme's accent) */
  accent?: string;
  brand?: string;
}

const TEXT_MAX_WIDTH = CARD - 2 * 60;

const DEFAULT_ACCENT = "#f5c542";
const BRAND = "ELEV8 PERFORMANCE";

async function circularPhoto(photo: Buffer): Promise<Buffer> {
  const mask = Buffer.from(`<svg width="${PHOTO}" height="${PHOTO}"><circle cx="${PHOTO / 2}" cy="${PHOTO / 2}" r="${PHOTO / 2}"/></svg>`);
  return sharp(photo)
    .rotate() // honor EXIF orientation from phone photos
    .resize(PHOTO, PHOTO, { fit: "cover", position: "attention" })
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

const brandMark = (brand: string) => textPath(brand, { size: 30, weight: "semibold", cx: CARD / 2, y: CARD - 48, letterSpacing: 6 });

/** Photo layout: ringed portrait, headline and second line under it */
async function composeWithPhoto(background: Buffer, input: ComposeInput & { photo: Buffer }): Promise<Buffer> {
  const accent = input.accent ?? DEFAULT_ACCENT;
  const photo = await circularPhoto(input.photo);
  const ringSize = PHOTO + RING * 2;
  const ring = Buffer.from(
    `<svg width="${ringSize}" height="${ringSize}"><circle cx="${ringSize / 2}" cy="${ringSize / 2}" r="${ringSize / 2 - 1}" fill="${accent}"/></svg>`,
  );

  const textTop = PHOTO_TOP + PHOTO + 110;
  const headlineSize = fitSize(input.headline, "extrabold", TEXT_MAX_WIDTH, 84, 44);
  const headline = textPath(input.headline, { size: headlineSize, weight: "extrabold", cx: CARD / 2, y: textTop });
  const subline = input.subline ? textPath(input.subline, { size: fitSize(input.subline, "semibold", TEXT_MAX_WIDTH, 40, 28), weight: "semibold", cx: CARD / 2, y: textTop + 72 }) : null;
  const mark = brandMark(input.brand ?? BRAND);
  const overlay = `<svg width="${CARD}" height="${CARD}">
    <defs>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity="0.72"/>
      </linearGradient>
    </defs>
    <rect x="0" y="${CARD - 420}" width="${CARD}" height="420" fill="url(#fade)"/>
    <path d="${headline.d}" fill="#ffffff" stroke="#000" stroke-opacity="0.35" stroke-width="2" paint-order="stroke"/>
    ${subline ? `<path d="${subline.d}" fill="${accent}"/>` : ""}
    <path d="${mark.d}" fill="#e5e7eb"/>
  </svg>`;

  return sharp(background)
    .composite([
      { input: ring, left: (CARD - ringSize) / 2, top: PHOTO_TOP - RING },
      { input: photo, left: (CARD - PHOTO) / 2, top: PHOTO_TOP },
      { input: Buffer.from(overlay), left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

/**
 * No-photo layout: the headline is the card. Up to three lines at the largest size that fits,
 * centered, over a soft dark veil so it reads on any background; a short accent rule above,
 * the second line under it.
 */
async function composeWithoutPhoto(background: Buffer, input: ComposeInput): Promise<Buffer> {
  const accent = input.accent ?? DEFAULT_ACCENT;
  const { size, lines } = fitLines(input.headline, "extrabold", TEXT_MAX_WIDTH, 3, 168, 56);
  const lineHeight = Math.round(size * 1.08);
  const sublineSize = input.subline ? fitSize(input.subline, "semibold", TEXT_MAX_WIDTH, 44, 28) : 0;
  const RULE_GAP = 56; // rule → first line's cap height
  const SUB_GAP = 84; // last baseline → second line's baseline
  const capHeight = Math.round(size * 0.7);
  const blockHeight = RULE_GAP + capHeight + lineHeight * (lines.length - 1) + (input.subline ? SUB_GAP : 0);
  const top = Math.round((CARD - blockHeight) / 2) - 10; // a touch above center; the brand mark sits below
  const firstBaseline = top + RULE_GAP + capHeight;

  const headline = lines.map((line, i) => textPath(line, { size, weight: "extrabold", cx: CARD / 2, y: firstBaseline + i * lineHeight }).d).join(" ");
  const lastBaseline = firstBaseline + (lines.length - 1) * lineHeight;
  const subline = input.subline ? textPath(input.subline, { size: sublineSize, weight: "semibold", cx: CARD / 2, y: lastBaseline + SUB_GAP }) : null;
  const mark = brandMark(input.brand ?? BRAND);
  const overlay = `<svg width="${CARD}" height="${CARD}">
    <defs>
      <radialGradient id="veil" cx="0.5" cy="0.5" r="0.62">
        <stop offset="0" stop-color="#000" stop-opacity="0.62"/>
        <stop offset="0.7" stop-color="#000" stop-opacity="0.38"/>
        <stop offset="1" stop-color="#000" stop-opacity="0.12"/>
      </radialGradient>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity="0.6"/>
      </linearGradient>
    </defs>
    <rect width="${CARD}" height="${CARD}" fill="url(#veil)"/>
    <rect x="0" y="${CARD - 220}" width="${CARD}" height="220" fill="url(#fade)"/>
    <rect x="${CARD / 2 - 48}" y="${top}" width="96" height="8" rx="4" fill="${accent}"/>
    <path d="${headline}" fill="#ffffff" stroke="#000" stroke-opacity="0.35" stroke-width="2" paint-order="stroke"/>
    ${subline ? `<path d="${subline.d}" fill="${accent}"/>` : ""}
    <path d="${mark.d}" fill="#e5e7eb"/>
  </svg>`;

  return sharp(background)
    .composite([{ input: Buffer.from(overlay), left: 0, top: 0 }])
    .png()
    .toBuffer();
}

export async function composeCelebration(input: ComposeInput): Promise<Buffer> {
  const background = await sharp(input.background).resize(CARD, CARD, { fit: "cover" }).png().toBuffer();
  return input.photo ? composeWithPhoto(background, { ...input, photo: input.photo }) : composeWithoutPhoto(background, input);
}

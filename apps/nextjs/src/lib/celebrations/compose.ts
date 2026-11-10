/**
 * Builds the celebration card in code: a cached AI background, the member's photo in a
 * circle, the headline and the Elev8 mark. Deterministic; no model involved.
 *
 * Output: 1080×1080 PNG (square posts well everywhere, GroupMe included).
 * Text goes in as outlines from the bundled Montserrat (text.ts), so Vercel renders it the
 * same as a Mac; no system fonts are involved.
 */

import sharp from "sharp";

import { fitSize, textPath } from "./text";

export const CARD = 1080;
const PHOTO = 440;
const PHOTO_TOP = 200;
const RING = 10;

export interface ComposeInput {
  background: Buffer;
  /** The member's photo, any raster format sharp reads; null falls back to initials */
  photo: Buffer | null;
  firstName: string;
  headline: string;
  subline?: string;
  brand?: string;
}

const TEXT_MAX_WIDTH = CARD - 2 * 60;

async function circularPhoto(photo: Buffer | null, initials: string): Promise<Buffer> {
  const mask = Buffer.from(`<svg width="${PHOTO}" height="${PHOTO}"><circle cx="${PHOTO / 2}" cy="${PHOTO / 2}" r="${PHOTO / 2}"/></svg>`);
  if (photo) {
    return sharp(photo)
      .rotate() // honor EXIF orientation from phone photos
      .resize(PHOTO, PHOTO, { fit: "cover", position: "attention" })
      .composite([{ input: mask, blend: "dest-in" }])
      .png()
      .toBuffer();
  }
  // Initials on a solid disc when the member has no photo
  const initial = textPath(initials, { size: 170, weight: "extrabold", cx: PHOTO / 2, y: PHOTO / 2 + 60 });
  const svg = `<svg width="${PHOTO}" height="${PHOTO}">
    <circle cx="${PHOTO / 2}" cy="${PHOTO / 2}" r="${PHOTO / 2}" fill="#1f2937"/>
    <path d="${initial.d}" fill="#f9fafb"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function composeCelebration(input: ComposeInput): Promise<Buffer> {
  const brand = input.brand ?? "ELEV8 PERFORMANCE";
  const initials = input.firstName.slice(0, 1).toUpperCase();
  const [background, photo] = await Promise.all([
    sharp(input.background).resize(CARD, CARD, { fit: "cover" }).png().toBuffer(),
    circularPhoto(input.photo, initials),
  ]);

  const ringSize = PHOTO + RING * 2;
  const ring = Buffer.from(
    `<svg width="${ringSize}" height="${ringSize}"><circle cx="${ringSize / 2}" cy="${ringSize / 2}" r="${ringSize / 2 - 1}" fill="#f5c542"/></svg>`,
  );

  const textTop = PHOTO_TOP + PHOTO + 110;
  const headlineSize = fitSize(input.headline, "extrabold", TEXT_MAX_WIDTH, 84, 44);
  const headline = textPath(input.headline, { size: headlineSize, weight: "extrabold", cx: CARD / 2, y: textTop });
  const subline = input.subline ? textPath(input.subline, { size: fitSize(input.subline, "semibold", TEXT_MAX_WIDTH, 40, 28), weight: "semibold", cx: CARD / 2, y: textTop + 72 }) : null;
  const mark = textPath(brand, { size: 30, weight: "semibold", cx: CARD / 2, y: CARD - 48, letterSpacing: 6 });
  const overlay = `<svg width="${CARD}" height="${CARD}">
    <defs>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity="0.72"/>
      </linearGradient>
    </defs>
    <rect x="0" y="${CARD - 420}" width="${CARD}" height="420" fill="url(#fade)"/>
    <path d="${headline.d}" fill="#ffffff" stroke="#000" stroke-opacity="0.35" stroke-width="2" paint-order="stroke"/>
    ${subline ? `<path d="${subline.d}" fill="#f5c542"/>` : ""}
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

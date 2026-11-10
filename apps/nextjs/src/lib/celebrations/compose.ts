/**
 * Builds the celebration card in code: a cached AI background, the member's photo in a
 * circle, the headline and the Elev8 mark. Deterministic; no model involved.
 *
 * Output: 1080×1080 PNG (square posts well everywhere, GroupMe included).
 * Text is rendered through an SVG overlay, so it uses the fonts installed where this runs.
 * Phase 2 note: Vercel functions ship few fonts; bundle a TTF before deploying this.
 */

import sharp from "sharp";

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

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Fit the headline on one line: shrink the font for long names */
function headlineSize(text: string) {
  if (text.length <= 18) return 84;
  if (text.length <= 24) return 68;
  return 56;
}

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
  const svg = `<svg width="${PHOTO}" height="${PHOTO}">
    <circle cx="${PHOTO / 2}" cy="${PHOTO / 2}" r="${PHOTO / 2}" fill="#1f2937"/>
    <text x="50%" y="50%" dy="0.36em" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="170" fill="#f9fafb">${esc(initials)}</text>
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
  const overlay = `<svg width="${CARD}" height="${CARD}">
    <defs>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity="0.72"/>
      </linearGradient>
    </defs>
    <rect x="0" y="${CARD - 420}" width="${CARD}" height="420" fill="url(#fade)"/>
    <text x="50%" y="${textTop}" text-anchor="middle" font-family="Arial Black, Helvetica, Arial, sans-serif" font-weight="900" font-size="${headlineSize(input.headline)}" fill="#ffffff" stroke="#000" stroke-opacity="0.35" stroke-width="2" paint-order="stroke">${esc(input.headline)}</text>
    ${input.subline ? `<text x="50%" y="${textTop + 72}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="600" font-size="40" fill="#f5c542">${esc(input.subline)}</text>` : ""}
    <text x="50%" y="${CARD - 48}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="30" letter-spacing="6" fill="#e5e7eb">${esc(brand)}</text>
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

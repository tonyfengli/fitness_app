/**
 * Card text as SVG paths, so the card renders the same on Vercel (which ships no fonts) as on a
 * Mac. Montserrat (OFL, see fonts/OFL.txt) is bundled and read with opentype.js; sharp then
 * draws the outlines and never needs a system font.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import opentype from "opentype.js"; // CJS build: default import (types in src/types/opentype.js.d.ts)
import type { Font } from "opentype.js";

export type Weight = "extrabold" | "semibold";

const FILES: Record<Weight, string> = {
  extrabold: "Montserrat-ExtraBold.ttf",
  semibold: "Montserrat-SemiBold.ttf",
};

const fonts = new Map<Weight, Font>();

function font(weight: Weight): Font {
  let f = fonts.get(weight);
  if (!f) {
    // process.cwd() is the app root on Vercel and in `next dev`; next.config lists this folder in
    // outputFileTracingIncludes so the files ship with the functions.
    const buf = readFileSync(join(process.cwd(), "src/lib/celebrations/fonts", FILES[weight]));
    f = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    fonts.set(weight, f);
  }
  return f;
}

export interface TextPath {
  /** SVG path data, positioned so the text is centered on `cx` with its baseline at `y` */
  d: string;
  width: number;
}

/** The outline of one line of text, centered on cx */
export function textPath(text: string, opts: { size: number; weight: Weight; cx: number; y: number; letterSpacing?: number }): TextPath {
  const f = font(opts.weight);
  const spacing = opts.letterSpacing ?? 0;
  const width = f.getAdvanceWidth(text, opts.size) + spacing * Math.max(0, text.length - 1);
  const x = opts.cx - width / 2;
  if (!spacing) return { d: f.getPath(text, x, opts.y, opts.size).toPathData(2), width };
  // Letter-spaced: lay glyphs out one at a time
  let cursor = x;
  const parts: string[] = [];
  for (const ch of text) {
    parts.push(f.getPath(ch, cursor, opts.y, opts.size).toPathData(2));
    cursor += f.getAdvanceWidth(ch, opts.size) + spacing;
  }
  return { d: parts.join(" "), width };
}

/** The largest size (down to `min`) at which the text fits in `maxWidth` */
export function fitSize(text: string, weight: Weight, maxWidth: number, max: number, min: number): number {
  const f = font(weight);
  let size = max;
  while (size > min && f.getAdvanceWidth(text, size) > maxWidth) size -= 2;
  return size;
}

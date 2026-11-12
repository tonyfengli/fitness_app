/**
 * Contact sheets of the members' GroupMe group avatars, to judge by eye which are usable
 * portraits. Reads GroupMe; writes PNGs to OUT_DIR only.
 *   OUT_DIR=<dir> npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/tmp/groupme-contact-sheet.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const out = process.env.OUT_DIR ?? "scripts/tmp/out";
mkdirSync(out, { recursive: true });
const res = await fetch(`https://api.groupme.com/v3/groups/112260134`, { headers: { "X-Access-Token": process.env.GROUPME_ACCESS_TOKEN ?? "" } });
const members = ((await res.json()) as { response: { members: { nickname: string; image_url: string | null }[] } }).response.members
  .filter((m) => m.image_url)
  .sort((a, b) => a.nickname.localeCompare(b.nickname));
const CELL = 300, LABEL = 44, COLS = 4, ROWS = 4;
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
for (let page = 0; page * COLS * ROWS < members.length; page++) {
  const slice = members.slice(page * COLS * ROWS, (page + 1) * COLS * ROWS);
  const tiles = await Promise.all(
    slice.map(async (m, i) => {
      const r = await fetch(m.image_url ?? "");
      const type = r.headers.get("content-type") ?? "?";
      const buf = Buffer.from(await r.arrayBuffer());
      const meta = await sharp(buf).metadata().catch(() => null);
      const img = await sharp(buf, { pages: 1 }).rotate().resize(CELL, CELL, { fit: "cover", position: "attention" }).png().toBuffer().catch(() => null);
      const label = Buffer.from(`<svg width="${CELL}" height="${LABEL}"><rect width="100%" height="100%" fill="#111"/><text x="6" y="18" font-family="Helvetica" font-size="15" fill="#fff">${esc(m.nickname.slice(0, 34))}</text><text x="6" y="37" font-family="Helvetica" font-size="12" fill="#9ca3af">${type.replace("image/", "")} ${meta?.width ?? "?"}×${meta?.height ?? "?"}${(meta?.pages ?? 1) > 1 ? " animated" : ""}</text></svg>`);
      const left = (i % COLS) * CELL, top = Math.floor(i / COLS) * (CELL + LABEL);
      return [...(img ? [{ input: img, left, top }] : []), { input: label, left, top: top + CELL }];
    }),
  );
  const file = join(out, `groupme-${page + 1}.png`);
  writeFileSync(file, await sharp({ create: { width: COLS * CELL, height: ROWS * (CELL + LABEL), channels: 3, background: "#333" } }).composite(tiles.flat()).png().toBuffer());
  console.log(file);
}
process.exit(0);

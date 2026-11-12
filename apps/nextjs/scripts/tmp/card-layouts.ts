/**
 * Layout check for celebration cards: renders the no-photo and photo layouts to OUT_DIR
 * from the stored theme background. Reads the database (background URL); writes nothing to it.
 *   OUT_DIR=<dir> npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/tmp/card-layouts.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { db } from "@acme/db/client";
import { CelebrationBackground } from "@acme/db/schema";

import { composeCelebration } from "../../src/lib/celebrations/compose";
import { nextTheme } from "../../src/lib/celebrations/themes";

const out = process.env.OUT_DIR ?? join(process.cwd(), "scripts/tmp/out");
mkdirSync(out, { recursive: true });
const theme = nextTheme("birthday", []);
const [bg] = await db.select().from(CelebrationBackground).limit(1);
if (!bg) throw new Error("no stored background");
const background = Buffer.from(await (await fetch(bg.imageUrl)).arrayBuffer());
const photo = process.env.PHOTO_URL ? Buffer.from(await (await fetch(process.env.PHOTO_URL)).arrayBuffer()) : null;

const cases: [string, string, string | undefined, Buffer | null][] = [
  ["nophoto-short", theme.headline("Alex"), theme.subline?.(), null],
  ["nophoto-long", theme.headline("Maximiliano"), theme.subline?.(), null],
  ["nophoto-custom", "Happy 30th, Alex! Go lift something heavy", "", null],
  ["nophoto-nosub", "Cheers to you, Jordan!", undefined, null],
];
if (photo) cases.push(["photo", theme.headline("Alex"), theme.subline?.(), photo]);
for (const [name, headline, subline, p] of cases) {
  const png = await composeCelebration({ background, photo: p, headline, subline: subline || undefined, accent: theme.accent });
  writeFileSync(join(out, `${name}.png`), png);
  console.log(join(out, `${name}.png`));
}
process.exit(0);

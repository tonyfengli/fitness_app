/**
 * Try the photo cleanup on one GroupMe avatar and write before/after to OUT_DIR.
 * Sends that one picture to OpenAI. Writes nothing to the database.
 *   OUT_DIR=<dir> npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/tmp/photo-cleanup-test.ts "<nickname>" ["who in the photo"]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { cleanPortrait } from "../../src/lib/celebrations/portrait";
import { groupMembers } from "../../src/lib/celebrations/groupme";

const [nickname, who] = process.argv.slice(2);
const out = process.env.OUT_DIR ?? "scripts/tmp/out";
mkdirSync(out, { recursive: true });
const m = (await groupMembers()).find((g) => g.nickname === nickname);
if (!m?.imageUrl) throw new Error(`no group member with a picture called "${nickname}"`);
const before = Buffer.from(await (await fetch(m.imageUrl)).arrayBuffer());
const made = await cleanPortrait(before, who);
writeFileSync(join(out, "portrait-before.jpg"), before);
writeFileSync(join(out, "portrait-after.png"), made.png);
console.log(`${made.model} ${made.ms}ms → ${join(out, "portrait-after.png")}`);
process.exit(0);

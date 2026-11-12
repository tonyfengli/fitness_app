/**
 * Try the AI card edit end to end on disk: a portrait PNG → code-built card → redrawn card.
 * Sends the card to OpenAI. Reads the stored theme background; writes nothing to the database.
 *   OUT_DIR=<dir> npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/tmp/card-edit-test.ts <portrait.png> <firstName> "<instruction>"
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { db } from "@acme/db/client";
import { CelebrationBackground } from "@acme/db/schema";

import { editImage } from "../../src/lib/ai/images";
import { composeCelebration } from "../../src/lib/celebrations/compose";
import { nextTheme } from "../../src/lib/celebrations/themes";

const [portrait, firstName, instruction] = process.argv.slice(2);
if (!portrait || !firstName || !instruction) throw new Error("usage: card-edit-test.ts <portrait.png> <firstName> <instruction>");
const out = process.env.OUT_DIR ?? "scripts/tmp/out";
const theme = nextTheme("birthday", []);
const [bg] = await db.select().from(CelebrationBackground).limit(1);
if (!bg) throw new Error("no stored background");
const background = Buffer.from(await (await fetch(bg.imageUrl)).arrayBuffer());
const card = await composeCelebration({ background, photo: readFileSync(portrait), headline: theme.headline(firstName), subline: theme.subline?.(), accent: theme.accent });
writeFileSync(join(out, "card-draft.png"), card);
const made = await editImage({
  images: [card],
  prompt:
    `This is a square birthday card for a gym member. Change it as follows: ${instruction}. ` +
    "Keep it a finished, postable card. Keep every word of the text spelled exactly as it is unless the change asks for different words. " +
    "If a person is shown, keep them the same person with the same face and likeness.",
  purpose: "celebrations:birthday:edit",
});
writeFileSync(join(out, "card-edited.png"), made.png);
console.log(`${made.ms}ms → ${join(out, "card-edited.png")}`);
process.exit(0);

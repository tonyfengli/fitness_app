/**
 * Save a founder's working-style settings from an interview (ai-crew/shared/working-style-guide.md).
 * Tony interviews the founder, the settings are drafted from the notes, Tony confirms, then:
 *
 *   npx tsx --env-file=.env.local scripts/set-working-style.ts <file.json>           (shows what would change)
 *   npx tsx --env-file=.env.local scripts/set-working-style.ts <file.json> --apply
 *
 * The file is kept out of git (it holds a person's words):
 *   { "who": "<first name, full name or alias>", "by": "<who ran the interview; default = who>",
 *     "settings": { "askStyle"?, "avoid"?, "pushLevel"?, "bestTimes"?, "answerStyle"?, "focus"? },
 *     "saidOn": "YYYY-MM-DD", "said": ["their words, one answer per line", …] }
 * Settings left out are not touched. Each line of `said` becomes a dated preference note.
 */

import { readFileSync } from "node:fs";
import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { TeamProfile, user } from "@acme/db/schema";

import { getGymBusinessId } from "../src/lib/business";
import { addNote, getProfile, setProfileFields, STYLE_FIELDS } from "../src/lib/team/profile";
import type { ProfilePatch } from "../src/lib/team/profile";

interface Input {
  who: string;
  by?: string;
  settings: ProfilePatch;
  saidOn?: string;
  said?: string[];
}

async function founder(name: string) {
  const q = name.trim().toLowerCase();
  const businessId = await getGymBusinessId();
  const rows = await db
    .select({ id: user.id, name: user.name, aliases: TeamProfile.aliases })
    .from(TeamProfile)
    .innerJoin(user, eq(user.id, TeamProfile.userId))
    .where(and(eq(TeamProfile.businessId, businessId), eq(TeamProfile.active, true)));
  const hits = rows.filter((r) => r.name.toLowerCase() === q || r.name.split(" ")[0]?.toLowerCase() === q || r.aliases.some((a) => a.toLowerCase() === q));
  if (hits.length !== 1) throw new Error(`"${name}" matches ${hits.length} founders`);
  return hits[0]!;
}

const file = process.argv[2];
if (!file) throw new Error("Usage: set-working-style.ts <file.json> [--apply]");
const apply = process.argv.includes("--apply");
const input = JSON.parse(readFileSync(file, "utf8")) as Input;

const target = await founder(input.who);
const author = await founder(input.by ?? input.who);
const before = await getProfile(target.id);
if (!before) throw new Error("No profile");

const patch: ProfilePatch = {};
for (const key of STYLE_FIELDS) if (input.settings[key] !== undefined) patch[key] = input.settings[key];
const extra = Object.keys(input.settings).filter((k) => !STYLE_FIELDS.some((f) => f === k));
if (extra.length) throw new Error(`Not working-style settings: ${extra.join(", ")}`);

console.log(`${apply ? "Saving" : "Would save"} for ${target.name.split(" ")[0]} (interview by ${author.name.split(" ")[0]}):`);
for (const key of Object.keys(patch) as (keyof ProfilePatch)[]) console.log(`  ${key}\n    was: ${before[key] ?? "(not set)"}\n    now: ${patch[key] ?? "(cleared)"}`);
const notes = (input.said ?? []).map((s) => `Interview ${input.saidOn ?? new Date().toISOString().slice(0, 10)}: "${s.trim()}"`.slice(0, 500));
console.log(`  notes: ${notes.length}`);

if (apply) {
  await setProfileFields(target.id, patch);
  const existing = new Set(before.notes.map((n) => n.text));
  let added = 0;
  for (const text of notes) {
    if (existing.has(text)) continue; // a second run adds nothing twice
    await addNote(target.id, { kind: "preference", text }, { kind: "person", userId: author.id }, "dashboard");
    added++;
  }
  const after = await getProfile(target.id);
  console.log(`Saved. ${added} note(s) added. Profile now:`);
  for (const key of STYLE_FIELDS) console.log(`  ${key}: ${after?.[key] ?? "(not set)"}`);
} else console.log("Nothing written. Add --apply to save.");
process.exit(0);

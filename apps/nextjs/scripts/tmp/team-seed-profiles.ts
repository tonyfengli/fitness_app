/**
 * Make sure every founder has a team profile (active; Slack id only where known), so the
 * Chief of Staff can read and add to it. Re-runnable; never overwrites what's already there.
 *   npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/tmp/team-seed-profiles.ts
 * Optional summary fields: put them in a JSON file and pass its path as the first argument:
 *   { "k.kuratadpt@gmail.com": { "role": "...", "owns": "...", "answerStyle": "...", "focus": "..." }, ... }
 */

import { readFileSync } from "node:fs";

import { setProfileFields } from "../../src/lib/team/profile";
import { ensureProfile, trainerIdByEmail } from "../../src/lib/team/setup";

const FOUNDERS: { email: string; aliases: string[]; slackUserId?: string }[] = [
  { email: "tony.li.feng@gmail.com", aliases: ["Tony"], slackUserId: "U0ASR9JE1KJ" },
  { email: "eileenmtz27@gmail.com", aliases: ["Eileen"] },
  { email: "richiecakis@gmail.com", aliases: ["Richie", "Rich", "Richard"] },
  { email: "davemar1977@gmail.com", aliases: ["David", "Dave"] },
  { email: "k.kuratadpt@gmail.com", aliases: ["Kyle"] },
];

const seedPath = process.argv[2];
const seed = seedPath ? (JSON.parse(readFileSync(seedPath, "utf8")) as Record<string, { role?: string; owns?: string; answerStyle?: string; focus?: string }>) : {};

for (const f of FOUNDERS) {
  const id = await trainerIdByEmail(f.email);
  await ensureProfile(id, { aliases: f.aliases, active: true, ...(f.slackUserId ? { slackUserId: f.slackUserId } : {}) });
  const fields = seed[f.email];
  if (fields) await setProfileFields(id, fields);
  console.log(`${f.aliases[0]}: profile ok${fields ? " + summary set" : ""}`);
}
process.exit(0);

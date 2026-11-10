/**
 * Celebrations Phase 1 proof of concept: one member → one PNG on disk. No database, no posting.
 *
 *   OUT_DIR=<dir> npx tsx --env-file=.env.local --tsconfig tsconfig.json \
 *     scripts/tmp/celebration-poc.ts <memberId> [theme] [detail]
 *
 * The AI background is generated once per theme and cached in OUT_DIR/backgrounds, so re-runs
 * (new member, new layout) cost nothing. Delete the cached file to regenerate.
 * Env: GYMMASTER_NEW_*, OPENAI_API_KEY. See ai-crew/docs/BUSINESS-ACCOUNTABILITY.md.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { generateImage } from "../../src/lib/ai/images";
import { composeCelebration } from "../../src/lib/celebrations/compose";
import { fetchMemberPhoto, hasRealPhoto } from "../../src/lib/celebrations/photo";
import { DEFAULT_THEME, THEMES } from "../../src/lib/celebrations/themes";
import { getMemberProfile } from "../../src/lib/gymmaster-member";

const [memberId, themeKey = DEFAULT_THEME.birthday, detail] = process.argv.slice(2);
if (!memberId) throw new Error("usage: celebration-poc.ts <memberId> [theme] [detail]");
const theme = THEMES[themeKey];
if (!theme) throw new Error(`unknown theme ${themeKey}; have ${Object.keys(THEMES).join(", ")}`);
const outDir = process.env.OUT_DIR ?? join(process.cwd(), "scripts/tmp/out");
mkdirSync(join(outDir, "backgrounds"), { recursive: true });

const profile = await getMemberProfile(memberId);
if (!profile) throw new Error(`member ${memberId} not found`);
const firstName = String(profile.firstname ?? "").trim() || "Member";
console.log(`member ${memberId}: first name ${firstName}, dob ${profile.dob ?? "none"}, photo ${hasRealPhoto(profile.memberimage) ? "url" : "none/initials"}`);

const bgPath = join(outDir, "backgrounds", `${theme.key}.png`);
let background: Buffer;
if (existsSync(bgPath)) {
  background = readFileSync(bgPath);
  console.log(`background: cached ${bgPath}`);
} else {
  const made = await generateImage({ prompt: theme.backgroundPrompt, purpose: `celebrations:${theme.type}`, quality: "medium" });
  background = made.png;
  writeFileSync(bgPath, background);
  console.log(`background: generated with ${made.model} in ${made.ms}ms → ${bgPath}`);
}

const photo = hasRealPhoto(profile.memberimage) ? await fetchMemberPhoto(profile.memberimage) : null;
console.log(`photo: ${photo ? `${Math.round(photo.length / 1024)}KB` : "none, using initials"}`);

const png = await composeCelebration({
  background,
  photo,
  firstName,
  headline: theme.headline(firstName),
  subline: theme.subline?.(detail),
});
const outPath = join(outDir, `${theme.key}-${memberId}.png`);
writeFileSync(outPath, png);
console.log(`card: ${outPath} (${Math.round(png.length / 1024)}KB)`);
process.exit(0);

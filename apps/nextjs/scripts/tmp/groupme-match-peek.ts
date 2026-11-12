/**
 * Phase 2 exploration: how well do the members' GroupMe group nicknames match current members?
 * Reads GroupMe (GROUPME_ACCESS_TOKEN) and GymMaster; writes nothing.
 *   npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/tmp/groupme-match-peek.ts
 */
import { fetchMemberPhoto, hasRealPhoto } from "../../src/lib/celebrations/photo";
import { getMemberProfile } from "../../src/lib/gymmaster-member";
import { getCurrentMembers } from "../../src/lib/kilo-members";

const GROUP = "112260134";
const res = await fetch(`https://api.groupme.com/v3/groups/${GROUP}`, { headers: { "X-Access-Token": process.env.GROUPME_ACCESS_TOKEN ?? "" } });
const body = (await res.json()) as { response?: { name: string; members: { user_id: string; nickname: string; name?: string; image_url: string | null; roles?: string[] }[] } };
const gm = body.response?.members ?? [];
console.log(`group "${body.response?.name}": ${gm.length} members, ${gm.filter((m) => m.image_url).length} with an image`);
console.log("member keys:", Object.keys(gm[0] ?? {}).join(", "));
const sample = gm.find((m) => m.image_url)?.image_url;
if (sample) {
  for (const url of [sample, `${sample}.large`, `${sample}.avatar`]) {
    const r = await fetch(url);
    console.log(`fetch without token ${url.replace(/[0-9a-f]{20,}/, "…")}: ${r.status} ${r.headers.get("content-type")} ${(await r.arrayBuffer()).byteLength}B`);
  }
}

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();
const members = await getCurrentMembers();
let exact = 0, unsure = 0, none = 0, hasPhoto = 0;
for (const m of members) {
  const p = await getMemberProfile(m.memberId).catch(() => null);
  const first = norm(String(p?.firstname ?? "")), last = norm(String(p?.surname ?? ""));
  const full = `${first} ${last}`.trim();
  const photo = hasRealPhoto(p?.memberimage) ? !!(await fetchMemberPhoto(p.memberimage)) : false; // placeholders are SVGs behind a normal URL
  if (photo) hasPhoto++;
  const ex = gm.filter((g) => norm(g.nickname) === full || norm(g.name ?? "") === full);
  const loose = gm.filter((g) => !ex.includes(g) && [norm(g.nickname), norm(g.name ?? "")].some((n) => n && (n.split(" ")[0] === first.split(" ")[0] || (last && n.split(" ").includes(last)))));
  const kind = ex.length === 1 ? "EXACT" : ex.length > 1 || loose.length ? "UNSURE" : "NONE";
  if (kind === "EXACT") exact++; else if (kind === "UNSURE") unsure++; else none++;
  const show = (g: (typeof gm)[number]) => `"${g.nickname}"${g.name && g.name !== g.nickname ? ` (${g.name})` : ""}${g.image_url ? "" : " [no image]"}`;
  console.log(`${kind.padEnd(6)} #${m.memberId} ${full}${photo ? " [has GymMaster photo]" : ""}${kind === "NONE" ? "" : ` ← ${[...ex, ...loose].map(show).join(" | ")}`}`);
}
console.log(`\n${members.length} current members: ${hasPhoto} with a GymMaster photo; GroupMe exact ${exact}, unsure ${unsure}, none ${none}`);
process.exit(0);

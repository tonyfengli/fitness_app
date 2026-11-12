/**
 * The members' GroupMe group as a source of photos for members whose GymMaster record has none.
 * Read-only: one call for the group's members (nickname + profile picture). The pictures
 * themselves are public URLs (i.groupme.com) and need no token.
 *
 * Env: GROUPME_ACCESS_TOKEN (the token acts as the account it came from; only this file uses
 * it), GROUPME_GROUP_ID (optional; default the "Elev8 Performance" group).
 *
 * Matching is by name only and never decides anything: it finds the most likely person, and a
 * founder says yes or no once (celebration_photo_match). Half the group's pictures are family
 * shots, couples or artwork, so even an exact name match needs that yes.
 */

const DEFAULT_GROUP_ID = "112260134"; // "Elev8 Performance"

export interface GroupMember {
  userId: string;
  nickname: string;
  /** Their account name when it differs from the nickname */
  name: string | null;
  imageUrl: string | null;
}

export const groupMeConfigured = () => !!process.env.GROUPME_ACCESS_TOKEN;

const CACHE_MS = 10 * 60 * 1000;
let cache: { at: number; members: GroupMember[] } | null = null;

export async function groupMembers(): Promise<GroupMember[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.members;
  const token = process.env.GROUPME_ACCESS_TOKEN;
  if (!token) throw new Error("GROUPME_ACCESS_TOKEN is not set");
  const id = process.env.GROUPME_GROUP_ID ?? DEFAULT_GROUP_ID;
  const res = await fetch(`https://api.groupme.com/v3/groups/${id}`, { headers: { "X-Access-Token": token }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`GroupMe group ${id}: HTTP ${res.status}`);
  const body = (await res.json()) as { response?: { members?: { user_id: string; nickname: string; name?: string; image_url?: string | null }[] } };
  const members = (body.response?.members ?? []).map((m) => ({
    userId: String(m.user_id),
    nickname: m.nickname,
    name: m.name && m.name !== m.nickname ? m.name : null,
    imageUrl: m.image_url ? m.image_url : null,
  }));
  cache = { at: Date.now(), members };
  return members;
}

/** Lowercase letters and single spaces: "Alex Kim🌻" → "alex kim", "Lee-Park" → "lee park" */
export const normName = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export interface PhotoSuggestion {
  member: GroupMember & { imageUrl: string };
  /** The nickname (or account name) equals the member's full name */
  exactName: boolean;
}

/**
 * The one group member most likely to be this gym member, if they have a picture.
 * Full name equal (3) > same first name (2) > first names share a start, "Liz"/"Lizbeth" (1).
 * A shared surname alone is a relative, not a match. Two people tied at the top = no suggestion.
 */
export function suggestPhoto(firstName: string, surname: string, group: GroupMember[]): PhotoSuggestion | null {
  const first = normName(firstName).split(" ")[0] ?? "";
  const full = normName(`${firstName} ${surname}`);
  if (!first) return null;
  const score = (g: GroupMember) => {
    let best = 0;
    for (const raw of [g.nickname, g.name ?? ""]) {
      const n = normName(raw);
      if (!n) continue;
      const theirFirst = n.split(" ")[0] ?? "";
      if (n === full) best = Math.max(best, 3);
      else if (theirFirst === first) best = Math.max(best, 2);
      else if (first.length >= 3 && theirFirst.length >= 3 && (first.startsWith(theirFirst) || theirFirst.startsWith(first))) best = Math.max(best, 1);
    }
    return best;
  };
  const scored = group.map((g) => ({ g, s: score(g) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  const top = scored[0];
  if (!top || scored[1]?.s === top.s) return null;
  if (!top.g.imageUrl) return null;
  return { member: { ...top.g, imageUrl: top.g.imageUrl }, exactName: top.s === 3 };
}

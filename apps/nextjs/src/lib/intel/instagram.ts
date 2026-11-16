/**
 * Turns the Instagram scraper's items into rows, with no database in it (collect.ts stores
 * them). The scraper returns two kinds of item: a post, or a profile (followers, post count).
 * Personal data about private people is dropped here, before anything is stored: commenters
 * and their comments, and people tagged in a post.
 */

type Item = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);

/** Fields that name or quote private people; removed from the stored copy at every depth */
const PRIVATE_KEYS = new Set(["latestComments", "firstComment", "taggedUsers", "coauthorProducers", "mentions"]);

export function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Item)
        .filter(([k]) => !PRIVATE_KEYS.has(k))
        .map(([k, v]) => [k, scrub(v)]),
    );
  }
  return value;
}

/** "elev8_anaheim" from a handle, an @handle or a profile URL */
export function handleOf(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const fromUrl = /instagram\.com\/([A-Za-z0-9_.]+)/.exec(s)?.[1];
  const h = (fromUrl ?? s).replace(/^@/, "").replace(/\/+$/, "").toLowerCase();
  return /^[a-z0-9_.]{1,60}$/.test(h) ? h : null;
}

export const profileUrl = (handle: string) => `https://www.instagram.com/${handle}/`;

export const isProfileItem = (item: Item) => typeof item.followersCount === "number" && !item.shortCode;
export const isPostItem = (item: Item) => typeof item.shortCode === "string";

/** The tracked account an item belongs to: the profile asked for, not a collaborator who posted it */
export const itemHandle = (item: Item) => handleOf(item.inputUrl) ?? handleOf(item.username) ?? handleOf(item.ownerUsername);

export interface ProfileRow {
  handle: string;
  followers: number | null;
  following: number | null;
  postCount: number | null;
  raw: Item;
}

export function toProfile(item: Item): ProfileRow | null {
  const handle = itemHandle(item);
  if (!handle) return null;
  // The profile item repeats the latest posts; they are stored from the posts run, not twice
  const { latestPosts: _posts, latestIgtvVideos: _igtv, ...rest } = item;
  return { handle, followers: num(item.followersCount), following: num(item.followsCount), postCount: num(item.postsCount), raw: scrub(rest) as Item };
}

export interface PostRow {
  handle: string;
  externalId: string;
  mediaId: string | null;
  authorHandle: string | null;
  type: "reel" | "carousel" | "image";
  postedAt: Date | null;
  caption: string | null;
  url: string;
  durationSeconds: string | null;
  audio: string | null;
  likes: number | null;
  comments: number | null;
  views: number | null;
  pinned: boolean;
  raw: Item;
}

export function toPost(item: Item): PostRow | null {
  const handle = itemHandle(item);
  const externalId = str(item.shortCode);
  if (!handle || !externalId) return null;
  const type = item.type === "Video" ? "reel" : item.type === "Sidecar" ? "carousel" : "image";
  const posted = str(item.timestamp);
  const music = (item.musicInfo ?? null) as { song_name?: string; artist_name?: string } | null;
  const audio = music?.song_name ? [music.song_name, music.artist_name].filter(Boolean).join(" · ") : null;
  const duration = typeof item.videoDuration === "number" ? item.videoDuration.toFixed(2) : null;
  return {
    handle,
    externalId,
    mediaId: str(item.id),
    authorHandle: handleOf(item.ownerUsername),
    type,
    postedAt: posted ? new Date(posted) : null,
    caption: str(item.caption),
    url: str(item.url) ?? `https://www.instagram.com/p/${externalId}/`,
    durationSeconds: duration,
    audio,
    likes: num(item.likesCount), // -1 when the account hides likes, stored as null
    comments: num(item.commentsCount),
    views: num(item.videoPlayCount) ?? num(item.videoViewCount),
    pinned: item.isPinned === true,
    raw: scrub(item) as Item,
  };
}

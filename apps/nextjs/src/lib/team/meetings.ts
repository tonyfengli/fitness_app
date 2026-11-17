/**
 * The meeting record: Granola's summary of each meeting, saved as written (team_meeting).
 * The Chief of Staff reads it in three steps, so the cost of a question does not grow with
 * the number of meetings: the index (one line per meeting), a word search that returns the
 * matching sections, and one meeting in full.
 *
 * Nothing here is rewritten by a model: a summary goes in as Granola wrote it and comes out
 * the same. Design: ai-crew/docs/BUSINESS-ACCOUNTABILITY.md → "Meeting memory".
 */

import { and, desc, eq, sql } from "@acme/db";
import { db } from "@acme/db/client";
import { TeamMeeting } from "@acme/db/schema";

import { getGymBusinessId } from "../business";

const TZ = "America/Los_Angeles";
const SECTION_CHARS = 1800;
const MAX_HITS = 8;

/** The meeting's calendar day in Pacific time, YYYY-MM-DD */
export const meetingDay = (at: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(at);

/** Granola's id from a shared link (notes.granola.ai/d/<id> or /t/<id>-<slug>) */
export function granolaRef(url: string): string | null {
  return /notes\.granola\.ai\/[dt]\/([0-9a-f-]{36})/.exec(url)?.[1] ?? null;
}

/** A summary's sections: the text under each "## heading" (text before the first heading has none) */
export function sections(notes: string): { heading: string; text: string }[] {
  const out: { heading: string; text: string }[] = [];
  let current = { heading: "", lines: [] as string[] };
  const push = () => {
    const text = current.lines.join("\n").trim();
    if (text) out.push({ heading: current.heading, text });
  };
  for (const line of notes.split(/\r?\n/)) {
    const m = /^#{1,6}\s+(.+)$/.exec(line.trim());
    if (m) {
      push();
      current = { heading: (m[1] ?? "").trim(), lines: [] };
    } else current.lines.push(line);
  }
  push();
  return out;
}

export interface MeetingInput {
  url: string;
  title: string;
  /** When the note was started (Granola's created_at) */
  heldAt: string;
  notes: string;
}

/**
 * Save a meeting's summary. The same note saved again replaces its text (Granola's notes can
 * be edited after the meeting). A second link to a meeting already saved, with the same title
 * and start time, updates that row and adds no new one.
 */
export async function saveMeeting(input: MeetingInput): Promise<{ id: string; saved: "new" | "updated" | "unchanged"; day: string }> {
  const ref = granolaRef(input.url);
  if (!ref) throw new Error("Not a Granola note link");
  const heldAt = new Date(input.heldAt);
  if (Number.isNaN(heldAt.getTime())) throw new Error("heldAt is not a date");
  const notes = input.notes.trim();
  const title = input.title.trim();
  if (!notes || !title) throw new Error("A meeting needs a title and notes");
  const businessId = await getGymBusinessId();
  const headings = sections(notes).map((s) => s.heading).filter(Boolean);

  const [existing] = await db
    .select({ id: TeamMeeting.id, notes: TeamMeeting.notes, title: TeamMeeting.title })
    .from(TeamMeeting)
    .where(and(eq(TeamMeeting.businessId, businessId), sql`(${TeamMeeting.externalRef} = ${ref} or (${TeamMeeting.title} = ${title} and ${TeamMeeting.heldAt} = ${heldAt.toISOString()}))`))
    .limit(1);
  const day = meetingDay(heldAt);
  if (existing) {
    if (existing.notes === notes && existing.title === title) return { id: existing.id, saved: "unchanged", day };
    await db.update(TeamMeeting).set({ title, notes, headings, updatedAt: new Date() }).where(eq(TeamMeeting.id, existing.id));
    return { id: existing.id, saved: "updated", day };
  }
  const [row] = await db.insert(TeamMeeting).values({ businessId, source: "granola", externalRef: ref, url: input.url, title, heldAt, headings, notes }).returning({ id: TeamMeeting.id });
  if (!row) throw new Error("The meeting could not be saved");
  return { id: row.id, saved: "new", day };
}

export interface MeetingLine {
  id: string;
  day: string;
  title: string;
  headings: string[];
  url: string;
}

/** The index: every saved meeting, newest first, one line each */
export async function listMeetings(): Promise<MeetingLine[]> {
  const businessId = await getGymBusinessId();
  const rows = await db
    .select({ id: TeamMeeting.id, heldAt: TeamMeeting.heldAt, title: TeamMeeting.title, headings: TeamMeeting.headings, url: TeamMeeting.url })
    .from(TeamMeeting)
    .where(eq(TeamMeeting.businessId, businessId))
    .orderBy(desc(TeamMeeting.heldAt));
  return rows.map((r) => ({ id: r.id, day: meetingDay(r.heldAt), title: r.title, headings: r.headings, url: r.url }));
}

export interface MeetingHit {
  meetingId: string;
  day: string;
  title: string;
  heading: string;
  text: string;
  /** The meeting's shared Granola link, so an answer can point to its source */
  url: string;
  /** How many of the words asked for this section has, out of how many were searched */
  matched: number;
  of: number;
}

// Words too common to search on
const STOP = new Set(["the", "and", "for", "about", "what", "when", "who", "did", "was", "were", "our", "out", "with", "that", "this", "have", "has", "from", "are", "any", "how", "said", "say", "decide", "decided", "meeting", "meetings", "plan"]);
// "6 PM" and "6pm" are one word, in the question and in the notes
const normalize = (text: string) => text.toLowerCase().replace(/(\d{1,2})\s*(am|pm)\b/g, "$1$2");
/** The words a question is searched on: lower case, no common words; a word with a digit ("6pm", "50", "44-day") is kept whatever its length */
export const searchWords = (q: string) =>
  [...new Set(normalize(q).match(/[a-z0-9$%][a-z0-9$%.-]*/g) ?? [])].map((w) => w.replace(/[.-]+$/g, "")).filter((w) => (/\d/.test(w) ? w.length > 1 : w.length > 2) && !STOP.has(w));
// "signs" finds "signage", "budgets" finds "budget": compare on the first letters of longer words
const stem = (w: string) => (/\d/.test(w) ? w : w.length > 6 ? w.slice(0, -2) : w.length > 4 ? w.slice(0, -1) : w);
const startsWord = (w: string) => new RegExp(`(?<![a-z0-9])${stem(w).replace(/[.*+?^${}()|[\]\\$]/g, "\\$&")}`);

interface MeetingRow {
  id: string;
  heldAt: Date;
  title: string;
  notes: string;
  url: string;
}

/**
 * The sections that mention the words asked for, best first. A word must start a word in the
 * section ("sign" finds "signage", not "design"). A section scores more for a rarer word, so
 * one that has the unusual word of the question outranks one that only has the common ones;
 * ties go to the newer meeting. `matched` and `of` say how many of the words a section has,
 * so a weak hit can be seen for what it is.
 */
export function rankSections(rows: MeetingRow[], q: string): { words: string[]; hits: MeetingHit[] } {
  const words = searchWords(q);
  if (!words.length) return { words, hits: [] };
  const tests = words.map(startsWord);
  const all = rows.flatMap((r) => sections(r.notes).map((s) => ({ r, s, body: normalize(`${s.heading}\n${s.text}`) })));
  const has = all.map((x) => tests.map((t) => t.test(x.body)));
  // How rare each word is across all sections
  const weight = tests.map((_, i) => Math.log((all.length + 1) / (has.filter((h) => h[i]).length + 1)) + 0.1);
  const hits = all
    .map((x, k) => {
      const found = has[k] ?? [];
      return { x, matched: found.filter(Boolean).length, score: found.reduce((sum, hit, i) => sum + (hit ? (weight[i] ?? 0) : 0), 0) };
    })
    .filter((h) => h.matched > 0)
    .sort((a, b) => b.score - a.score || b.x.r.heldAt.getTime() - a.x.r.heldAt.getTime())
    .slice(0, MAX_HITS)
    .map(({ x, matched }) => ({ meetingId: x.r.id, day: meetingDay(x.r.heldAt), title: x.r.title, heading: x.s.heading, text: x.s.text.slice(0, SECTION_CHARS), url: x.r.url, matched, of: words.length }));
  return { words, hits };
}

/** Search every saved meeting. Returns the words actually searched, so a caller can see what was dropped. */
export async function searchMeetings(q: string): Promise<{ words: string[]; hits: MeetingHit[]; meetingsSearched: number }> {
  const businessId = await getGymBusinessId();
  const rows = await db
    .select({ id: TeamMeeting.id, heldAt: TeamMeeting.heldAt, title: TeamMeeting.title, notes: TeamMeeting.notes, url: TeamMeeting.url })
    .from(TeamMeeting)
    .where(eq(TeamMeeting.businessId, businessId))
    .orderBy(desc(TeamMeeting.heldAt));
  return { ...rankSections(rows, q), meetingsSearched: rows.length };
}

export interface MeetingFull extends MeetingLine {
  notes: string;
}

/** One meeting in full, by id or by day (YYYY-MM-DD). A day with several meetings returns them all. */
export async function getMeetings(idOrDay: string): Promise<MeetingFull[]> {
  const businessId = await getGymBusinessId();
  const rows = await db.select().from(TeamMeeting).where(eq(TeamMeeting.businessId, businessId)).orderBy(desc(TeamMeeting.heldAt));
  const isDay = /^\d{4}-\d{2}-\d{2}$/.test(idOrDay);
  return rows
    .filter((r) => (isDay ? meetingDay(r.heldAt) === idOrDay : r.id === idOrDay))
    .map((r) => ({ id: r.id, day: meetingDay(r.heldAt), title: r.title, headings: r.headings, url: r.url, notes: r.notes }));
}

/**
 * The Kilo "Member Retention" board: one card per at-risk member, kept in step with the
 * at-risk list (lib/at-risk.ts). fitness_app owns the state; the board shows it; a text or
 * call from Kilo, or a drag on the board, feeds it back. Design: ai-crew/docs/KILO-INTEGRATION.md.
 *
 * Per roster member, each run:
 *   - at risk, no card            -> create in At-Risk ("First Last · Tier · Nd · last touch", value = monthly revenue)
 *   - at risk, card closed        -> reopen the same card in At-Risk (Kilo allows one card per contact per board)
 *   - at risk, card open          -> put it in the column Kilo's conversation log says, and rename:
 *       Reached Out      a person texted / called / emailed from Kilo, within the last 5 days, nothing back since
 *       In Conversation  the member replied, or a call connected for 30+ seconds, within the last 5 days
 *       No Reply         we reached out, and the last word from anyone is 5+ days old
 *   - a class booked ahead in GymMaster -> Booked (back to the column above if that booking goes away)
 *   - attended a class            -> close Won
 *   - off the roster              -> close Lost
 * The middle columns follow the conversation log in either direction. Attendance always wins.
 * Each change is also written to retention_event, which keeps the per-episode history Kilo can't
 * (a reopened card is one card with several episodes).
 *
 * Test mode: KILO_RETENTION_TEST_MEMBERS (comma-separated GymMaster numbers) limits writes to
 * those members; everyone else is reported and skipped.
 */

import { and, desc, eq, inArray } from "@acme/db";
import { db } from "@acme/db/client";
import { RetentionEvent } from "@acme/db/schema";

import { AT_RISK_DAYS, computeAtRisk, getStatusTier, LOOKBACK_DAYS, VALID_ATTENDANCE, type MemberStanding } from "./at-risk";
import { getMemberName } from "./gymmaster-member";
import { fetchGymMasterReport } from "./gymmaster-report";
import { newAccountApi, newAccountConfig } from "./gymmaster-sources";
import { kiloConfig, kiloRequest, listKiloContacts, listKiloCustomFields, type KiloContact } from "./kilo";

export const PIPELINE_NAME = "Member Retention";
const STAGE_NAMES = { atRisk: "At-Risk", reachedOut: "Reached Out", noReply: "No Reply", inConversation: "In Conversation", booked: "Booked" } as const;
const ID_FIELD = "GymMaster Member ID";
const BOOKED_AHEAD_DAYS = 15; // a class booked within this many days reads as Booked
const NO_REPLY_DAYS = 5; // quiet this long after the last word -> No Reply
const REAL_CALL_SECONDS = 30; // a connected call this long counts as a conversation

type StageKey = keyof typeof STAGE_NAMES;
type CardStatus = "open" | "won" | "lost" | "abandoned";

interface Pipeline {
  id: string;
  stages: Record<StageKey, string>; // stage id by key
  stageKey: Map<string, StageKey>; // stage id -> key
}

export interface Card {
  id: string;
  name: string;
  contactId: string;
  status: CardStatus;
  pipelineStageId: string;
  monetaryValue?: number;
  createdAt: string;
  lastStatusChangeAt?: string;
  lastStageChangeAt?: string;
}

export interface SyncAction {
  memberId: string;
  name: string;
  kind: "create" | "reopen" | "rename" | "move" | "won" | "lost";
  detail: string;
  run: () => Promise<void>;
}

export interface SyncOptions {
  apply: boolean;
  /** Treat these members as on the roster: gone this many days, or "real" = from their GymMaster bookings (testing on a founder's own record) */
  force?: Map<string, number | "real">;
  now?: Date;
}

export interface SyncResult {
  testMembers: Set<string> | null;
  actions: SyncAction[];
  unchanged: string[];
  skipped: string[]; // test mode, or no Kilo contact
  warnings: string[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (date: string, now: Date) => Math.max(0, Math.floor((now.getTime() - Date.parse(date)) / 864e5));
const cardName = (name: string, daysGone: number, touch?: Touch, now?: Date) =>
  `${name} · ${getStatusTier(daysGone).label} · ${daysGone}d` + (touch && now ? ` · ${touch.what} ${daysAgo(touch.at, now)}d ago` : "");

export function testMembersFromEnv(): Set<string> | null {
  const raw = process.env.KILO_RETENTION_TEST_MEMBERS?.trim();
  return raw ? new Set(raw.split(",").map((s) => s.trim()).filter(Boolean)) : null;
}

// ---------------------------------------------------------------------------
// Kilo

export async function getRetentionPipeline(): Promise<Pipeline> {
  const { locationId } = kiloConfig();
  const r = await kiloRequest<{ pipelines: { id: string; name: string; stages: { id: string; name: string }[] }[] }>("GET", "opportunities/pipelines", {
    query: { locationId },
  });
  const p = r.pipelines.find((x) => x.name === PIPELINE_NAME);
  if (!p) throw new Error(`Kilo pipeline "${PIPELINE_NAME}" not found`);
  const stages = {} as Record<StageKey, string>;
  const stageKey = new Map<string, StageKey>();
  for (const [key, label] of Object.entries(STAGE_NAMES) as [StageKey, string][]) {
    const s = p.stages.find((x) => x.name === label);
    if (!s) throw new Error(`Kilo pipeline "${PIPELINE_NAME}" has no stage "${label}"`);
    stages[key] = s.id;
    stageKey.set(s.id, key);
  }
  return { id: p.id, stages, stageKey };
}

/** Every card on the board, any status */
export async function listCards(pipelineId: string): Promise<Card[]> {
  const { locationId } = kiloConfig();
  const all: Card[] = [];
  let page = 1;
  for (;;) {
    const r = await kiloRequest<{ opportunities: Card[]; meta?: { nextPage?: number | null } }>("GET", "opportunities/search", {
      query: { location_id: locationId, pipeline_id: pipelineId, limit: 100, page },
    });
    all.push(...r.opportunities);
    if (r.opportunities.length < 100 || !r.meta?.nextPage) break;
    page = r.meta.nextPage;
  }
  return all;
}

interface KiloMessage {
  id: string;
  direction?: string;
  messageType?: string;
  source?: string;
  dateAdded: string;
  userId?: string;
  status?: string;
  meta?: { call?: { duration?: number; status?: string } };
}

/** The last word in the conversation, for the card name: "texted 3d ago", "replied 1d ago", "called 2d ago" */
interface Touch {
  what: "texted" | "called" | "emailed" | "replied" | "talked";
  at: string;
}

/** This episode's conversation, from Kilo's log */
interface Conversation {
  outreach: KiloMessage[]; // texts, calls and emails sent by a person (not a workflow), newest first
  lastOutreach: string | null;
  lastTwoWay: string | null; // the member's latest reply, or the latest call that connected for 30+ seconds
  lastWord: Touch | null;
}

const TYPES = ["TYPE_SMS", "TYPE_CALL", "TYPE_EMAIL"];
const realCall = (m: KiloMessage) => m.messageType === "TYPE_CALL" && (m.meta?.call?.duration ?? 0) >= REAL_CALL_SECONDS;

async function readConversation(contactId: string, since: string): Promise<Conversation> {
  const { locationId } = kiloConfig();
  const convs = await kiloRequest<{ conversations: { id: string }[] }>("GET", "conversations/search", { query: { locationId, contactId } });
  const msgs: KiloMessage[] = [];
  for (const cv of convs.conversations) {
    const r = await kiloRequest<{ messages: { messages: KiloMessage[] } }>("GET", `conversations/${cv.id}/messages`, { query: { limit: 50 } });
    for (const m of r.messages.messages) if (m.dateAdded >= since && TYPES.includes(m.messageType ?? "") && m.source !== "workflow") msgs.push(m);
  }
  msgs.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
  const outreach = msgs.filter((m) => m.direction === "outbound");
  const lastOutreach = outreach[0]?.dateAdded ?? null;
  // A reply only counts after we reached out this episode; a long call counts either way
  const firstOutreach = outreach[outreach.length - 1]?.dateAdded;
  const twoWay = msgs.filter((m) => realCall(m) || (m.direction === "inbound" && firstOutreach && m.dateAdded > firstOutreach));
  const lastTwoWay = twoWay[0]?.dateAdded ?? null;
  const last = msgs.find((m) => m.direction === "outbound" || twoWay.includes(m));
  const lastWord: Touch | null = !last
    ? null
    : realCall(last)
      ? { what: "talked", at: last.dateAdded }
      : last.direction === "inbound"
        ? { what: "replied", at: last.dateAdded }
        : { what: last.messageType === "TYPE_CALL" ? "called" : last.messageType === "TYPE_EMAIL" ? "emailed" : "texted", at: last.dateAdded };
  return { outreach, lastOutreach, lastTwoWay, lastWord };
}

/** Which of the three middle columns the conversation puts a card in; null = never reached out this episode */
function conversationStage(c: Conversation, now: Date): "reachedOut" | "noReply" | "inConversation" | null {
  if (!c.lastOutreach) return null;
  if (c.lastTwoWay && daysAgo(c.lastTwoWay, now) < NO_REPLY_DAYS) return "inConversation";
  if (daysAgo(c.lastOutreach, now) < NO_REPLY_DAYS) return "reachedOut";
  return "noReply";
}

async function kiloUsers(): Promise<Map<string, string>> {
  const { locationId } = kiloConfig();
  const r = await kiloRequest<{ users: { id: string; firstName?: string; lastName?: string }[] }>("GET", "users/", { query: { locationId } }).catch(() => ({ users: [] }));
  return new Map(r.users.map((u) => [u.id, [u.firstName, u.lastName].filter(Boolean).join(" ")]));
}

const method = (m: KiloMessage) => (m.messageType === "TYPE_CALL" ? "phone" : m.messageType === "TYPE_EMAIL" ? "email" : "sms");

// ---------------------------------------------------------------------------
// GymMaster

/**
 * Whether a member has a class booked from tomorrow on. The new account is asked per member
 * (its member API answers live); the standard report is cached by GymMaster per exact date range
 * for a long while, so it would keep showing a booking after it was cancelled. The old account
 * (November only) is still read through the report.
 */
function bookedAhead(now: Date) {
  const from = iso(new Date(now.getTime() + 864e5));
  const to = iso(new Date(now.getTime() + BOOKED_AHEAD_DAYS * 864e5));
  const oldAccount = fetchGymMasterReport(9, from, to).then(
    (rows) => new Set(rows.filter((r) => r._account === "old" && r["Booking Result"] === "Booking").map((r) => String(r["Member ID"]))),
  );
  const cache = new Map<string, Promise<boolean>>();
  return async (memberId: string): Promise<boolean> => {
    if ((await oldAccount).has(memberId)) return true;
    if (!newAccountConfig()) return false;
    if (!cache.has(memberId)) {
      cache.set(
        memberId,
        newAccountApi<{ arrival?: string; resultname?: string }[]>(`/api/v3/member/${memberId}/booking`)
          .then((b) => (Array.isArray(b) ? b : []).some((x) => x.resultname === "Booking" && !!x.arrival && x.arrival >= from && x.arrival <= to))
          .catch(() => false),
      );
    }
    return cache.get(memberId)!;
  };
}

/** A forced test member's last attended class, from the new account's member API (live) */
async function lastAttended(memberId: string, now: Date): Promise<string | null> {
  if (!newAccountConfig()) return null;
  const b = await newAccountApi<{ arrival?: string; resultname?: string }[]>(`/api/v3/member/${memberId}/booking`).catch(() => []);
  const today = iso(now);
  const past = (Array.isArray(b) ? b : []).filter((x) => x.arrival && x.arrival <= today && VALID_ATTENDANCE.includes(x.resultname ?? "")).map((x) => x.arrival!);
  return past.sort().pop() ?? null;
}

// ---------------------------------------------------------------------------
// The sync

export async function syncRetentionBoard(opts: SyncOptions): Promise<SyncResult> {
  const now = opts.now ?? new Date();
  const today = iso(now);
  const testMembers = testMembersFromEnv();
  const result: SyncResult = { testMembers, actions: [], unchanged: [], skipped: [], warnings: [] };

  const [computed, pipeline, contacts, fields, users] = await Promise.all([computeAtRisk(now), getRetentionPipeline(), listKiloContacts(), listKiloCustomFields(), kiloUsers()]);
  const ahead = bookedAhead(now);
  if (!computed) throw new Error("No finalized KPI month: no roster");
  if (computed.gymMasterError) result.warnings.push(`GymMaster: ${computed.gymMasterError}`);

  const idField = fields.find((f) => f.name === ID_FIELD);
  if (!idField) throw new Error(`Kilo custom field "${ID_FIELD}" missing: run the member sync first`);
  const contactByMember = new Map<string, KiloContact>();
  for (const c of contacts) {
    const v = c.customFields?.find((f) => f.id === idField.id)?.value;
    if (v) contactByMember.set(String(v), c);
  }
  const cards = await listCards(pipeline.id);
  const cardByContact = new Map(cards.map((c) => [c.contactId, c]));

  // Who to consider: the roster, plus forced test members (treated as on the roster)
  const standing = new Map(computed.standing);
  for (const [memberId, forced] of opts.force ?? []) {
    const name = standing.get(memberId)?.name ?? (await getMemberName(memberId)) ?? `Member ${memberId}`;
    const real = forced === "real" ? await lastAttended(memberId, now) : null;
    const daysGone = forced === "real" ? (real ? daysAgo(real, now) : LOOKBACK_DAYS) : forced;
    standing.set(memberId, { memberId, name, daysGone, lastAttendance: real, monthlyRevenue: standing.get(memberId)?.monthlyRevenue ?? 0, atRisk: daysGone >= AT_RISK_DAYS, excluded: false, pt: false });
  }
  // Cards for members no longer on the roster
  const memberByContact = new Map([...contactByMember].map(([m, c]) => [c.id, m]));
  for (const card of cards) {
    const memberId = memberByContact.get(card.contactId);
    if (memberId && !standing.has(memberId) && card.status === "open") {
      standing.set(memberId, { memberId, name: card.name.split(" · ")[0] ?? memberId, daysGone: 0, lastAttendance: null, monthlyRevenue: 0, atRisk: false, excluded: false, pt: false });
    }
  }

  // Episode starts and outreach already logged, from our own event log
  const memberIds = [...standing.keys()];
  const events = memberIds.length
    ? await db
        .select({ memberId: RetentionEvent.memberId, eventType: RetentionEvent.eventType, eventDate: RetentionEvent.eventDate, notes: RetentionEvent.notes, createdAt: RetentionEvent.createdAt })
        .from(RetentionEvent)
        .where(and(inArray(RetentionEvent.memberId, memberIds), inArray(RetentionEvent.eventType, ["flagged_at_risk", "outreach_sent"])))
        .orderBy(desc(RetentionEvent.createdAt))
    : [];
  const loggedOutreach = new Set(events.filter((e) => e.eventType === "outreach_sent" && e.notes?.startsWith("kilo:")).map((e) => e.notes!.slice(5)));
  const episodeStart = new Map<string, string>();
  for (const e of events) if (e.eventType === "flagged_at_risk" && !episodeStart.has(e.memberId)) episodeStart.set(e.memberId, e.createdAt.toISOString());

  const log = (row: typeof RetentionEvent.$inferInsert) => db.insert(RetentionEvent).values(row);
  const put = (card: Card, body: Record<string, unknown>) => kiloRequest("PUT", `opportunities/${card.id}`, { body });

  for (const m of [...standing.values()].sort((a, b) => b.daysGone - a.daysGone)) {
    const contact = contactByMember.get(m.memberId);
    const card = contact ? cardByContact.get(contact.id) : undefined;
    const onRoster = computed.standing.has(m.memberId) || opts.force?.has(m.memberId);
    const label = `${m.name} (#${m.memberId})`;
    const push = (kind: SyncAction["kind"], detail: string, run: () => Promise<void>) => {
      if (testMembers && !testMembers.has(m.memberId)) return result.skipped.push(`${label}: would ${kind} (${detail}), skipped in test mode`);
      result.actions.push({ memberId: m.memberId, name: m.name, kind, detail, run });
    };

    if (!contact) {
      if (m.atRisk) result.skipped.push(`${label}: at risk but no Kilo contact (run the member sync)`);
      continue;
    }
    const base = { memberId: m.memberId, memberName: m.name, eventDate: today, context: "at_risk", createdBy: "kilo-retention-sync" };

    // Closing: attended, or left
    if (card?.status === "open" && !onRoster) {
      push("lost", "off the roster", async () => {
        await put(card, { status: "lost" });
        await log({ ...base, eventType: "churned", notes: `kilo card ${card.id} closed lost` });
      });
      continue;
    }
    if (card?.status === "open" && !m.atRisk && !m.excluded && !m.pt) {
      push("won", `attended ${m.lastAttendance ?? "recently"} (${m.daysGone}d gone)`, async () => {
        await put(card, { status: "won" });
        await log({ ...base, eventType: "returned", daysGone: m.daysGone, notes: `kilo card ${card.id} closed won` });
      });
      continue;
    }
    if (!m.atRisk) {
      if (card?.status === "open") result.unchanged.push(`${label}: open card left alone (${m.pt ? "PT" : "excluded"})`);
      continue;
    }

    // At risk: make sure there's an open card
    const name = cardName(m.name, m.daysGone);
    const tier = getStatusTier(m.daysGone).label;
    const flagged = { ...base, eventType: "flagged_at_risk" as const, atRiskTier: tier, daysGone: m.daysGone, monthlyRevenue: String(m.monthlyRevenue) };
    if (!card) {
      push("create", `${tier}, ${m.daysGone}d gone, $${m.monthlyRevenue}/mo`, async () => {
        const r = await kiloRequest<{ opportunity: { id: string } }>("POST", "opportunities/", {
          body: { pipelineId: pipeline.id, locationId: kiloConfig().locationId, contactId: contact.id, name, pipelineStageId: pipeline.stages.atRisk, status: "open", monetaryValue: m.monthlyRevenue },
        });
        await log({ ...flagged, notes: `kilo card ${r.opportunity.id} opened` });
      });
      continue;
    }
    if (card.status !== "open") {
      push("reopen", `${tier}, ${m.daysGone}d gone (last card ${card.status})`, async () => {
        await put(card, { status: "open", pipelineStageId: pipeline.stages.atRisk, name, monetaryValue: m.monthlyRevenue });
        await log({ ...flagged, notes: `kilo card ${card.id} reopened` });
      });
      continue;
    }

    // Open card: the column Kilo's log and GymMaster's bookings say, and a current name
    const stage = pipeline.stageKey.get(card.pipelineStageId) ?? "atRisk";
    const since = episodeStart.get(m.memberId) ?? card.lastStatusChangeAt ?? card.createdAt;
    const convo = await readConversation(contact.id, since);
    const newOutreach = convo.outreach.filter((o) => !loggedOutreach.has(o.id));
    const target: StageKey = (await ahead(m.memberId)) ? "booked" : (conversationStage(convo, now) ?? "atRisk");
    const fullName = cardName(m.name, m.daysGone, convo.lastWord ?? undefined, now);

    const changes: string[] = [];
    if (card.name !== fullName) changes.push(`rename "${card.name}" -> "${fullName}"`);
    if (target !== stage) changes.push(`${STAGE_NAMES[stage]} -> ${STAGE_NAMES[target]}`);
    for (const o of newOutreach) changes.push(`log ${method(o)} by ${users.get(o.userId ?? "") ?? "staff"} ${o.dateAdded.slice(0, 10)}`);
    if (!changes.length) {
      result.unchanged.push(`${label}: ${STAGE_NAMES[stage]}, ${m.daysGone}d`);
      continue;
    }
    push(target !== stage ? "move" : "rename", changes.join("; "), async () => {
      const body: Record<string, unknown> = {};
      if (card.name !== fullName) body.name = fullName;
      if (target !== stage) body.pipelineStageId = pipeline.stages[target];
      if (Object.keys(body).length) await put(card, body);
      for (const o of newOutreach) {
        const reached = realCall(o) || (o.messageType === "TYPE_CALL" && o.meta?.call?.status === "completed");
        await log({ ...base, eventType: "outreach_sent", eventDate: o.dateAdded.slice(0, 10), outreachMethod: method(o), outcome: method(o) === "sms" ? "texted" : method(o) === "email" ? "emailed" : reached ? "reached" : "no_answer", atRiskTier: tier, daysGone: m.daysGone, createdBy: users.get(o.userId ?? "") ?? "kilo", notes: `kilo:${o.id}` });
      }
    });
  }

  if (opts.apply) {
    for (const a of result.actions) {
      await a.run();
      await new Promise((r) => setTimeout(r, 150)); // gentle on the API
    }
  }
  return result;
}

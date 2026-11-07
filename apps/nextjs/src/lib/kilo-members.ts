/**
 * Current members into Kilo (Gym Lead Machine), so founders text and call them from the
 * gym's number and the retention board can attach cards to them.
 *
 * Who counts as a current member is fitness_app's call, not GymMaster's: the KPI roster
 * (finalized months + the founders' overrides and billing links) plus members who have
 * paid since the last finalized month (the Retention tab's New members, not yet finalized).
 * Each run: a Kilo contact for every current member, tagged "current members" and carrying
 * their GymMaster number; the tag comes off anyone who dropped off that list. Nothing else
 * on a contact is touched, and contacts are never deleted. Members with no phone in either
 * GymMaster account are listed, not created.
 *
 * Creating a contact fires Kilo's "contact created" lead workflows unless they filter out
 * the "current members" tag, so the nightly run stays off (KILO_MEMBER_SYNC_ENABLED) until
 * those filters exist. Design and history: ai-crew/docs/KILO-INTEGRATION.md.
 */

import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { KpiMemberOverride } from "@acme/db/schema";

import { paymentKind } from "~/app/kpi/lib/plan-categories";
import { getMemberName, getMemberPhone } from "./gymmaster-member";
import { fetchGymMasterReport, gymMasterAmount, parseGymMasterDate } from "./gymmaster-report";
import { firstLast, splitName } from "./gymmaster-standard";
import { kiloConfig, kiloRequest, listKiloContacts, listKiloCustomFields, phoneKey, type KiloContact } from "./kilo";
import { testMembersFromEnv } from "./kilo-retention";
import { getKpiRoster } from "./kpi-roster";

export const MEMBER_TAG = "current members"; // existing Kilo tag, reused
export const ID_FIELD = "GymMaster Member ID";

export interface CurrentMember {
  memberId: string;
  name: string; // "First Last"
  source: "roster" | "new" | "test"; // test: a founder's own record (KILO_RETENTION_TEST_MEMBERS), treated as current
}

export interface MemberSyncAction {
  memberId: string;
  name: string;
  kind: "create" | "tag" | "setId" | "untag";
  run: () => Promise<void>;
}

export interface MemberSyncResult {
  members: CurrentMember[];
  actions: MemberSyncAction[];
  inSync: number;
  noPhone: string[]; // current members with no phone anywhere: not created
  taggedByHand: string[]; // tagged in Kilo without a member number, not on the list: left alone
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Net membership payments per member per KPI category (refunds net out), as on the KPI page */
function netByCategory(payments: Record<string, unknown>[]) {
  const net = { gym: new Map<string, { amount: number; name: string }>(), pt: new Map<string, { amount: number; name: string }>() };
  for (const p of payments) {
    const kind = paymentKind(p);
    const category = kind.kind !== "membership" || !kind.member || kind.bucket === "other" ? null : kind.bucket === "pt" ? "pt" : "gym";
    const memberId = String(p["Member ID"] ?? "");
    if (!category || !memberId) continue;
    const seen = net[category].get(memberId);
    net[category].set(memberId, { amount: (seen?.amount ?? 0) + gymMasterAmount(p["Payment Amount"]), name: seen?.name || firstLast(p["Name"] ?? p["Member Name"]) });
  }
  return net;
}

/**
 * fitness_app's current members: the roster, plus KPI-style new members since the last
 * finalized month (net positive in a category, nothing in it the month before, not excluded).
 */
export async function getCurrentMembers(now = new Date()): Promise<CurrentMember[]> {
  const roster = await getKpiRoster();
  if (!roster) throw new Error("No finalized KPI month: no roster");
  const members = new Map<string, CurrentMember>(roster.members.map((m) => [m.memberId, { memberId: m.memberId, name: firstLast(m.name), source: "roster" }]));

  const pad = (n: number) => String(n).padStart(2, "0");
  const cutoffMonth = roster.month === 12 ? 1 : roster.month + 1;
  const cutoffYear = roster.month === 12 ? roster.year + 1 : roster.year;
  const cutoff = `${cutoffYear}-${pad(cutoffMonth)}-01`;
  const [since, before, overrides] = await Promise.all([
    fetchGymMasterReport(103, cutoff, iso(now)),
    fetchGymMasterReport(103, `${roster.year}-${pad(roster.month)}-01`, iso(new Date(Date.UTC(roster.year, roster.month, 0)))),
    db
      .select({ memberId: KpiMemberOverride.memberId })
      .from(KpiMemberOverride)
      .where(and(eq(KpiMemberOverride.month, cutoffMonth), eq(KpiMemberOverride.year, cutoffYear), eq(KpiMemberOverride.overrideType, "exclude_from_new"))),
  ]);
  const excluded = new Set(overrides.map((o) => o.memberId));
  const sinceNet = netByCategory(since.filter((p) => (parseGymMasterDate(p["Payment Date"]) ?? new Date(0)) >= new Date(cutoff)));
  const beforeNet = netByCategory(before);
  for (const category of ["gym", "pt"] as const) {
    for (const [memberId, { amount, name }] of sinceNet[category]) {
      if (amount <= 0 || (beforeNet[category].get(memberId)?.amount ?? 0) > 0 || excluded.has(memberId) || members.has(memberId)) continue;
      members.set(memberId, { memberId, name, source: "new" });
    }
  }
  for (const memberId of testMembersFromEnv() ?? []) {
    if (!members.has(memberId)) members.set(memberId, { memberId, name: (await getMemberName(memberId)) ?? `Member ${memberId}`, source: "test" });
  }
  return [...members.values()];
}

export async function syncKiloMembers(opts: { apply: boolean; now?: Date }): Promise<MemberSyncResult> {
  const { locationId } = kiloConfig();
  const [members, contacts, fields] = await Promise.all([getCurrentMembers(opts.now), listKiloContacts(), listKiloCustomFields()]);
  let idField = fields.find((f) => f.name === ID_FIELD);
  const idOf = (c: KiloContact) => (idField ? c.customFields?.find((f) => f.id === idField!.id)?.value : undefined);
  const byId = new Map(contacts.filter((c) => idOf(c)).map((c) => [String(idOf(c)), c]));
  const byPhone = new Map(contacts.filter((c) => phoneKey(c.phone)).map((c) => [phoneKey(c.phone)!, c]));
  const phones = new Map(await Promise.all(members.map(async (m) => [m.memberId, await getMemberPhone(m.memberId).catch(() => null)] as const)));

  const result: MemberSyncResult = { members, actions: [], inSync: 0, noPhone: [], taggedByHand: [] };
  const actions = result.actions;
  if (!idField) {
    actions.push({
      memberId: "", name: `custom field "${ID_FIELD}"`, kind: "setId",
      run: async () => {
        const r = await kiloRequest<{ customField: { id: string; name: string } }>("POST", `locations/${locationId}/customFields`, { body: { name: ID_FIELD, dataType: "TEXT", model: "contact" } });
        idField = r.customField;
      },
    });
  }

  for (const m of members) {
    const phone = phoneKey(phones.get(m.memberId));
    const contact = byId.get(m.memberId) ?? (phone ? byPhone.get(phone) : undefined);
    if (contact) {
      const needsTag = !(contact.tags ?? []).includes(MEMBER_TAG);
      const needsId = String(idOf(contact) ?? "") !== m.memberId;
      if (!needsTag && !needsId) result.inSync++;
      if (needsTag) actions.push({ memberId: m.memberId, name: m.name, kind: "tag", run: async () => void (await kiloRequest("POST", `contacts/${contact.id}/tags`, { body: { tags: [MEMBER_TAG] } })) });
      if (needsId)
        actions.push({ memberId: m.memberId, name: m.name, kind: "setId", run: async () => void (await kiloRequest("PUT", `contacts/${contact.id}`, { body: { customFields: [{ id: idField!.id, field_value: m.memberId }] } })) });
    } else if (phone) {
      actions.push({
        memberId: m.memberId, name: m.name, kind: "create",
        run: async () =>
          void (await kiloRequest("POST", "contacts/upsert", {
            body: { locationId, firstName: splitName(m.name).first, lastName: splitName(m.name).last, phone: `+1${phone}`, tags: [MEMBER_TAG], source: "Elev8 dashboard sync", customFields: [{ id: idField!.id, field_value: m.memberId }] },
          })),
      });
    } else {
      result.noPhone.push(`${m.name} (#${m.memberId})`);
    }
  }

  // Tagged in Kilo but no longer a current member: the tag comes off contacts the sync manages
  // (they carry a member number); anyone tagged by hand is reported and left alone
  const current = new Set(members.map((m) => m.memberId));
  for (const c of contacts) {
    if (!(c.tags ?? []).includes(MEMBER_TAG)) continue;
    const memberId = String(idOf(c) ?? "");
    if (!memberId) {
      result.taggedByHand.push([c.firstName, c.lastName].filter(Boolean).join(" ") || c.id);
      continue;
    }
    if (!current.has(memberId))
      actions.push({ memberId, name: [c.firstName, c.lastName].filter(Boolean).join(" "), kind: "untag", run: async () => void (await kiloRequest("DELETE", `contacts/${c.id}/tags`, { body: { tags: [MEMBER_TAG] } })) });
  }

  if (opts.apply) {
    for (const a of actions) {
      await a.run();
      await new Promise((r) => setTimeout(r, 150)); // gentle on the API
    }
  }
  return result;
}

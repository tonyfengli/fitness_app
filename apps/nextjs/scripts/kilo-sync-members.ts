/**
 * Sync the dashboard's current members into Kilo (Gym Lead Machine).
 *
 * Members = the KPI roster (the Overview's member total, after the founders' adjustments).
 * Each member is matched to a Kilo contact by the "GymMaster Member ID" custom field, then
 * by phone (last 10 digits). Matched contacts get the "current members" tag and the
 * member ID; members not in Kilo are created with both. Nothing else is changed, and
 * contacts are never deleted. Members without a phone in GymMaster (new account, else the archived old record) are listed, not created.
 *
 * Dry run by default (prints the plan, writes nothing). Apply with --apply.
 *   npx tsx --tsconfig tsconfig.json scripts/kilo-sync-members.ts [--apply]
 */

import { getMemberPhone } from "~/lib/gymmaster-member";
import { splitName } from "~/lib/gymmaster-standard";
import { getKpiRoster } from "~/lib/kpi-roster";
import { kiloConfig, kiloRequest, listKiloContacts, listKiloCustomFields, phoneKey } from "~/lib/kilo";

const MEMBER_TAG = "current members"; // existing Kilo tag, reused
const ID_FIELD = "GymMaster Member ID";
const APPLY = process.argv.includes("--apply");

async function main() {
  const { locationId } = kiloConfig();
  const roster = await getKpiRoster();
  if (!roster) throw new Error("No finalized KPI months: no roster");
  // New-account phone, else the archived old record's
  const cell = new Map(await Promise.all(roster.members.map(async (m) => [m.memberId, await getMemberPhone(m.memberId)] as const)));

  const contacts = await listKiloContacts();
  const fields = await listKiloCustomFields();
  let idField = fields.find((f) => f.name === ID_FIELD);
  const idOf = (c: (typeof contacts)[number]) => (idField ? c.customFields?.find((f) => f.id === idField!.id)?.value : undefined);
  const byId = new Map(contacts.filter((c) => idOf(c)).map((c) => [String(idOf(c)), c]));
  const byPhone = new Map(contacts.filter((c) => phoneKey(c.phone)).map((c) => [phoneKey(c.phone)!, c]));

  const plan = { tag: [] as string[], setId: [] as string[], create: [] as string[], noPhone: [] as string[], ok: [] as string[] };
  const actions: (() => Promise<void>)[] = [];

  if (!idField) {
    console.log(`Will create custom field "${ID_FIELD}" (text, on contacts)`);
    actions.push(async () => {
      const r = await kiloRequest<{ customField: { id: string; name: string } }>("POST", `locations/${locationId}/customFields`, {
        body: { name: ID_FIELD, dataType: "TEXT", model: "contact" },
      });
      idField = r.customField;
    });
  }

  for (const m of roster.members) {
    const phone = phoneKey(cell.get(m.memberId));
    const contact = byId.get(m.memberId) ?? (phone ? byPhone.get(phone) : undefined);
    const label = `${m.name} (#${m.memberId})`;
    if (contact) {
      const needsTag = !(contact.tags ?? []).includes(MEMBER_TAG);
      const needsId = String(idOf(contact) ?? "") !== m.memberId;
      if (needsTag) plan.tag.push(label);
      if (needsId) plan.setId.push(label);
      if (!needsTag && !needsId) plan.ok.push(label);
      if (needsTag) actions.push(async () => void (await kiloRequest("POST", `contacts/${contact.id}/tags`, { body: { tags: [MEMBER_TAG] } })));
      if (needsId)
        actions.push(async () =>
          void (await kiloRequest("PUT", `contacts/${contact.id}`, { body: { customFields: [{ id: idField!.id, field_value: m.memberId }] } }))
        );
    } else if (phone) {
      plan.create.push(label);
      actions.push(async () =>
        void (await kiloRequest("POST", "contacts/upsert", {
          body: {
            locationId,
            firstName: splitName(m.name).first,
            lastName: splitName(m.name).last,
            phone: `+1${phone}`,
            tags: [MEMBER_TAG],
            source: "Elev8 dashboard sync",
            customFields: [{ id: idField!.id, field_value: m.memberId }],
          },
        }))
      );
    } else {
      plan.noPhone.push(label);
    }
  }

  // Tagged as current members in Kilo but not on the roster (report only)
  const rosterIds = new Set(roster.members.map((m) => m.memberId));
  const rosterPhones = new Set(roster.members.map((m) => phoneKey(cell.get(m.memberId))).filter(Boolean));
  const stale = contacts.filter(
    (c) => (c.tags ?? []).includes(MEMBER_TAG) && !rosterIds.has(String(idOf(c) ?? "")) && !rosterPhones.has(phoneKey(c.phone))
  );

  console.log(`Roster: ${roster.members.length} members | Kilo: ${contacts.length} contacts`);
  console.log(`Already in sync: ${plan.ok.length}`);
  console.log(`Add tag "${MEMBER_TAG}": ${plan.tag.length}\n  ${plan.tag.join("\n  ")}`);
  console.log(`Set ${ID_FIELD}: ${plan.setId.length}`);
  console.log(`Create in Kilo: ${plan.create.length}\n  ${plan.create.join("\n  ")}`);
  console.log(`Skipped, no phone in GymMaster: ${plan.noPhone.length}\n  ${plan.noPhone.join("\n  ")}`);
  console.log(`Tagged "${MEMBER_TAG}" in Kilo but not a current member (left alone): ${stale.length}`);

  if (!APPLY) {
    console.log("\nDry run: nothing written. Re-run with --apply to make these changes.");
    return;
  }
  let done = 0;
  for (const a of actions) {
    await a();
    done++;
    await new Promise((r) => setTimeout(r, 150)); // gentle on the API
  }
  console.log(`\nApplied ${done} changes.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

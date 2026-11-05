/**
 * Match old GymMaster members (from the archive) to the new account's Anaheim records
 * (company 5) and save the result in gymmaster_member_match.
 *
 * Phone (last 10 digits) and email, then name + birthday. The strongest unique candidate
 * wins (phone and email beats either alone); ties are listed for the founders, never
 * guessed. Founders' decisions go in FOUNDERS below as old ID -> new ID.
 *
 * Reads only from GymMaster. Dry run by default (prints the plan); save with --apply.
 *   npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/match-gymmaster-members.ts [--apply]
 */

import { db } from "@acme/db/client";
import { GymMasterArchiveMember, GymMasterMemberMatch } from "@acme/db/schema";

const APPLY = process.argv.includes("--apply");
const COMPANY = "5"; // Anaheim in the new account

/** Old member ID -> new member ID, decided by the founders */
const FOUNDERS: Record<string, string> = {
  "323888": "32539", // prepaid PT client; new record has no phone or email (confirmed 2026-11-05)
};

type Profile = Record<string, unknown>;

async function newApi<T>(path: string): Promise<T | null> {
  const baseUrl = process.env.GYMMASTER_NEW_BASE_URL?.replace(/\/+$/, "");
  const apiKey = process.env.GYMMASTER_NEW_STAFF_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Missing new GymMaster configuration");
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(`${baseUrl}${path}`, { headers: { Accept: "application/json", "X-GM-API-KEY": apiKey } });
    if (response.status === 429) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    if (!response.ok) return null;
    return (await response.json()) as T;
  }
  return null;
}

const phoneKey = (v: unknown) => String(v ?? "").replace(/\D/g, "").slice(-10) || null;
const emailKey = (v: unknown) => (typeof v === "string" && v.includes("@") ? v.trim().toLowerCase() : null);
const nameKey = (first: unknown, last: unknown) =>
  `${String(first ?? "")} ${String(last ?? "")}`.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim() || null;
const dobKey = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const phonesOf = (p: Profile) => [p.phonecell, p.phonehome, p.phonework].map(phoneKey).filter((x): x is string => !!x);

async function newAnaheimProfiles() {
  const ids = new Set<string>();
  for (let page = 1; page < 50; page++) {
    const raw = await newApi<unknown>(`/api/v3/member?companyid=${COMPANY}&page=${page}`);
    const rows = (Array.isArray(raw) ? raw : ((raw as { result?: unknown[] } | null)?.result ?? [])) as Profile[];
    const before = ids.size;
    for (const r of rows) if (String(r.companyid) === COMPANY) ids.add(String(r.id));
    if (ids.size === before) break;
  }
  const profiles: Profile[] = [];
  for (const id of ids) {
    const raw = await newApi<Profile | Profile[]>(`/api/v3/member/${id}`);
    const p = Array.isArray(raw) ? raw[0] : raw;
    if (p && String(p.companyid) === COMPANY) profiles.push(p);
  }
  return profiles;
}

async function main() {
  const old = await db.select().from(GymMasterArchiveMember);
  const fresh = await newAnaheimProfiles();
  console.log(`Old members (archive): ${old.length} | new Anaheim records: ${fresh.length}`);

  const results: Array<{ oldId: string; newId: string; matchedBy: string }> = [];
  const ties: string[] = [];
  const unmatchedOld: string[] = [];

  for (const o of old) {
    const op = (o.profile ?? {}) as Profile;
    if (FOUNDERS[o.memberId]) {
      results.push({ oldId: o.memberId, newId: FOUNDERS[o.memberId]!, matchedBy: "founders" });
      continue;
    }
    const oPhones = phonesOf(op);
    const oEmail = emailKey(op.email);
    const scored = fresh
      .map((n) => {
        const phone = phonesOf(n).some((x) => oPhones.includes(x));
        const email = !!oEmail && emailKey(n.email) === oEmail;
        const nameDob =
          !!nameKey(op.firstname, op.surname) &&
          nameKey(op.firstname, op.surname) === nameKey(n.firstname, n.surname) &&
          !!dobKey(op.dob) &&
          dobKey(op.dob) === dobKey(n.dob);
        const score = (phone ? 2 : 0) + (email ? 2 : 0) + (!phone && !email && nameDob ? 1 : 0);
        const matchedBy = phone && email ? "phone+email" : phone ? "phone" : email ? "email" : "name+birthday";
        return { id: String(n.id), score, matchedBy };
      })
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score);
    if (!scored.length) unmatchedOld.push(o.memberId);
    else if (scored.length > 1 && scored[1]!.score === scored[0]!.score)
      ties.push(`${o.memberId}: ${scored.filter((c) => c.score === scored[0]!.score).map((c) => `${c.id} (${c.matchedBy})`).join(" or ")}`);
    else results.push({ oldId: o.memberId, newId: scored[0]!.id, matchedBy: scored[0]!.matchedBy });
  }

  // A new record claimed by two old members is a tie too
  const claims = new Map<string, string[]>();
  for (const r of results) claims.set(r.newId, [...(claims.get(r.newId) ?? []), r.oldId]);
  const doubled = new Set([...claims].filter(([, olds]) => olds.length > 1).flatMap(([, olds]) => olds));
  for (const [newId, olds] of claims) if (olds.length > 1) ties.push(`${newId} claimed by ${olds.join(" and ")}`);
  const final = results.filter((r) => !doubled.has(r.oldId) || r.matchedBy === "founders");

  const by = new Map<string, number>();
  for (const r of final) by.set(r.matchedBy, (by.get(r.matchedBy) ?? 0) + 1);
  const matchedNew = new Set(final.map((r) => r.newId));
  console.log(`Matched: ${final.length} (${[...by].map(([k, v]) => `${k} ${v}`).join(", ")})`);
  console.log(`Ties for the founders (${ties.length}):\n  ${ties.join("\n  ")}`);
  console.log(`Old members with no new record: ${unmatchedOld.length}`);
  console.log(`New records with no old member: ${fresh.filter((n) => !matchedNew.has(String(n.id))).map((n) => n.id).join(", ")}`);
  console.log(`MATCHES ${JSON.stringify(final)}`);

  if (!APPLY) return console.log("Dry run: nothing saved. Re-run with --apply.");
  await db.transaction(async (tx) => {
    await tx.delete(GymMasterMemberMatch);
    if (final.length) await tx.insert(GymMasterMemberMatch).values(final.map((r) => ({ oldMemberId: r.oldId, newMemberId: r.newId, matchedBy: r.matchedBy })));
  });
  console.log(`Saved ${final.length} matches`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);

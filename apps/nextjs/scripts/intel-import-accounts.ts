/**
 * Loads the intel tracking list (intel_account) from a CSV. Re-runnable: a row is matched by
 * its `key`, so a second run updates and adds nothing twice. An account that has left the CSV
 * is switched off, never deleted, because its history hangs off it.
 * Dry run by default; write with --apply.
 *   npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/intel-import-accounts.ts [file.csv] [--apply]
 * CSV columns: key, kind (own | franchisor | inspiration | competitor), name, instagram,
 * facebook_page, google_place, website_pages (separate several with a space), note.
 * Default file: scripts/intel-accounts.csv. Docs: ai-crew/docs/INTEL-COLLECTION.md.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { and, eq, notInArray } from "@acme/db";
import { db } from "@acme/db/client";
import { IntelAccount } from "@acme/db/schema";

import { getGymBusinessId } from "~/lib/business";
import { handleOf } from "~/lib/intel/instagram";

const APPLY = process.argv.includes("--apply");
const FILE = resolve(process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "scripts/intel-accounts.csv");
const KINDS = ["own", "franchisor", "inspiration", "competitor"] as const;
type Kind = (typeof KINDS)[number];

/** A small CSV reader: commas, quoted fields with "" for a quote, one record per line */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const cells = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i]!;
      if (quoted) {
        if (c === '"' && line[i + 1] === '"') (cur += '"'), i++;
        else if (c === '"') quoted = false;
        else cur += c;
      } else if (c === '"') quoted = true;
      else if (c === ",") out.push(cur), (cur = "");
      else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const header = cells(lines[0] ?? "");
  return lines.slice(1).map((l) => Object.fromEntries(cells(l).map((v, i) => [header[i] ?? `col${i}`, v])));
}

async function main() {
  const businessId = await getGymBusinessId();
  const problems: string[] = [];
  const seen = new Set<string>();
  const rows = parseCsv(readFileSync(FILE, "utf8")).map((r, i) => {
    const line = i + 2;
    const key = (r.key ?? "").toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(key)) problems.push(`line ${line}: key "${r.key}" must be lowercase letters, digits and dashes`);
    if (seen.has(key)) problems.push(`line ${line}: key "${key}" appears twice`);
    seen.add(key);
    if (!KINDS.includes(r.kind as Kind)) problems.push(`line ${line}: kind "${r.kind}" must be one of ${KINDS.join(", ")}`);
    if (!r.name) problems.push(`line ${line}: name is empty`);
    const instagramHandle = r.instagram ? handleOf(r.instagram) : null;
    if (r.instagram && !instagramHandle) problems.push(`line ${line}: instagram "${r.instagram}" is not a handle`);
    return {
      businessId,
      key,
      kind: r.kind as Kind,
      name: r.name ?? "",
      instagramHandle,
      facebookPage: r.facebook_page || null,
      googlePlace: r.google_place || null,
      websitePages: (r.website_pages ?? "").split(/\s+/).filter(Boolean),
      note: r.note || null,
      active: true,
    };
  });
  if (problems.length) {
    console.error(`Not imported, fix the CSV first:\n  - ${problems.join("\n  - ")}`);
    process.exit(1);
  }

  const existing = await db.select().from(IntelAccount).where(eq(IntelAccount.businessId, businessId));
  const byKey = new Map(existing.map((e) => [e.key, e]));
  const same = (e: (typeof existing)[number], r: (typeof rows)[number]) =>
    e.kind === r.kind && e.name === r.name && e.instagramHandle === r.instagramHandle && e.facebookPage === r.facebookPage && e.googlePlace === r.googlePlace && e.note === r.note && e.active && e.websitePages.join(" ") === r.websitePages.join(" ");
  const added = rows.filter((r) => !byKey.has(r.key));
  const changed = rows.filter((r) => byKey.has(r.key) && !same(byKey.get(r.key)!, r));
  const leaving = existing.filter((e) => e.active && !seen.has(e.key));

  console.log(`${FILE}: ${rows.length} accounts (${rows.filter((r) => r.instagramHandle).length} with Instagram)`);
  console.log(`  new: ${added.length}${added.length ? ` (${added.map((r) => r.key).join(", ")})` : ""}`);
  console.log(`  changed: ${changed.length}${changed.length ? ` (${changed.map((r) => r.key).join(", ")})` : ""}`);
  console.log(`  unchanged: ${rows.length - added.length - changed.length}`);
  console.log(`  switched off (no longer in the CSV): ${leaving.length}${leaving.length ? ` (${leaving.map((e) => e.key).join(", ")})` : ""}`);
  if (!APPLY) {
    console.log("Dry run: nothing written. Add --apply to write.");
    return;
  }

  for (const r of [...added, ...changed]) {
    const { businessId: _b, key: _k, ...set } = r;
    await db.insert(IntelAccount).values(r).onConflictDoUpdate({ target: [IntelAccount.businessId, IntelAccount.key], set });
  }
  if (leaving.length) {
    await db
      .update(IntelAccount)
      .set({ active: false })
      .where(and(eq(IntelAccount.businessId, businessId), notInArray(IntelAccount.key, [...seen])));
  }
  console.log("Written.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

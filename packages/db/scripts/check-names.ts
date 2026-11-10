/**
 * Table naming check (rules in packages/db/NAMING.md).
 *
 * Every table in the schema must either be on the legacy list below (the tables that existed
 * on 2026-11-10, left as they are) or follow the convention:
 *   - name is <area>_<thing> (or just <area>), singular, snake_case
 *   - <area> is one of AREAS (add a new area here and in NAMING.md)
 *   - the export is the table name in PascalCase (team_task_event -> TeamTaskEvent)
 *
 * Runs before `pnpm db:push`, so a misnamed table never reaches the database.
 * Run alone: pnpm db:check-names
 */
import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";

import * as schema from "../src/schema";

/** Registered areas. Keep in sync with the table in NAMING.md. */
const AREAS = ["team", "celebration", "kpi", "gymmaster", "retention"];

/** Tables that existed before the convention (2026-11-10). Never add to this list. */
const LEGACY = new Set([
  "account",
  "business",
  "business_exercise",
  "conversation_state",
  "exercise_performance_log",
  "exercises",
  "favorite_sessions",
  "gymmaster_archive_member",
  "gymmaster_archive_pull",
  "gymmaster_archive_row",
  "gymmaster_member_match",
  "kpi_billing_link",
  "kpi_member_override",
  "kpi_monthly_snapshot",
  "messages",
  "music_tracks",
  "oauth_tokens",
  "pnl_monthly_snapshot",
  "quickbooks_connection",
  "retention_event",
  "session",
  "spotify_tracks",
  "training_package",
  "training_session",
  "user",
  "user_exercise_ratings",
  "user_profile",
  "user_training_package",
  "user_training_session",
  "verification",
  "workout",
  "workout_exercise",
  "workout_exercise_swaps",
  "workout_preferences",
]);

const pascal = (name: string) =>
  name
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

// A last word ending in "s" reads as plural; "ss"/"us"/"is" endings (class, status, analysis) are fine.
const looksPlural = (word: string) => /s$/.test(word) && !/(ss|us|is)$/.test(word);

// table name -> export names that point at it
const exportsByTable = new Map<string, string[]>();
for (const [exportName, value] of Object.entries(schema)) {
  if (!is(value, PgTable)) continue;
  const { name } = getTableConfig(value);
  exportsByTable.set(name, [...(exportsByTable.get(name) ?? []), exportName]);
}

const problems: string[] = [];
for (const [table, exportNames] of [...exportsByTable].sort()) {
  if (LEGACY.has(table)) continue;
  const parts = table.split("_");
  const area = parts[0] ?? "";
  if (!/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(table)) {
    problems.push(`${table}: use lowercase snake_case`);
  }
  if (!AREAS.includes(area)) {
    problems.push(
      `${table}: starts with "${area}", which is not a registered area (${AREAS.join(", ")}). ` +
        `Use an area prefix, or register a new area in NAMING.md and scripts/check-names.ts`,
    );
  }
  const last = parts[parts.length - 1] ?? "";
  if (looksPlural(last)) {
    problems.push(`${table}: "${last}" looks plural; table names are singular`);
  }
  const expected = pascal(table);
  if (!exportNames.includes(expected)) {
    problems.push(`${table}: export it as ${expected} (found ${exportNames.join(", ")})`);
  }
}

if (problems.length) {
  console.error(`Table naming check failed (see packages/db/NAMING.md):\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}
console.log(`Table naming check passed: ${exportsByTable.size} tables (${LEGACY.size} legacy).`);

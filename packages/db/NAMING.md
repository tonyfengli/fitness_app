# Database naming

Rules for **new** tables (from 2026-11-10). The 34 tables that existed before are a mix of
styles and stay as they are: renaming means `db:push` dropping and recreating them, which
risks data for no gain. They are listed as legacy in `scripts/check-names.ts`.

`pnpm db:push` runs `pnpm db:check-names` first, so a table that breaks these rules never
reaches the database.

## The rules

1. **Area first:** `<area>_<thing>`, singular, snake_case. The area's root table can be the
   area alone (`celebration`).
2. **The export is the table name in PascalCase:** `team_task_event` → `TeamTaskEvent`.
3. **One file per area:** `src/schema/<area>.ts`, re-exported from `src/schema.ts`
   (`export * from "./schema/<area>"`). drizzle-kit reads only `src/schema.ts`, so a file that
   isn't re-exported is never pushed.
4. **A comment above every table:** what it holds, who writes it, which doc explains it.
5. **Every table gets `businessId`** (references `business.id`), like the rest of the schema.

## Areas

| Area | What it covers | Doc |
|---|---|---|
| `team` | Staff accountability: tasks, their history, nudges, workflows, messaging settings | ai-crew/docs/BUSINESS-ACCOUNTABILITY.md |
| `celebration` | Member recognition: birthdays, milestones, later PRs | (planned) |
| `kpi` | KPI dashboard snapshots, overrides, billing links | |
| `gymmaster` | GymMaster data: archive pulls, member matching across accounts | ai-crew/docs/GYMMASTER-MIGRATION.md |
| `retention` | Retention events and outreach | ai-crew/docs/KILO-INTEGRATION.md |

A new area needs a row here **and** an entry in `AREAS` in `scripts/check-names.ts`. Until
both exist, the check fails, which is the point: say what the area is before using it.

## Suffixes

| Suffix | Meaning | Example |
|---|---|---|
| `_event` | Append-only history; rows are never edited | `retention_event`, `team_task_event` |
| `_snapshot` | A frozen copy as of a date | `kpi_monthly_snapshot` |
| `_profile` | One-to-one extra details for a `user` | `team_profile` |
| `_match` / `_link` | Connects records across systems | `gymmaster_member_match` |
| `<a>_<b>` | Many-to-many join between two tables | `team_nudge_task` |

## Words that collide

| Word | Means | Not |
|---|---|---|
| **user** | Any login (`user.role` is `client` or `trainer`) | Not only staff |
| **trainer** | A staff login (`user.role = 'trainer'`) | |
| **founder** | One of the five owners (`apps/nextjs/src/lib/founders.ts`). Every founder is a trainer, not every trainer is a founder | |
| **member** | A GymMaster paying member, identified by a GymMaster member id | Not a login |
| **client** | A login with `role = 'client'` (the app's workout users) | |
| **business** | The gym itself, the tenant every row belongs to | Not "business side" |
| **task** | A team commitment (`team_task`) | Not Tony's personal tasks, which live in Notion |
| `user_profile` (legacy) | A client's fitness settings | Not a staff profile (that's `team_profile`) |

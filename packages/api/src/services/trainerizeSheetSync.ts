import { google } from "googleapis";

import { sql } from "@acme/db";
import { db } from "@acme/db/client";
import { TrainerizeEvent, user } from "@acme/db/schema";

const HABITS_TAB = "habits";
const NUTRITION_TAB = "nutrition";

/**
 * Authenticated Google Sheets client using a service-account JSON key.
 * The private key arrives in the env var with escaped `\n` line breaks
 * (because env files can't carry real newlines reliably) — we unescape here.
 */
function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!clientEmail || !rawPrivateKey) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY env vars",
    );
  }
  const privateKey = rawPrivateKey.replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

interface RawHabitRow {
  email: string;
  date: string; // YYYY-MM-DD
  habitName: string;
  habitType: string;
  userId: string; // trainerize user id
  currentStreak: number | null;
  longestStreak: number | null;
  dailyHabitId: string;
  habitId: string;
}

interface RawNutritionRow {
  email: string;
  date: string;
  userId: string; // trainerize user id
}

/**
 * Reads both `habits` and `nutrition` tabs from the configured Google Sheet.
 * Header row is auto-skipped — we use the documented column order from the Zap
 * config rather than column-name lookups, since header text could drift.
 */
async function readSheetRows(): Promise<{
  habits: RawHabitRow[];
  nutrition: RawNutritionRow[];
}> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("Missing GOOGLE_SHEETS_SPREADSHEET_ID env var");
  }
  const sheets = getSheetsClient();

  const [habitsResp, nutritionResp] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${HABITS_TAB}!A2:I`,
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${NUTRITION_TAB}!A2:C`,
    }),
  ]);

  const habitsRows = habitsResp.data.values ?? [];
  const nutritionRows = nutritionResp.data.values ?? [];

  // Habits columns (per the user's sheet):
  //   A: Email | B: Date | C: Habit Name | D: Habit Type
  //   E: User ID | F: Current Streak | G: Longest Streak
  //   H: Daily Habit ID | I: Habit ID
  const habits: RawHabitRow[] = habitsRows
    .filter((row) => row[0] && row[1] && row[4]) // need email, date, userId
    .map((row) => ({
      email: String(row[0]).trim(),
      date: String(row[1]).trim(),
      habitName: String(row[2] ?? "").trim(),
      habitType: String(row[3] ?? "").trim(),
      userId: String(row[4]).trim(),
      currentStreak: row[5] !== undefined && row[5] !== "" ? Number(row[5]) : null,
      longestStreak: row[6] !== undefined && row[6] !== "" ? Number(row[6]) : null,
      dailyHabitId: String(row[7] ?? "").trim(),
      habitId: String(row[8] ?? "").trim(),
    }))
    .filter((row) => row.dailyHabitId); // dedup key requires this

  // Nutrition columns:
  //   A: Email | B: Date | C: User ID
  const nutrition: RawNutritionRow[] = nutritionRows
    .filter((row) => row[0] && row[1] && row[2])
    .map((row) => ({
      email: String(row[0]).trim(),
      date: String(row[1]).trim(),
      userId: String(row[2]).trim(),
    }));

  return { habits, nutrition };
}

export interface SyncResult {
  habitsRead: number;
  nutritionRead: number;
  inserted: number; // new events written
  skipped: number; // already present (duplicate external_event_key)
  linked: number; // pre-existing orphans now linked to a user_id via backfill
}

/**
 * Pulls both tabs from the Google Sheet, upserts each row into
 * trainerize_event keyed by external_event_key. Returns counts for visibility.
 *
 * The function also runs a retroactive backfill: any pre-existing event rows
 * whose trainerize_user_id now matches a user.trainerize_user_id are linked.
 */
export async function syncTrainerizeEventsFromSheet(): Promise<SyncResult> {
  const { habits, nutrition } = await readSheetRows();

  // Build the user-id lookup map (trainerize_user_id -> our user.id)
  const linkedUsers = await db
    .select({ id: user.id, trainerizeUserId: user.trainerizeUserId })
    .from(user)
    .where(sql`${user.trainerizeUserId} IS NOT NULL`);
  const linkMap = new Map<string, string>();
  for (const u of linkedUsers) {
    if (u.trainerizeUserId) linkMap.set(u.trainerizeUserId, u.id);
  }

  type EventInsert = typeof TrainerizeEvent.$inferInsert;
  const rowsToUpsert: EventInsert[] = [];

  for (const h of habits) {
    rowsToUpsert.push({
      userId: linkMap.get(h.userId) ?? null,
      trainerizeUserId: h.userId,
      email: h.email,
      eventType: "habit",
      eventDate: h.date,
      habitName: h.habitName || null,
      habitType: h.habitType || null,
      currentStreak: h.currentStreak,
      longestStreak: h.longestStreak,
      dailyHabitId: h.dailyHabitId,
      habitId: h.habitId || null,
      externalEventKey: `habit:${h.dailyHabitId}`,
    });
  }

  for (const n of nutrition) {
    rowsToUpsert.push({
      userId: linkMap.get(n.userId) ?? null,
      trainerizeUserId: n.userId,
      email: n.email,
      eventType: "nutrition",
      eventDate: n.date,
      externalEventKey: `nutrition:${n.userId}:${n.date}`,
    });
  }

  let inserted = 0;
  let skipped = 0;
  if (rowsToUpsert.length > 0) {
    const result = await db
      .insert(TrainerizeEvent)
      .values(rowsToUpsert)
      .onConflictDoNothing({ target: TrainerizeEvent.externalEventKey })
      .returning({ id: TrainerizeEvent.id });
    inserted = result.length;
    skipped = rowsToUpsert.length - inserted;
  }

  // Retroactive backfill — orphan events (user_id IS NULL) whose
  // trainerize_user_id now matches a linked user get their user_id set.
  let linkedBackfilled = 0;
  if (linkedUsers.length > 0) {
    const backfilled = await db.execute(sql`
      UPDATE trainerize_event te
      SET user_id = u.id
      FROM "user" u
      WHERE te.user_id IS NULL
        AND te.trainerize_user_id = u.trainerize_user_id
        AND u.trainerize_user_id IS NOT NULL
      RETURNING te.id
    `);
    linkedBackfilled = Array.isArray(backfilled)
      ? backfilled.length
      : (backfilled as { rowCount?: number }).rowCount ?? 0;
  }

  return {
    habitsRead: habits.length,
    nutritionRead: nutrition.length,
    inserted,
    skipped,
    linked: linkedBackfilled,
  };
}

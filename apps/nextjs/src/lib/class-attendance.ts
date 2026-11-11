/**
 * Class attendance by slot (class type × weekday × start time) for a date range and
 * the previous period of the same length. Attendance follows the Retention rule:
 * Booking, Showed and Showed late count; no-shows and cancellations don't. A session
 * is any class occurrence with at least one booking. Classes only (Open Gym is left
 * out). Booking data before Aug 1, 2026 is unreliable, so earlier comparisons are omitted.
 */

import { fetchGymMasterReport } from "./gymmaster-report";

export const DATA_START = "2026-08-01";
export const VALID_ATTENDANCE = ["Booking", "Showed", "Showed late"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type ReportRow = Record<string, string | number | null>;

interface PeriodStats {
  sessions: number;
  visits: number;
  avg: number; // visits per session
}

export interface ClassSlot {
  classType: string; // "Strength Training", "METCON", ...
  weekday: number; // 0 = Sun
  weekdayLabel: string;
  time: string; // "5 am"
  timeSort: number; // seconds after midnight
  current: PeriodStats;
  previous: PeriodStats | null; // null when the previous period starts before reliable data
  sessionList: { date: string; attended: number }[]; // each session in the range, oldest first
}

export const iso = (d: Date) => d.toISOString().slice(0, 10);

function parseGymMasterDate(s: unknown): string {
  const d = new Date(String(s ?? ""));
  return isNaN(d.getTime()) ? "" : iso(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
}

// "5:00:00 pm" → "5 pm", "8:30:00 am" → "8:30 am"
function timeLabel(raw: string): string {
  const m = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)$/i);
  if (!m) return raw;
  return `${Number(m[1])}${m[2] === "00" ? "" : `:${m[2]}`} ${m[3]!.toLowerCase()}`;
}

export const addDays = (date: string, days: number) => {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
};
const dayCount = (start: string, end: string) => Math.round((Date.parse(end) - Date.parse(start)) / 864e5) + 1;

const fetchBookings = (startDate: string, endDate: string) => fetchGymMasterReport(9, startDate, endDate) as unknown as Promise<ReportRow[]>;

export interface ClassAttendance {
  range: { start: string; end: string; days: number };
  previousRange: { start: string; end: string } | null;
  slots: ClassSlot[];
}

export async function getClassAttendance(start: string, end: string): Promise<ClassAttendance> {
  // Previous period of the same length, right before the range
  const length = dayCount(start, end);
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(length - 1));
  const hasPrevious = prevStart >= DATA_START;

  const bookings = await fetchBookings(hasPrevious ? prevStart : start, end);

  // Session = class type + date + start time; count bookings that attended
  type Session = { classType: string; date: string; rawTime: string; timeSort: number; attended: number };
  const sessions = new Map<string, Session>();
  for (const b of bookings) {
    // The new account's bookings report has no class name: a class attendant booking counts under its resource
    const classType = String(b["Class Name"] ?? (b["Service"] === "Class Attendant" ? (b["Resource Name"] ?? "Class") : "")).trim();
    if (!classType || classType.includes("(Historic)")) continue; // Open Gym, non-class and retired classes
    const date = parseGymMasterDate(b["Booking Date"]);
    const rawTime = String(b["Booking Start Time"] ?? "");
    if (!date || !rawTime) continue;
    const key = `${classType}|${date}|${rawTime}`;
    const s = sessions.get(key) ?? { classType, date, rawTime, timeSort: Number(b["sorted_Booking Start Time"] ?? 0), attended: 0 };
    if (VALID_ATTENDANCE.includes(String(b["Booking Result"] ?? ""))) s.attended++;
    sessions.set(key, s);
  }

  // Roll sessions up into slots, per period
  const slots = new Map<
    string,
    { slot: Omit<ClassSlot, "current" | "previous" | "sessionList">; cur: number[]; prev: number[]; list: { date: string; attended: number }[] }
  >();
  for (const s of sessions.values()) {
    const inCurrent = s.date >= start && s.date <= end;
    const inPrevious = hasPrevious && s.date >= prevStart && s.date <= prevEnd;
    if (!inCurrent && !inPrevious) continue;
    const weekday = new Date(s.date + "T12:00:00Z").getUTCDay();
    const time = timeLabel(s.rawTime);
    const key = `${s.classType}|${weekday}|${time}`;
    const entry = slots.get(key) ?? {
      slot: { classType: s.classType, weekday, weekdayLabel: WEEKDAYS[weekday]!, time, timeSort: s.timeSort },
      cur: [],
      prev: [],
      list: [],
    };
    (inCurrent ? entry.cur : entry.prev).push(s.attended);
    if (inCurrent) entry.list.push({ date: s.date, attended: s.attended });
    slots.set(key, entry);
  }

  const stats = (list: number[]): PeriodStats => {
    const visits = list.reduce((t, n) => t + n, 0);
    return { sessions: list.length, visits, avg: list.length ? Math.round((visits / list.length) * 10) / 10 : 0 };
  };
  const result: ClassSlot[] = [...slots.values()]
    .filter((e) => e.cur.length > 0)
    .map((e) => ({
      ...e.slot,
      current: stats(e.cur),
      previous: hasPrevious && e.prev.length ? stats(e.prev) : null,
      sessionList: e.list.sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .sort((a, b) => a.timeSort - b.timeSort || a.weekday - b.weekday || a.classType.localeCompare(b.classType));


  return {
    range: { start, end, days: length },
    previousRange: hasPrevious ? { start: prevStart, end: prevEnd } : null,
    slots: result,
  };
}

export interface RosterSession {
  classType: string;
  date: string;
  time: string; // "5 pm"
  timeSort: number;
  booked: { memberId: string | null; name: string; result: string }[]; // still on: Booking / Showed / Showed late
  dropped: { memberId: string | null; name: string; result: string }[]; // cancelled or no-show
}

/** Who is booked into each class on one day (past or upcoming). Open Gym is left out. */
export async function getClassRoster(date: string): Promise<RosterSession[]> {
  const rows = await fetchBookings(date, date);
  const sessions = new Map<string, RosterSession>();
  for (const b of rows) {
    const classType = String(b["Class Name"] ?? (b["Service"] === "Class Attendant" ? (b["Resource Name"] ?? "Class") : "")).trim();
    if (!classType || classType.includes("(Historic)")) continue;
    if (parseGymMasterDate(b["Booking Date"]) !== date) continue;
    const rawTime = String(b["Booking Start Time"] ?? "");
    if (!rawTime) continue;
    const key = `${classType}|${rawTime}`;
    const s = sessions.get(key) ?? { classType, date, time: timeLabel(rawTime), timeSort: Number(b["sorted_Booking Start Time"] ?? 0), booked: [], dropped: [] };
    const result = String(b["Booking Result"] ?? "");
    const person = { memberId: b["Member ID"] != null ? String(b["Member ID"]) : null, name: String(b["Name"] ?? "").trim() || "(no name)", result };
    (VALID_ATTENDANCE.includes(result) ? s.booked : s.dropped).push(person);
    sessions.set(key, s);
  }
  return [...sessions.values()].sort((a, b) => a.timeSort - b.timeSort || a.classType.localeCompare(b.classType));
}

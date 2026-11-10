/**
 * The founders' meeting: every Monday 7pm Pacific. "Urgent" means a hard deadline that falls
 * before the next meeting, because the meeting is where everything else gets reviewed.
 */

export const MEETING_TZ = "America/Los_Angeles";

/** Next Monday 7pm Pacific after `now`; a Monday before 7pm counts as this week's */
export function nextMeeting(now = new Date()): Date {
  const pacific = new Date(now.toLocaleString("en-US", { timeZone: MEETING_TZ }));
  const offsetMs = now.getTime() - pacific.getTime(); // local-as-UTC → real UTC
  const d = new Date(pacific);
  d.setHours(19, 0, 0, 0);
  const daysToMonday = (8 - d.getDay()) % 7; // 0 if Monday
  d.setDate(d.getDate() + daysToMonday);
  if (d.getTime() <= pacific.getTime()) d.setDate(d.getDate() + 7);
  return new Date(d.getTime() + offsetMs);
}

export const isUrgent = (t: { hardDeadline: boolean; dueAt: Date | null }, now = new Date()) => t.hardDeadline && !!t.dueAt && t.dueAt < nextMeeting(now);

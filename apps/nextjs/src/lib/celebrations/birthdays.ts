/**
 * Which members have a birthday coming up. Pure date logic: no I/O, so it's easy to test.
 * A birthday "comes up" when its next occurrence is within `daysAhead` days of `today`
 * (inclusive of today). Feb 29 birthdays fall on Feb 28 in non-leap years.
 */

export interface BirthdayCandidate {
  memberId: string;
  dob: string; // YYYY-MM-DD
}

export interface UpcomingBirthday {
  memberId: string;
  occasionDate: string; // YYYY-MM-DD, this occurrence
  daysAway: number;
  age: number;
}

const DAY = 864e5;

const parts = (iso: string) => ({ y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)), d: Number(iso.slice(8, 10)) });
const utc = (iso: string) => {
  const { y, m, d } = parts(iso);
  return Date.UTC(y, m - 1, d);
};
const isoOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The next occurrence of a month/day on or after `today` (both as YYYY-MM-DD) */
export function nextOccurrence(dob: string, today: string): string {
  const { m, d } = parts(dob);
  const year = parts(today).y;
  for (const y of [year, year + 1]) {
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate(); // handles Feb 29 → Feb 28
    const date = isoOf(Date.UTC(y, m - 1, Math.min(d, lastDay)));
    if (date >= today) return date;
  }
  throw new Error("unreachable");
}

export function upcomingBirthdays(members: BirthdayCandidate[], today: string, daysAhead: number): UpcomingBirthday[] {
  const out: UpcomingBirthday[] = [];
  for (const m of members) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m.dob)) continue;
    const occasionDate = nextOccurrence(m.dob, today);
    const daysAway = Math.round((utc(occasionDate) - utc(today)) / DAY);
    if (daysAway > daysAhead) continue;
    out.push({ memberId: m.memberId, occasionDate, daysAway, age: Number(occasionDate.slice(0, 4)) - Number(m.dob.slice(0, 4)) });
  }
  return out.sort((a, b) => a.daysAway - b.daysAway || a.memberId.localeCompare(b.memberId));
}

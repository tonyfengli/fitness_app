// Read-only: class attendance for the last 4 weeks (Oct 5 – Nov 1) via the shared lib
import { getClassAttendance } from "~/lib/class-attendance";
const d = await getClassAttendance("2026-10-05", "2026-11-01");
console.log("range", d.range, "| previous", d.previousRange, "| slots", d.slots.length);
for (const s of d.slots) console.log(`${s.weekdayLabel} ${s.time.padEnd(6)} ${s.classType.padEnd(20)} ${s.current.avg.toFixed(1)} avg (${s.current.visits}/${s.current.sessions})  prev ${s.previous ? s.previous.avg.toFixed(1) : "—"}`);
process.exit(0);

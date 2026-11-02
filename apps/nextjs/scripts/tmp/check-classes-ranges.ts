// Read-only: the other presets return sensible ranges and comparisons
import { getClassAttendance } from "~/lib/class-attendance";
for (const [label, s, e] of [["8 wk", "2026-09-07", "2026-11-01"], ["3 mo", "2026-08-02", "2026-11-01"], ["Aug 1 +", "2026-08-01", "2026-11-01"]]) {
  const d = await getClassAttendance(s!, e!);
  const v = d.slots.reduce((t, x) => t + x.current.visits, 0), n = d.slots.reduce((t, x) => t + x.current.sessions, 0);
  console.log(label.padEnd(8), d.range.start, "→", d.range.end, `| ${d.slots.length} slots | ${(v / n).toFixed(1)} avg | compare:`, d.previousRange ? `${d.previousRange.start} → ${d.previousRange.end}` : "none (before Aug 1)");
  await new Promise(r => setTimeout(r, 1500));
}
process.exit(0);

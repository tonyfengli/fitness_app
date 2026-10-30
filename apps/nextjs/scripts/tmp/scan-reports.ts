// Read-only: scan report IDs on the OLD GymMaster, record columns, flag billing-detail-change candidates.
import { writeFileSync } from "fs";
const base = process.env.GYMMASTER_BASE_URL!, key = process.env.GYMMASTER_REPORT_API_KEY!;
const OUT = "scripts/tmp/output/report-scan.json";
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const FLAG = /alter|chang|billing detail|card|token|expir|bank|account|method|provider|updated|modified/i;
const found: any[] = [];
for (let id = 1; id <= 600; id++) {
  let rows: any[] | null = null, err = "";
  for (let a = 0; a < 4; a++) {
    try {
      const r = await fetch(`${base}/api/v2/report/standard_report`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", "X-GM-API-KEY": key }, body: JSON.stringify({ report_id: id, start_date: "2026-01-01", end_date: "2026-10-29" }) });
      if (r.status === 429) { await sleep(5000 * 2 ** a); continue; }
      const j = await r.json(); if (j.error) { err = JSON.stringify(j.error).slice(0, 80); break; }
      rows = j.result || []; break;
    } catch (e) { err = String(e).slice(0, 80); await sleep(2000); }
  }
  if (rows) {
    const cols = [...new Set(rows.flatMap((r: any) => Object.keys(r)))].filter(k => !k.startsWith("sorted_"));
    const hits = cols.filter(c => FLAG.test(c));
    found.push({ id, rows: rows.length, cols, hits });
    if (hits.length) console.log(`⭐ ${id}: ${rows.length} rows | ${hits.join(" | ")}  [all: ${cols.join(" | ")}]`);
    else if (rows.length) console.log(`   ${id}: ${rows.length} rows | ${cols.slice(0, 6).join(" | ")}`);
  }
  if (id % 25 === 0) { writeFileSync(OUT, JSON.stringify(found, null, 1)); console.log(`-- scanned to ${id}`); }
  await sleep(1200);
}
writeFileSync(OUT, JSON.stringify(found, null, 1)); console.log("done");

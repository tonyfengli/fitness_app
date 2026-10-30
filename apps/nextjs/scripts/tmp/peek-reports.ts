const base = process.env.GYMMASTER_BASE_URL!, key = process.env.GYMMASTER_REPORT_API_KEY!;
async function rep(id: number, s: string, e: string) {
  const r = await fetch(`${base}/api/v2/report/standard_report`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", "X-GM-API-KEY": key }, body: JSON.stringify({ report_id: id, start_date: s, end_date: e }) });
  const j = await r.json(); return (j.result || []) as Record<string, any>[];
}
const [s, e] = [process.argv[2]!, process.argv[3]!];
for (const id of process.argv.slice(4).map(Number)) {
  const rows = await rep(id, s, e);
  const cols = Object.keys(rows[0] ?? {}).filter(k => !k.startsWith("sorted_"));
  console.log(`\n== report ${id}: ${rows.length} rows\ncols: ${cols.join(" | ")}`);
  // show value shapes without names/contacts
  const ex: Record<string, string> = {};
  for (const c of cols) { const v = rows.map(r => r[c]).find(v => v !== null && v !== "" ); ex[c] = /name|cell|phone|email|address/i.test(c) ? "<redacted>" : String(v ?? "").slice(0, 40); }
  console.log("sample:", JSON.stringify(ex));
  await new Promise(r => setTimeout(r, 3000));
}

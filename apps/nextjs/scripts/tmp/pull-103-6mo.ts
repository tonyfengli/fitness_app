// Read-only: report 103 (All Payments) May 1 → today, for the short-charge dry run baseline.
const base = process.env.GYMMASTER_BASE_URL!, key = process.env.GYMMASTER_REPORT_API_KEY!;
const r = await fetch(`${base}/api/v2/report/standard_report`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", "X-GM-API-KEY": key }, body: JSON.stringify({ report_id: 103, start_date: process.argv[2], end_date: process.argv[3] }) });
const rows = ((await r.json()).result || []) as Record<string, any>[];
const out = rows.map(x => ({ id: String(x["Member ID"] ?? ""), date: x["Payment Date"], amount: Number(String(x["Payment Amount"] ?? "0").replace(/[$,]/g, "")), details: x["Payment Details"] }));
console.log(JSON.stringify(out));

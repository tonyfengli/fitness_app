// Read-only: Paolo Delgado (324369) memberships, payments and Current Members presence in the old GymMaster
const base = process.env.GYMMASTER_BASE_URL!;
const staff = async (p: string) => (await fetch(`${base}/api/v3${p}`, { headers: { Accept: "application/json", "X-GM-API-KEY": process.env.GYMMASTER_STAFF_API_KEY! } })).json();
const rep = async (id: number, s: string, e: string) => ((await (await fetch(`${base}/api/v2/report/standard_report`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", "X-GM-API-KEY": process.env.GYMMASTER_REPORT_API_KEY! }, body: JSON.stringify({ report_id: id, start_date: s, end_date: e }) })).json()).result || []) as Record<string, any>[];
const ms = await staff("/member/324369/membership");
for (const m of Array.isArray(ms) ? ms : [ms]) {
  const keep = Object.fromEntries(Object.entries(m ?? {}).filter(([, v]) => v !== null && v !== ""));
  console.log("membership:", JSON.stringify(keep));
}
const pays = (await rep(103, "2026-05-01", "2026-10-31")).filter(p => String(p["Member ID"]) === "324369");
console.log("payments:", pays.map(p => `${p["Payment Date"]} ${p["Payment Amount"]} ${p["Payment Details"]}`));
await new Promise(r => setTimeout(r, 2000));
for (const [s, e] of [["2026-10-01", "2026-10-31"], ["2026-01-01", "2026-10-31"]]) {
  const cur = await rep(1, s, e);
  console.log(`report 1 (${s}..${e}): ${cur.length} rows, Paolo present:`, cur.some(r => String(r["Member ID"]) === "324369"));
  await new Promise(r => setTimeout(r, 2000));
}
const owing = (await rep(13, "2026-10-01", "2026-10-31")).filter(r => String(r["Member ID"]) === "324369");
console.log("owing:", owing.map(r => r["Owe End"]));

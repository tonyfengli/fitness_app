// Read-only: pull raw audit data per client from OLD GymMaster + Stripe into scripts/tmp/output/audit/<id>.json
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "fs";
const base = process.env.GYMMASTER_BASE_URL!, rkey = process.env.GYMMASTER_REPORT_API_KEY!, skey = process.env.GYMMASTER_STAFF_API_KEY!, sk = process.env.STRIPE_SECRET_KEY!;
const OUT = "scripts/tmp/output/audit"; mkdirSync(OUT, { recursive: true });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const today = new Date().toISOString().slice(0, 10);
async function rep(n: number, s: string, e: string): Promise<any[]> {
  for (let a = 0; a < 5; a++) {
    const r = await fetch(`${base}/api/v2/report/standard_report`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", "X-GM-API-KEY": rkey }, body: JSON.stringify({ report_id: n, start_date: s, end_date: e }) });
    if (r.status === 429) { await sleep(5000 * 2 ** a); continue; }
    const j = await r.json(); await sleep(3000); return (j.result || []).map((x: any) => Object.fromEntries(Object.entries(x).filter(([k]) => !k.startsWith("sorted_"))));
  }
  throw new Error("rate limited " + n);
}
async function v3(p: string) { for (let a = 0; a < 5; a++) { const r = await fetch(`${base}/api/v3${p}`, { headers: { Accept: "application/json", "X-GM-API-KEY": skey } }); if (r.status === 429) { await sleep(3000 * 2 ** a); continue; } await sleep(200); return r.ok ? r.json() : null; } return null; }
async function stripe(p: string) { const r = await fetch(`https://api.stripe.com/v1${p}`, { headers: { Authorization: "Basic " + Buffer.from(sk + ":").toString("base64") } }); return r.json(); }
const types = new Map((await v3("/membershiptype/")).map((t: any) => [t.id, { name: t.name, amount: t.amount, desc: t.price_desc }]));
const [pays, bills, owe, cur, fee] = [await rep(103, "2026-05-01", today), await rep(130, "2026-05-01", "2026-12-31"), await rep(13, "2026-10-01", today), await rep(1, today, today), await rep(127, "2026-10-01", today)];
const by = (rows: any[], k = "Member ID") => (id: string) => rows.filter(r => String(r[k]) === id);
const ids = readdirSync("scripts/tmp/output/board-rows").map(f => f.replace(".json", ""));
for (const id of ids) {
  const board = JSON.parse(readFileSync(`scripts/tmp/output/board-rows/${id}.json`, "utf8"));
  const m = await v3(`/member/${id}`);
  const ms = ((await v3(`/member/${id}/membership`)) || []).map((x: any) => ({ ...x, typeName: types.get(x.membershiptypeid)?.name, typeAmount: types.get(x.membershiptypeid)?.amount }));
  const holds = await v3(`/member/${id}/hold`);
  const custs = ((await stripe(`/customers/search?query=${encodeURIComponent(`metadata['mid']:'${id}'`)}&limit=20`)).data || []);
  const stripeData = [];
  for (const c of custs) {
    const pms = ((await stripe(`/customers/${c.id}/payment_methods?limit=50`)).data || []).filter((p: any) => p.type === "card").map((p: any) => ({ id: p.id, last4: p.card.last4, brand: p.card.brand, exp: `${p.card.exp_month}/${p.card.exp_year}`, added: new Date(p.created * 1000).toISOString().slice(0, 10) }));
    const ch = ((await stripe(`/charges?customer=${c.id}&limit=30`)).data || []).map((x: any) => ({ date: new Date(x.created * 1000).toISOString().slice(0, 10), amount: x.amount / 100, status: x.status, refunded: x.amount_refunded / 100, last4: x.payment_method_details?.card?.last4, fail: x.failure_message, desc: x.description }));
    stripeData.push({ id: c.id, created: new Date(c.created * 1000).toISOString().slice(0, 10), default: c.invoice_settings?.default_payment_method || c.default_source || null, cards: pms, charges: ch });
  }
  const rec = { id, name: board.name, group: board.group, board, member: { joindate: m?.joindate, notes: m?.notes }, memberships: ms, holds, payments: by(pays)(id), billing: by(bills)(id), owing: by(owe)(id), current: by(cur)(id), fee: by(fee)(id), stripe: stripeData };
  writeFileSync(`${OUT}/${id}.json`, JSON.stringify(rec, null, 1));
  process.stdout.write(".");
}
console.log(`\npulled ${ids.length}`);

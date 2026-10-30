// Read-only: re-derive one client's board row from the OLD GymMaster + Stripe, field by field.
const id = process.argv[2]!;
const base = process.env.GYMMASTER_BASE_URL!, rkey = process.env.GYMMASTER_REPORT_API_KEY!, skey = process.env.GYMMASTER_STAFF_API_KEY!, sk = process.env.STRIPE_SECRET_KEY!;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const today = new Date().toISOString().slice(0, 10);
async function rep(n: number, s: string, e: string) {
  const r = await fetch(`${base}/api/v2/report/standard_report`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", "X-GM-API-KEY": rkey }, body: JSON.stringify({ report_id: n, start_date: s, end_date: e }) });
  const j = await r.json(); await sleep(2500); return ((j.result || []) as any[]).filter(x => String(x["Member ID"]) === id);
}
const v3 = async (p: string) => (await fetch(`${base}/api/v3${p}`, { headers: { Accept: "application/json", "X-GM-API-KEY": skey } })).json();
const stripe = async (p: string) => (await fetch(`https://api.stripe.com/v1${p}`, { headers: { Authorization: "Basic " + Buffer.from(sk + ":").toString("base64") } })).json();
const strip = (o: any) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith("sorted_") && !/name|cell|phone|email/i.test(k)));

const m = await v3(`/member/${id}`);
console.log("MEMBER", { joindate: m.joindate, companyid: m.companyid, isprospect: m.isprospect });
const types = new Map((await v3("/membershiptype/")).map((t: any) => [t.id, t.name]));
for (const x of await v3(`/member/${id}/membership`)) console.log("MEMBERSHIP", { type: types.get(x.membershiptypeid), start: x.startdate, end: x.enddate, freq: x.paymentfreq, first: x.firstpayment, price: x.paymentdue, desc: x.pricedesc, signup: x.signupfee, upfront: x.upfront, next: x.nextpayment, cancelled: x.cancelled, history: x.history });
console.log("HOLDS", await v3(`/member/${id}/hold`));
for (const p of await rep(103, "2026-07-01", today)) console.log("PAYMENT(103)", strip(p));
for (const b of await rep(130, "2026-07-01", "2026-12-31")) console.log("BILLING(130)", strip(b));
for (const o of await rep(13, "2026-10-01", today)) console.log("OWING(13)", strip(o));
for (const f of await rep(127, "2026-10-01", today)) console.log("FEE(127)", strip(f));
for (const c of await rep(1, today, today)) console.log("CURRENT(1)", strip(c));

const custs = (await stripe(`/customers/search?query=${encodeURIComponent(`metadata['mid']:'${id}'`)}&limit=20`)).data || [];
for (const c of custs) {
  const pms = (await stripe(`/customers/${c.id}/payment_methods?limit=20`)).data || [];
  const ch = (await stripe(`/charges?customer=${c.id}&limit=20`)).data || [];
  console.log("STRIPE CUSTOMER", { created: new Date(c.created * 1000).toISOString().slice(0, 10), default_pm: c.invoice_settings?.default_payment_method || c.default_source || null, desc: c.metadata?.description ? "(set)" : "" });
  for (const p of pms) if (p.type === "card") console.log("   card", { id: p.id, brand: p.card.brand, last4: p.card.last4, exp: `${p.card.exp_month}/${p.card.exp_year}`, added: new Date(p.created * 1000).toISOString().slice(0, 10) });
  for (const x of ch) console.log("   charge", { date: new Date(x.created * 1000).toISOString().slice(0, 10), amount: x.amount / 100, status: x.status, last4: x.payment_method_details?.card?.last4, refunded: x.amount_refunded / 100, desc: x.description });
}

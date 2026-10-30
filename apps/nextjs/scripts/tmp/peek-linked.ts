// Read-only: what the old GymMaster staff API says about billing links for Samantha / Layla (no contact fields printed)
const base = process.env.GYMMASTER_BASE_URL!, key = process.env.GYMMASTER_STAFF_API_KEY!;
const get = async (p: string) => (await fetch(`${base}/api/v3${p}`, { headers: { Accept: "application/json", "X-GM-API-KEY": key } })).json();
for (const id of ["322749", "323056", "322750", "323035"]) {
  const ms = await get(`/member/${id}/membership`);
  for (const m of Array.isArray(ms) ? ms : [ms]) {
    if (m?.history) continue;
    const keep = Object.fromEntries(Object.entries(m ?? {}).filter(([k, v]) => v !== null && v !== "" && !/phone|email|address|cell/i.test(k)));
    console.log(id, JSON.stringify(keep));
  }
  const rec = await get(`/member/${id}`);
  const r = Array.isArray(rec) ? rec[0] : rec;
  console.log(id, "member keys w/ link-ish:", Object.entries(r ?? {}).filter(([k, v]) => /link|pay|bill|parent|family|guard|account|debtor/i.test(k)).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(" "));
  await new Promise(r => setTimeout(r, 500));
}

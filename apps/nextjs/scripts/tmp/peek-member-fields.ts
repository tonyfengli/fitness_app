// Read-only: field names on an old-GymMaster member record; prints values only for name fields
const base = process.env.GYMMASTER_BASE_URL!, key = process.env.GYMMASTER_STAFF_API_KEY!;
const rec = await (await fetch(`${base}/api/v3/member/323056`, { headers: { Accept: "application/json", "X-GM-API-KEY": key } })).json();
const r = Array.isArray(rec) ? rec[0] : rec;
console.log(Object.keys(r ?? {}).join(", "));
console.log(Object.fromEntries(Object.entries(r ?? {}).filter(([k]) => /^(first|sur|last|full)?name$|firstname|surname|lastname/i.test(k))));

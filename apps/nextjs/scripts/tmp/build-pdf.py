import csv,json,os,html,re
from datetime import date
E=html.escape
rows={f[:-5]:json.load(open("board-rows/"+f)) for f in os.listdir("board-rows")}
for f in os.listdir("card-updates"): rows[f[:-5]].update(json.load(open("card-updates/"+f)))
rows["323917"].update(card="Stripe Link wallet (no card digits)",cardLastCharged="Link on Oct 24")
rows["322744"].update(card="Stripe Link wallet (no card digits)",cardLastCharged="Link on Sep 5 (refunded)")
rows["323462"]["feeCharged"]="$148.00"
audit={r["Old ID"]:r for r in csv.DictReader(open("/Users/tonyli/Desktop/anaheim-audit-2026-10-29.csv"))}
ORDER={"Needs decision":0,"Nothing to bill":1,"Not migrating billing":2,"Not migrating":3,"Clean":4}
LABEL={"Not migrating billing":"$0, don't bill"}
TAG={"Needs decision":"warn","Clean":"good","Not migrating":"mute","Nothing to bill":"info","Not migrating billing":"info"}
def money(v):
  try: return float(re.sub(r"[^0-9.-]","",v or "") or 0)
  except: return 0
def fdate(s):
  if not s: return "—"
  try: d=date.fromisoformat(s); return d.strftime("%b %-d") if d.year==2026 else d.strftime("%b %-d, %Y")
  except: return s
def ledger(r):
  months=[("Aug","chargesAug"),("Sep","chargesSep"),("Oct","chargesOct")]
  last=next((k for _,k in reversed(months) if r.get(k)),None)
  out=['<div class="ledger">']
  for m,k in months:
    out.append(f'<div class="lm"><div class="lm-h">{m}</div>')
    parts=[p for p in (r.get(k) or "").split(", ") if p]
    if not parts: out.append('<div class="lm-none">—</div>')
    tot=0
    for i,p in enumerate(parts):
      x=re.match(r"^\w{3} (\d+) (−?)\$([\d,.]+)$",p)
      day,neg,amt=(x.group(1),bool(x.group(2)),float(x.group(3).replace(",",""))) if x else ("",False,money(p))
      tot+=-amt if neg else amt
      cls="lm-r"+(" latest" if k==last and i==len(parts)-1 else "")+(" neg" if neg else "")
      out.append(f'<div class="{cls}"><span class="lm-d">{day}</span><span class="lm-a">{"−" if neg else ""}${amt:,.2f}</span></div>')
    if len(parts)>1: out.append(f'<div class="lm-r lm-t"><span class="lm-d"></span><span class="lm-a">${tot:,.2f}</span></div>')
    out.append('</div>')
  out.append('</div>'); return "".join(out)
def block(r,a):
  st=a["Status"]; owes=money(r.get("owed"))>0
  card=r.get("card") or "Not checked"; bad=("No card" in card or "EXPIRED" in card)
  fee=r.get("feeCharged") or ""
  return f'''<section class="client">
  <div class="c-head">
    <div class="c-name">{E(r["name"])}<span class="c-id">#{r["oldId"]}</span></div>
    <div class="c-tags"><span class="tag {"good" if r["group"]=="Active" else "info"}">{E(r["group"])}</span><span class="tag {TAG[st]}">{E(LABEL.get(st,st))}</span>{f'<span class="issue">{E(a["Category"])}</span>' if a["Category"] else ""}</div>
  </div>
  <div class="c-body">
    <div class="facts">
      <div class="f wide"><span class="k">Plan</span><span class="v">{E(r.get("plan") or "—")}</span></div>
      <div class="f"><span class="k">Plan price</span><span class="v mono">{E(r.get("price") or "—")}</span></div>
      <div class="f"><span class="k">Fee charged</span><span class="v mono">{E(fee or "—")}</span></div>
      <div class="f"><span class="k">Billed every</span><span class="v mono">{E(r.get("frequency") or "—")}</span></div>
      <div class="f"><span class="k">Started</span><span class="v mono">{fdate(r.get("startDate"))}</span></div>
      <div class="f"><span class="k">Next charge</span><span class="v mono">{fdate(r.get("nextCharge"))}</span></div>
      <div class="f"><span class="k">Balance</span><span class="v"><span class="tag {"bad" if owes else "good"}">{("Owes "+r["owed"]) if owes else "Paid up"}</span></span></div>
      <div class="f wide"><span class="k">Card on file</span><span class="v mono{" v-bad" if bad else ""}">{E(card)}</span>{f'<span class="sub">Last charged {E(r["cardLastCharged"])}</span>' if r.get("cardLastCharged") else ""}</div>
    </div>
    <div class="charges"><span class="k">Charges</span>{ledger(r)}</div>
  </div>
  <div class="c-notes">
    <div><span class="k">Finding</span><p>{E(a["Finding"])}</p></div>
    <div><span class="k">Action needed</span><p>{E(a["Action needed"])}</p></div>
  </div>
</section>'''
ids=sorted(rows,key=lambda i:(ORDER[audit[i]["Status"]],rows[i]["name"]))
from collections import Counter
cnt=Counter(audit[i]["Status"] for i in ids)
index="".join(f'<tr><td>{E(rows[i]["name"])}</td><td class="mono">#{i}</td><td><span class="tag {TAG[audit[i]["Status"]]}">{E(LABEL.get(audit[i]["Status"],audit[i]["Status"]))}</span></td><td>{E(audit[i]["Category"])}</td><td>{E(audit[i]["Action needed"])}</td></tr>' for i in ids)
tiles="".join(f'<div class="tile"><div class="tn">{cnt.get(s,0)}</div><div class="tl"><span class="tag {TAG[s]}">{E(LABEL.get(s,s))}</span></div></div>' for s in ["Needs decision","Clean","Nothing to bill","Not migrating billing","Not migrating"])
patterns=[
"Founders Open Gym: plan says $78, all six members on it pay $48.",
"Hidden price overrides on at least 10 clients. Set up the new system from actual charges, not plan prices.",
"3% card fee applied inconsistently (Bahena $150 flat vs Vargas Edgar $154.50 on the same plan).",
"Linked billing: Jacob Erdtsieck pays for Samantha; Lexi Oviedo pays Layla Vasquez's $120 on the 20th.",
"Incomplete plans still carrying next-payment dates: Alexander, Proctor. Do not migrate them.",
"Stripe Link wallets with no card digits: Tobon, Balvas.",
"Clients relying on retries after insufficient funds: Estrada Roger, Erdtsieck Jacob, Villabon Orozco, Seanez, Oviedo.",
"Old-system charges in the next two days: Oct 30 Kleiser; Oct 31 Lauro, Delgado, Martinez Elisabeth, Ramey, Tobon.",
]
css=open("../pdf.css").read()
doc=f'''<!doctype html><html><head><meta charset="utf-8"><title>Anaheim Migration Board</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<style>{css}</style></head><body>
<section class="cover">
  <div class="eyebrow">Elev8 Performance Anaheim · Old GymMaster audit</div>
  <h1>Anaheim Migration Board</h1>
  <div class="meta">49 clients · Old GymMaster and Stripe, checked Oct 29, 2026 · read-only</div>
  <div class="tiles">{tiles}</div>
  <h2>Patterns across clients</h2><ul class="patterns">{"".join(f"<li>{E(p)}</li>" for p in patterns)}</ul>
</section>
<section class="index"><h2>All clients</h2><table><thead><tr><th>Client</th><th>Old ID</th><th>Audit</th><th>Issue</th><th>Action needed</th></tr></thead><tbody>{index}</tbody></table></section>
<h2 class="detail-h">Client detail</h2>
{"".join(block(rows[i],audit[i]) for i in ids)}
</body></html>'''
open("anaheim-board.html","w").write(doc); print("ok",len(ids))

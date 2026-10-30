import csv,json,os,html,re
from datetime import date
E=html.escape
rows={f[:-5]:json.load(open("board-rows/"+f)) for f in os.listdir("board-rows")}
for f in os.listdir("card-updates"): rows[f[:-5]].update(json.load(open("card-updates/"+f)))
rows["323917"].update(card="Stripe Link wallet (no card digits)",cardLastCharged="Link on Oct 24")
rows["322744"].update(card="Stripe Link wallet (no card digits)",cardLastCharged="Link on Sep 5 (refunded)")
rows["323462"]["feeCharged"]="$148.00"
audit={}
for f in os.listdir("audit-updates"):
  d=json.load(open("audit-updates/"+f)); audit[f[:-5]]={"Status":d["auditStatus"].replace("$0, don't bill","Not migrating billing"),"Category":d["auditCategory"],"Finding":d["auditFinding"],"Action needed":d["auditAction"]}
LABEL={"Not migrating billing":"$0, don't bill"}
TAG={"Needs decision":"warn","Clean":"good","Not migrating":"mute","Nothing to bill":"info","Not migrating billing":"info"}
TODAY=date(2026,10,29)
money=lambda v: float(re.sub(r"[^0-9.-]","",v or "") or 0)
def fdate(s):
  if not s: return ""
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
  return "".join(out)+"</div>"
trs=[]
for i in sorted(rows,key=lambda i:rows[i]["name"]):
  r,a=rows[i],audit[i]; st=a["Status"]; owes=money(r.get("owed"))>0
  card=r.get("card") or ""; bad="No card" in card or "EXPIRED" in card
  nc=r.get("nextCharge") or ""; soon=False
  try: soon=(date.fromisoformat(nc)-TODAY).days<=7
  except: pass
  trs.append(f'''<tr>
<td class="sticky">{E(r["name"])}<small>#{i}</small></td>
<td><span class="tag {"good" if r["group"]=="Active" else "info"}">{E(r["group"])}</span></td>
<td class="wrap">{E(r.get("plan") or "")}</td>
<td class="wrap">{E(r.get("price") or "")}</td>
<td class="num">{E(r.get("feeCharged") or "")}</td>
<td>{E(r.get("frequency") or "")}</td>
<td class="date">{fdate(r.get("startDate"))}</td>
<td class="date{" v-warn" if soon else ""}">{fdate(nc)}</td>
<td class="bal"><span class="tag {"bad" if owes else "good"}">{("Owes "+r["owed"]) if owes else "Paid up"}</span>{ledger(r)}</td>
<td class="cardc"><div class="{"v-bad" if bad else ""}">{E(card)}</div>{f'<div class="card-sub">Last charged {E(r["cardLastCharged"])}</div>' if r.get("cardLastCharged") else ""}</td>
</tr>''')
groups=[("",1,"sticky"),("Client",1,""),("Plan",5,""),("Billing (old)",3,"")]
cols=["Client","Group","Plan","Plan price","Fee charged","Billed every","Started","Next charge","Balance","Card on file"]
doc=f'''<!doctype html><html><head><meta charset="utf-8"><title>Anaheim Migration Board</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<style>{open("../table-pdf.css").read()}</style></head><body>
<div class="top"><div class="eyebrow">Elev8 Performance Anaheim · Old GymMaster → Elev8 GymMaster</div><h1>Anaheim Migration Board</h1><div class="total">49 clients · old system data as of Oct 29, 2026</div></div>
<table><thead>
<tr class="groups">{"".join(f'<th colspan="{n}" class="{c}">{E(g)}</th>' for g,n,c in groups)}</tr>
<tr class="cols">{"".join(f'<th class="{"sticky" if c=="Client" else ""}">{E(c)}{" ▲" if c=="Client" else ""}</th>' for c in cols)}</tr>
</thead><tbody>{"".join(trs)}</tbody></table></body></html>'''
open("anaheim-board-table.html","w").write(doc); print("ok")

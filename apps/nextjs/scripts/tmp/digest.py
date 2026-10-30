import json,os,sys,re
from datetime import date
DONE={"324257","322745","322839","323221","322746","323399"}
def m(v):
  try: return float(re.sub(r"[^0-9.-]","",str(v)) or 0)
  except: return 0
def d(s):
  from datetime import datetime
  for f in ("%b %d %Y","%Y-%m-%d"):
    try: return datetime.strptime(str(s),f).date().isoformat()
    except: pass
  return str(s)
def kind(note):
  n=str(note or "")
  if "MP transaction" in n or "real time" in n: return "SELF(portal)"
  if "POS Manual" in n: return "MANUAL(staff)"
  if "Journal" in n: return "journal"
  if "Prepayment" in n: return "prepay"
  if "Billing batch" in n: return "auto"
  return n[:30]
recs=[json.load(open("audit/"+f)) for f in os.listdir("audit")]
recs=sorted([r for r in recs if r["id"] not in DONE],key=lambda r:r["name"])
lo,hi=int(sys.argv[1]),int(sys.argv[2])
for i,r in enumerate(recs[lo:hi],start=lo+1):
  b=r["board"]
  print(f"\n######## {i}. {r['name']} #{r['id']} [{r['group']}] joined {r['member']['joindate']}  notes={r['member']['notes']!r}")
  for x in r["memberships"]:
    if x["history"] and (x["enddate"] or "")<"2026-05-01": continue
    print(f"  MS {'HIST' if x['history'] else 'LIVE'} {x.get('typeName')!r} {x['pricedesc']} start={x['startdate']} end={x['enddate']} first={x['firstpayment']} next={x['nextpayment']} completed={x['completed']} cancelled={x['cancelled']} term={x['termination_date']} typeAmt={x.get('typeAmount')}")
  for h in (r["holds"] or []):
    if (h.get("enddate") or "9999")>="2026-05-01": print(f"  HOLD {h.get('startdate')}→{h.get('enddate')} {h.get('reason')!r} current={h.get('is_current')}")
  pays=sorted(r["payments"],key=lambda p:d(p["Payment Date"]))
  print("  PAY", "; ".join(f"{d(p['Payment Date'])[5:]} {m(p['Payment Amount']):g} {('REFUNDED' if p['Payment Details'].strip()=='Refunded' else 'REFUND' if 'Refund' in p['Payment Details'] else p['Payment Details'].replace('Membership Category: ','')[:14])} {kind(p['Payment Note'])}{(' ['+p['Payment Note'].split(' - Initiated')[0][:40]+']') if 'Refund' in p['Payment Details'] else ''}" for p in pays if d(p['Payment Date'])>='2026-06-01'))
  bl=sorted(r["billing"],key=lambda x:d(x["Billing Date"]))
  if bl: print("  BILL", "; ".join(f"{d(x['Billing Date'])[5:]} {m(x['Amount']):g} {x['Billing Status']}{(' '+str(x['Fail Reason'])[:35]) if x['Billing Status']!='SUCCESS' else ''}" for x in bl if d(x['Billing Date'])>='2026-06-01'))
  if r["owing"]: print("  OWE", [(o.get("Owe Start"),o.get("Owe End"),o.get("Last Payment")) for o in r["owing"]])
  for c in r["current"]: print(f"  CUR lastvisit={c.get('Last Visit Date')} fee={c.get('Membership Fee')} {c.get('Price Description')} comment={c.get('Member Billing Comment')!r}")
  for s in r["stripe"]:
    cards={}
    for c in s["cards"]: cards.setdefault(f"{c['last4']} {c['exp']}",0); cards[f"{c['last4']} {c['exp']}"]+=1
    ch=[c for c in s["charges"] if c["date"]>="2026-06-01"]
    print(f"  STRIPE cust {s['created']} cards={cards} | " + "; ".join(f"{c['date'][5:]} {c['amount']:g} {c['status'][:4]}{' ref'+format(c['refunded'],'g') if c['refunded'] else ''} •{c.get('last4')}{' '+(c['fail'] or '')[:25] if c['status']!='succeeded' else ''}" for c in ch))
  print(f"  BOARD plan={b['plan']!r} price={b['price']!r} fee={b['feeCharged']} freq={b['frequency']} start={b['startDate']} next={b['nextCharge']} owed={b['owed']} Aug=[{b['chargesAug']}] Sep=[{b['chargesSep']}] Oct=[{b['chargesOct']}] card={b.get('card')}")

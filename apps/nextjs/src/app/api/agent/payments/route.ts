/**
 * Payments API for the Save Calls payments tab
 * GET /api/agent/payments
 *
 * Returns one billing row per paying member: plan, price, billing cadence,
 * next charge, balance with a rolling 3-month charge ledger, billing dates that came in
 * short or were missed, card on file, and phone.
 * Members come from the KPI roster (same members the KPI overview counts);
 * billing data is pulled live from GymMaster (reports + staff API) and Stripe.
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { validateFounderAccess } from "~/lib/api-auth";
import { getKpiRoster } from "~/lib/kpi-roster";
import { monthlyPlanPrice } from "~/lib/plan-price";
import type { BillingGap, PaymentFailure, PaymentRow } from "~/app/save-calls/types";
import { needsAttention } from "~/app/save-calls/rules";

export const dynamic = "force-dynamic";

const LEDGER_MONTHS = 3;
const CONCURRENCY = 6;
const RECOVERY_DAYS = 21;
const BASELINE_MONTHS = 6; // payment history used to learn each member's usual charge
const MATCH_DAYS = 3; // a charge this close to a billing date was that date's automatic run
const CYCLE_DAYS: Record<string, number> = { "28 days": 28, "14 days": 14, "7 days": 7 };

type ReportRow = Record<string, string | number | null>;

const money = (v: unknown) => parseFloat(String(v ?? "").replace(/[^0-9.-]/g, "")) || 0;
const iso = (d: Date) => d.toISOString().slice(0, 10);

const dayDiff = (from: string, to: string) => Math.round((Date.parse(to + "T12:00:00Z") - Date.parse(from + "T12:00:00Z")) / 864e5);

function addDays(date: string, days: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}

// Same day of month, clamped to the month's last day
function addMonths(date: string, months: number) {
  const [y, m, day] = date.split("-").map(Number) as [number, number, number];
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return iso(new Date(Date.UTC(y, m - 1 + months, Math.min(day, lastDay), 12)));
}

function parseGymMasterDate(s: unknown): string {
  const d = new Date(String(s ?? ""));
  return isNaN(d.getTime()) ? "" : iso(d);
}

async function fetchReport(reportId: number, startDate: string, endDate: string): Promise<ReportRow[]> {
  const baseUrl = process.env.GYMMASTER_BASE_URL;
  const apiKey = process.env.GYMMASTER_REPORT_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Missing GymMaster configuration");

  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`${baseUrl}/api/v2/report/standard_report`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-GM-API-KEY": apiKey,
      },
      body: JSON.stringify({ report_id: reportId, start_date: startDate, end_date: endDate }),
    });
    if (response.status === 429) {
      await new Promise(r => setTimeout(r, 1500 * 2 ** attempt));
      continue;
    }
    if (!response.ok) throw new Error(`GymMaster report ${reportId} error: ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(`GymMaster report ${reportId} error: ${JSON.stringify(data.error)}`);
    return data.result || [];
  }
  throw new Error(`GymMaster report ${reportId} rate limited`);
}

interface Membership {
  membershiptypeid?: number;
  membershiptypename?: string;
  pricedesc?: string;
  paymentfreq?: string;
  startdate?: string;
  nextpayment?: string;
  history?: boolean;
  completed?: boolean;
}

async function fetchStaffApi<T>(path: string): Promise<T | null> {
  const baseUrl = process.env.GYMMASTER_BASE_URL;
  const apiKey = process.env.GYMMASTER_STAFF_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Missing GymMaster staff API configuration");

  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`${baseUrl}/api/v3${path}`, {
      headers: { Accept: "application/json", "X-GM-API-KEY": apiKey },
    });
    if (response.status === 429) {
      await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    if (!response.ok) return null;
    return (await response.json()) as T;
  }
  return null;
}

// Run async work over items with a fixed number of workers
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]!);
      }
    })
  );
  return results;
}

// Stripe decline codes → short reasons for the ledger
const DECLINE_REASONS: Record<string, string> = {
  insufficient_funds: "insufficient funds",
  expired_card: "card expired",
  incorrect_cvc: "incorrect CVC",
  incorrect_number: "incorrect card number",
  lost_card: "card reported lost",
  stolen_card: "card reported stolen",
  processing_error: "processing error",
  authentication_required: "needs authentication",
};

function declineReason(charge: Stripe.Charge): string {
  const code = charge.outcome?.reason || charge.failure_code || "";
  return DECLINE_REASONS[code] || "card declined";
}

// Gym-local calendar date, so Stripe timestamps line up with GymMaster payment dates
const localDate = (unix: number) => new Date(unix * 1000).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

interface StripeFailure {
  date: string;
  amount: number;
  reason: string;
}

/**
 * Card on file: the customer's default card, else the newest saved card,
 * else the card (or Link wallet) used on the last successful charge.
 * Also returns failed Stripe charges since `since` (YYYY-MM-DD).
 */
async function lookupStripe(
  stripe: Stripe,
  memberId: string,
  since: string
): Promise<Pick<PaymentRow, "card" | "cardStatus" | "cardLastCharged"> & { failures: StripeFailure[] }> {
  const customers = (await stripe.customers.search({ query: `metadata['mid']:'${memberId}'`, limit: 20 })).data;

  const cards: { id: string; brand: string; last4: string; expYear: number; expMonth: number; created: number }[] = [];
  const defaults = new Set<string>();
  let hasLink = false;
  let lastCharge: Stripe.Charge | null = null;
  const failures: StripeFailure[] = [];

  for (const customer of customers) {
    const [methods, charges] = await Promise.all([
      stripe.customers.listPaymentMethods(customer.id, { limit: 20 }),
      stripe.charges.list({ customer: customer.id, limit: 100 }),
    ]);
    for (const pm of methods.data) {
      if (pm.type === "card" && pm.card) {
        cards.push({ id: pm.id, brand: pm.card.brand, last4: pm.card.last4, expYear: pm.card.exp_year, expMonth: pm.card.exp_month, created: pm.created });
      } else if (pm.type === "link") {
        hasLink = true;
      }
    }
    const dflt = customer.invoice_settings?.default_payment_method;
    if (dflt) defaults.add(typeof dflt === "string" ? dflt : dflt.id);
    const ok = charges.data.find(c => c.status === "succeeded");
    if (ok && (!lastCharge || ok.created > lastCharge.created)) lastCharge = ok;
    for (const c of charges.data) {
      const date = localDate(c.created);
      if (c.status === "failed" && date >= since) {
        failures.push({ date, amount: c.amount / 100, reason: declineReason(c) });
      }
    }
  }

  const lastDetails = lastCharge?.payment_method_details;
  const lastDate = lastCharge
    ? new Date(lastCharge.created * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";
  let cardLastCharged = "";
  if (lastDetails?.type === "card" && lastDetails.card) cardLastCharged = `•${lastDetails.card.last4} on ${lastDate}`;
  else if (lastDetails?.type === "link") cardLastCharged = `Link on ${lastDate}`;

  let pick = cards.find(c => defaults.has(c.id)) ?? cards.sort((a, b) => b.created - a.created)[0];
  if (!pick && lastDetails?.type === "card" && lastDetails.card) {
    const c = lastDetails.card;
    pick = { id: "", brand: c.brand ?? "card", last4: c.last4 ?? "", expYear: c.exp_year ?? 0, expMonth: c.exp_month ?? 0, created: 0 };
  }

  if (pick) {
    const now = new Date();
    const expired = pick.expYear < now.getFullYear() || (pick.expYear === now.getFullYear() && pick.expMonth < now.getMonth() + 1);
    const brand = pick.brand.charAt(0).toUpperCase() + pick.brand.slice(1);
    const exp = `${String(pick.expMonth).padStart(2, "0")}/${String(pick.expYear).slice(2)}`;
    return {
      card: `${brand} •${pick.last4} exp ${exp}${expired ? " EXPIRED" : ""}`,
      cardStatus: expired ? "expired" : "ok",
      cardLastCharged,
      failures,
    };
  }
  if (hasLink || lastDetails?.type === "link") {
    return { card: "Stripe Link wallet (no card digits)", cardStatus: "wallet", cardLastCharged, failures };
  }
  return { card: "No card", cardStatus: "none", cardLastCharged, failures };
}

/**
 * Charge ledger rule (verified against GymMaster during the Anaheim audit):
 * all payment categories count, refunded charges and their refund entries are
 * excluded, $0 rows are skipped, and same-day payments are combined.
 */
function buildLedger(payments: ReportRow[], months: string[], failures: StripeFailure[]): PaymentRow["ledger"] {
  const byDay = new Map<string, number>();
  for (const p of payments) {
    if (/^Refunded$|Payment Refund/i.test(String(p["Payment Details"] ?? "").trim())) continue;
    const amount = money(p["Payment Amount"]);
    if (amount === 0) continue;
    const date = parseGymMasterDate(p["Payment Date"]);
    if (!date) continue;
    byDay.set(date, (byDay.get(date) || 0) + amount);
  }
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));

  // A failed attempt is recovered when a payment of the same amount lands on or within 21 days after it
  // (amount must match so a member's other charges don't hide an unpaid linked bill)
  const recovered = (f: StripeFailure) => {
    const limit = new Date(f.date + "T12:00:00");
    limit.setDate(limit.getDate() + RECOVERY_DAYS);
    const until = iso(limit);
    return days.some(([d, amount]) => d >= f.date && d <= until && Math.abs(amount - f.amount) < 0.01);
  };

  return months.map(month => ({
    month,
    charges: days.filter(([d]) => d.startsWith(month)).map(([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 })),
    failed: failures
      .filter(f => f.date.startsWith(month))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(f => ({ ...f, recovered: recovered(f) })),
  }));
}

/**
 * Short-charge check. GymMaster's owing balance doesn't count a billing that went
 * through for less than usual, or never ran at all, so compare each billing date
 * with what the member usually pays:
 * - billing dates walk back from the next charge by the plan's cycle
 * - the usual charge is the most common membership charge that landed on a billing
 *   day (manual catch-ups are ignored); the start-up charge is skipped
 * - each billing date owns the half-cycle around it, so drifted dates and retries still count
 * - unrecovered failed charges are left to the failed-charge flag, and open cycles are skipped
 */
function findBillingGaps(
  payments: ReportRow[],
  plan: { frequency: string; startDate: string; nextCharge: string },
  failures: PaymentFailure[],
  windowStart: string,
  today: string
): BillingGap[] {
  const monthly = plan.frequency === "1 mon";
  const cycleDays = CYCLE_DAYS[plan.frequency];
  // Prepaid, one-off and multi-plan members have no single billing schedule to check
  if (!plan.startDate || !plan.nextCharge || (!monthly && !cycleDays)) return [];
  const step = (n: number) => (monthly ? addMonths(plan.nextCharge, n) : addDays(plan.nextCharge, n * cycleDays!));
  const half = monthly ? 15 : cycleDays! / 2;

  const byDay = new Map<string, number>();
  for (const p of payments) {
    if (!/Gym Memberships/.test(String(p["Payment Details"] ?? ""))) continue;
    const amount = money(p["Payment Amount"]);
    const date = parseGymMasterDate(p["Payment Date"]);
    if (amount <= 0 || !date) continue;
    byDay.set(date, Math.round(((byDay.get(date) || 0) + amount) * 100) / 100);
  }
  const charges = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));

  const cutoff = addDays(today, -MATCH_DAYS);
  const billingDates: string[] = [];
  for (let i = 0, d = plan.nextCharge; d >= windowStart; d = step(-++i)) {
    if (d > plan.startDate && d <= cutoff) billingDates.unshift(d);
  }

  const regular = charges.filter(([d]) => dayDiff(plan.startDate, d) > MATCH_DAYS);
  if (!regular.length) return [];
  const onBillingDay = regular.filter(([d]) => billingDates.some(b => Math.abs(dayDiff(b, d)) <= MATCH_DAYS));
  const pool = onBillingDay.length ? onBillingDay : regular;
  const counts = new Map<number, number>();
  for (const [, amount] of pool) counts.set(amount, (counts.get(amount) || 0) + 1);
  const top = Math.max(...counts.values());
  const usual = [...pool].reverse().find(([, amount]) => counts.get(amount) === top)![1]; // ties: most recent

  const used = new Set<string>();
  const gaps: BillingGap[] = [];
  for (const date of billingDates) {
    const inCycle = (d: string) => dayDiff(date, d) >= -half && dayDiff(date, d) < half;
    const hits = charges.filter(([d]) => inCycle(d) && !used.has(d));
    hits.forEach(([d]) => used.add(d));
    const charged = Math.round(hits.reduce((t, [, a]) => t + a, 0) * 100) / 100;
    if (charged >= usual - 1) continue;
    if (failures.some(f => inCycle(f.date) && !f.recovered)) continue;
    if (dayDiff(date, today) < half) continue;
    gaps.push({ date, kind: charged ? "short" : "missed", expected: usual, charged, chargedOn: hits[0]?.[0] ?? null });
  }
  return gaps;
}

export async function GET(request: NextRequest) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;

  try {
    // 1. Members the KPI overview counts (rolled from finalized snapshots + KPI overrides)
    const roster = await getKpiRoster();

    if (!roster) {
      return NextResponse.json({
        status: "no_data",
        message: "No finalized KPI snapshot found. Please finalize a month first.",
        members: [],
      });
    }

    const payingMembers = roster.members;

    // 2. Rolling ledger window: first day of the month two months back, through today
    const now = new Date();
    const months = Array.from({ length: LEDGER_MONTHS }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (LEDGER_MONTHS - 1 - i), 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
    const today = iso(now);
    const windowStart = `${months[0]}-01`;
    const monthStart = `${months[LEDGER_MONTHS - 1]}-01`;
    const baselineStart = addMonths(`${months[LEDGER_MONTHS - 1]}-01`, -(BASELINE_MONTHS - 1));

    // 3. GymMaster reports, in parallel: payments (103, back far enough to learn usual charges),
    //    owing (13), billing fees (127), current members (1, for phone)
    const [payments, owing, fees, currentMembers, membershipTypes] = await Promise.all([
      fetchReport(103, baselineStart, today),
      fetchReport(13, monthStart, today),
      fetchReport(127, monthStart, today),
      fetchReport(1, monthStart, today),
      fetchStaffApi<{ id: number; name: string }[]>("/membershiptype/"),
    ]);
    const typeNames = new Map((membershipTypes || []).map(t => [t.id, t.name]));

    const group = (rows: ReportRow[]) => {
      const map = new Map<string, ReportRow[]>();
      for (const r of rows) {
        const id = String(r["Member ID"] ?? "");
        if (!map.has(id)) map.set(id, []);
        map.get(id)!.push(r);
      }
      return map;
    };
    const paymentsById = group(payments);
    const owingById = group(owing);
    const feesById = group(fees);
    const currentById = group(currentMembers);

    // 4. Per member: memberships from the staff API, card from Stripe
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion, maxNetworkRetries: 3 }) : null;

    const members = await mapLimit(payingMembers, CONCURRENCY, async (pm): Promise<PaymentRow> => {
      const memberId = String(pm.memberId);
      const [memberships, card] = await Promise.all([
        fetchStaffApi<Membership[]>(`/member/${memberId}/membership`).then(r => r || []),
        // Paid for by another member: the charges and card live on the payer's row
        pm.paidBy
          ? Promise.resolve({ card: `Paid by ${pm.paidBy.name}`, cardStatus: "ok" as const, cardLastCharged: "", failures: [] })
          : stripe
          ? lookupStripe(stripe, memberId, windowStart).catch(err => {
              console.error(`[API /agent/payments] Stripe lookup failed for ${memberId}:`, err);
              return { card: "Card lookup failed", cardStatus: "unknown" as const, cardLastCharged: "", failures: [] };
            })
          : Promise.resolve({ card: "Stripe not configured", cardStatus: "unknown" as const, cardLastCharged: "", failures: [] }),
      ]);

      // Live plans only: skip history and incomplete sign-ups
      const active = memberships.filter(m => !m.history && m.completed !== false);
      const owe = owingById.get(memberId)?.[0];
      const fee = feesById.get(memberId)?.[0];
      // Phone from Current Members; members missing there (prepaid, one-off) fall back to their member record
      let phone = currentById.get(memberId)?.[0]?.["Member Cell"] || null;
      if (!phone) {
        type MemberPhones = { phonecell?: string; phonehome?: string; phonework?: string };
        const record = await fetchStaffApi<MemberPhones | MemberPhones[]>(`/member/${memberId}`);
        const m = Array.isArray(record) ? record[0] : record;
        phone = m?.phonecell || m?.phonehome || m?.phonework || null;
      }

      const ledger = buildLedger(paymentsById.get(memberId) || [], months, card.failures);
      const frequency = active.map(m => m.paymentfreq).filter(Boolean).join(" + ");
      const startDate = active.map(m => m.startdate).filter((s): s is string => !!s).sort()[0] || "";
      const nextCharge = active.map(m => m.nextpayment).filter((s): s is string => !!s).sort()[0] || "";

      return {
        memberId,
        name: pm.name,
        phone: phone ? String(phone) : null,
        plan: active.map(m => m.membershiptypename || typeNames.get(m.membershiptypeid!) || `Type ${m.membershiptypeid}`).join(" + "),
        price: active.map(m => m.pricedesc).filter(Boolean).join(" + "),
        planPrice: monthlyPlanPrice(memberships),
        feeCharged: fee ? String(fee["Membership Fee"] ?? "") : "",
        frequency,
        startDate,
        nextCharge,
        owed: owe ? money(owe["Owe End"]) : 0,
        ledger,
        paidBy: pm.paidBy ?? null,
        billingGaps: !pm.paidBy && active.length === 1
          ? findBillingGaps(paymentsById.get(memberId) || [], { frequency, startDate, nextCharge }, ledger.flatMap(l => l.failed), windowStart, today)
          : [],
        card: card.card,
        cardStatus: card.cardStatus,
        cardLastCharged: card.cardLastCharged,
      };
    });

    members.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      status: "ok",
      // Same red flag as the dashboard: owes, no card, unrecovered failure, or a short/missed billing
      members: members.map(m => ({ ...m, needsAttention: needsAttention(m) })),
      _meta: {
        generatedAt: new Date().toISOString(),
        snapshotMonth: roster.month,
        snapshotYear: roster.year,
        ledgerMonths: months,
      },
    });
  } catch (err) {
    console.error("[API /agent/payments] Error:", err);
    return NextResponse.json(
      { error: "Failed to load payments", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

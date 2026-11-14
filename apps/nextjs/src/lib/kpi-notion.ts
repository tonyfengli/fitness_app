/**
 * Monthly KPI pages in Notion ("Monthly KPIs" database, NOTION_KPI_DATA_SOURCE_ID), one row
 * per month, for Tony's ChatGPT thinking partner to read before the CEO Monday meeting.
 *
 * A row carries the key numbers as columns; its page holds everything the dashboard knows
 * about the month:
 *   - membership and who joined, left or went on hold;
 *   - GymMaster revenue mix;
 *   - P&L lines;
 *   - optionally, the live Retention and Team views "as of" the send.
 * Numbers come from the same code as the dashboard (getDerivedKpi, pnlLines); nothing is
 * computed by a model.
 *
 * Member names are shortened to first name + last initial everywhere, task titles included
 * (Tony, Nov 14 2026). Re-sending a month replaces its page (sendReport), so fixes flow through.
 *
 * "What stands out" is a placeholder for OpenClaw's monthly analysis (not built yet).
 *
 * Sent automatically when a month is finalized or reopened (lib/kpi-notion-sync.ts) and by scripts/kpi-to-notion.ts
 * (backfill). This file must stay importable from a plain script: no route handlers here.
 */

import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { PnlMonthlySnapshot } from "@acme/db/schema";

import { churnJudgment, newMembersJudgment } from "~/app/kpi/lib/metric-definitions";
import { getDerivedKpi, type DerivedKpiMonth } from "~/lib/kpi-derived";
import { bullet, callout, heading, notion, paragraph, type NotionBlock } from "~/lib/notion";
import { pnlLines } from "~/lib/pnl-lines";
import type { MonthlyReconciliation } from "~/lib/revenue-reconciliation";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

/** "Maria Gonzalez Lopez" → "Maria L." (first name + last initial); one word stays as it is */
export function shortName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "";
  return `${parts[0]} ${parts[parts.length - 1]![0]!.toUpperCase()}.`;
}

/** Shortens every known member's full name inside free text (task titles) */
function nameShortener(names: Iterable<string>): (text: string) => string {
  const full = [...new Set([...names].map((n) => n.trim()).filter((n) => /\s/.test(n)))].sort((a, b) => b.length - a.length);
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rules = full.map((n) => ({ re: new RegExp(`\\b${esc(n).replace(/\s+/g, "\\s+")}\\b`, "gi"), to: shortName(n) }));
  return (text) => rules.reduce((t, r) => t.replace(r.re, r.to), text);
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const money = (n: number | null | undefined) => (n == null ? "n/a" : `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`);
const signed = (n: number | null | undefined, unit: "$" | "" | "pts" = "") => {
  if (n == null) return "";
  const v = unit === "$" ? money(Math.abs(n)) : unit === "pts" ? `${Math.abs(Math.round(n * 100) / 100)} pts` : String(Math.abs(Math.round(n * 100) / 100));
  return ` (${n > 0 ? "+" : n < 0 ? "−" : "±"}${v} vs last month)`;
};
const round2 = (n: number) => Math.round(n * 100) / 100;
const pacificDateTime = (d: Date) => d.toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

// ---------------------------------------------------------------------------
// The live views ("as of" the send). The route fetches these; a script never does.
// Each is the JSON the matching /api/agent/* route returns, or an error message.
// ---------------------------------------------------------------------------

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export interface LiveViews {
  at: Date;
  atRisk: Json | string;
  frequency: Json | string;
  newMembers: Json | string;
  payments: Json | string;
  milestones: Json | string;
  classes: Json | string;
  team: Json | string;
}

function liveBlocks(live: LiveViews, short: (t: string) => string): NotionBlock[] {
  const out: NotionBlock[] = [];
  // A view that failed gets a line saying so; the others render
  const usable = (label: string, v: Json | string): v is Json => {
    if (typeof v !== "string") return true;
    out.push(bullet(`${label}: unavailable (${v.slice(0, 150)})`));
    return false;
  };
  const nm = (n: unknown) => shortName(String(n ?? "?"));

  out.push(heading(2, `Retention (as of ${pacificDateTime(live.at)})`));
  out.push(paragraph("Live from GymMaster, Stripe and Kilo when this page was sent; not a record of the month itself."));

  if (usable("At risk", live.atRisk)) {
    const s = live.atRisk.summary ?? {};
    const rows: Json[] = live.atRisk.atRiskMembers ?? [];
    out.push(heading(3, `At risk: ${s.totalAtRisk ?? rows.length} (no visit in 14+ days)`));
    if (s.byTier) out.push(paragraph(`Best odds ${s.byTier.bestOdds} · Fading ${s.byTier.fading} · Long shot ${s.byTier.longShot} · Critical ${s.byTier.critical} · Revenue at risk ${money(s.revenueAtRisk)}/mo`));
    for (const m of rows) out.push(bullet(`${nm(m.name)}: ${m.daysGone} days gone, ${m.statusTier ?? ""}, ${money(m.monthlyRevenue)}/mo${m.kilo?.stage ? `, Kilo: ${m.kilo.stage}` : ""}`));
  }
  if (usable("Visit frequency", live.frequency)) {
    const groups: [string, Json[]][] = [
      ["Slowing (habit broke, 50%+ drop)", live.frequency.slowing ?? []],
      ["Below a healthy 2 visits a week", live.frequency.belowHealthy ?? []],
      ["New members at risk", live.frequency.newMemberRisk ?? []],
    ];
    out.push(heading(3, `Visit frequency: ${groups.map(([l, r]) => `${r.length} ${l.split(" (")[0]!.toLowerCase()}`).join(" · ")}`));
    for (const [label, rows] of groups) for (const m of rows) out.push(bullet(`${label.split(" (")[0]}: ${nm(m.name)}${m.membershipType ? `, ${m.membershipType}` : ""}${m.dropPercent != null ? `, ${Math.round(m.dropPercent)}% drop` : ""}${m.tenureWeeks != null ? `, ${m.tenureWeeks} weeks in` : ""}`));
  }
  if (usable("New members (onboarding)", live.newMembers)) {
    const rows: Json[] = live.newMembers.newMembers ?? [];
    out.push(heading(3, `New members to onboard: ${rows.filter((m) => !m.onboardedOn).length} of ${rows.length} recent`));
    for (const m of rows) out.push(bullet(`${nm(m.name)}: joined ${m.memberSince}${m.membershipType ? `, ${m.membershipType}` : ""}, ${m.onboardedOn ? `onboarded ${m.onboardedOn}` : "not onboarded yet"}`));
  }
  if (usable("Payments", live.payments)) {
    const rows: Json[] = (live.payments.members ?? []).filter((m: Json) => m.needsAttention);
    out.push(heading(3, `Payments needing attention: ${rows.length} of ${(live.payments.members ?? []).length}`));
    for (const m of rows) {
      const why = [
        m.owed > 0 ? `owes ${money(m.owed)}` : "",
        m.cardStatus === "expired" ? "card expired" : m.cardStatus === "none" ? "no card on file" : "",
        (m.ledger ?? []).some((l: Json) => (l.failed ?? []).some((f: Json) => !f.recovered)) ? "unrecovered failed payment" : "",
        (m.billingGaps ?? []).length ? `${m.billingGaps.length} short or missed billing` : "",
      ].filter(Boolean);
      out.push(bullet(`${nm(m.name)}: ${m.plan ?? ""}${why.length ? `, ${why.join(", ")}` : ""}`));
    }
  }
  if (usable("Milestones", live.milestones)) {
    const rows: Json[] = live.milestones.members ?? [];
    const byId = new Map(rows.map((m) => [m.memberId, m]));
    const hit: Json[] = (live.milestones.justHit ?? []).map((id: string) => byId.get(id)).filter(Boolean);
    const soon: Json[] = (live.milestones.comingUp ?? []).map((id: string) => byId.get(id)).filter(Boolean);
    out.push(heading(3, `Milestones: ${hit.length} just hit, ${soon.length} coming up (classes since Aug 1)`));
    for (const m of hit) out.push(bullet(`Just hit: ${nm(m.name)}, ${m.reached?.[m.reached.length - 1]?.milestone ?? m.classes} classes`));
    for (const m of soon) out.push(bullet(`Coming up: ${nm(m.name)}, ${m.toGo} to go to ${m.next}`));
  }
  if (usable("Classes", live.classes)) {
    const slots: Json[] = live.classes.slots ?? [];
    out.push(heading(3, `Class attendance, ${live.classes.range?.start} to ${live.classes.range?.end} (visits per session)`));
    for (const s of [...slots].sort((a, b) => a.weekday - b.weekday || a.timeSort - b.timeSort))
      out.push(bullet(`${s.weekdayLabel} ${s.time} ${s.classType}: ${round2(s.current?.avg ?? 0)} over ${s.current?.sessions ?? 0} sessions${s.previous ? ` (previous period ${round2(s.previous.avg)})` : ""}`));
  }

  out.push(heading(2, `Team tasks (as of ${pacificDateTime(live.at)})`));
  if (usable("Team", live.team)) {
    const people: Json[] = live.team.people ?? [];
    const task = (t: Json) => `${short(String(t.title ?? ""))} (${t.status}${t.dueAt ? `, due ${String(t.dueAt).slice(0, 10)}` : ""}, ${t.daysOpen} days open${t.carryOvers ? `, carried over ${t.carryOvers}×` : ""}${t.nudges ? `, nudged ${t.nudges}×` : ""})`;
    for (const p of people) {
      out.push(heading(3, `${p.name}: ${(p.open ?? []).length} open, ${(p.closedThisWeek ?? []).length} closed since the last meeting, ${p.carryOvers ?? 0} carry-overs`));
      for (const t of p.open ?? []) out.push(bullet(`Open: ${task(t)}`));
      for (const t of p.closedThisWeek ?? []) out.push(bullet(`Closed: ${short(String(t.title ?? ""))}`));
    }
    const un: Json[] = live.team.unassigned ?? [];
    if (un.length) {
      out.push(heading(3, `Unassigned: ${un.length} open`));
      for (const t of un) out.push(bullet(task(t)));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// The month page
// ---------------------------------------------------------------------------

export interface MonthReport {
  key: string; // "2026-10"
  title: string; // "October 2026"
  properties: Record<string, unknown>;
  blocks: NotionBlock[];
  summary: string; // one line for logs and dry runs, no names
}

async function pnlSnapshot(year: number, month: number) {
  const [row] = await db.select().from(PnlMonthlySnapshot).where(and(eq(PnlMonthlySnapshot.year, year), eq(PnlMonthlySnapshot.month, month)));
  return row ?? null;
}

/** Everything about one month as Notion properties and page blocks. `live` adds the Retention and Team views. */
export async function buildMonthReport(year: number, month: number, live?: LiveViews): Promise<MonthReport> {
  const { months } = await getDerivedKpi();
  const i = months.findIndex((m) => m.year === year && m.month === month);
  if (i < 0) throw new Error(`No KPI snapshot for ${MONTHS[month - 1]} ${year}. Save the month on the Overview first.`);
  const cur: DerivedKpiMonth = months[i]!;
  const prev = i > 0 ? months[i - 1]! : null;
  const d = cur.derived;
  const title = `${MONTHS[month - 1]} ${year}`;

  // Member names known anywhere in the KPI data, for shortening names inside task titles
  const known = months.flatMap((m) => [...m.derived.rosterMembers.map((r) => r.name), ...m.derived.filteredLostMembers.map((r) => r.name), ...m.derived.manualLost.map((r) => r.name)]);
  const short = nameShortener(known);

  const churn = cur.prevDerivedTotal ? round2((d.filteredLostCount / cur.prevDerivedTotal) * 100) : null;
  const prevChurn = prev?.prevDerivedTotal ? round2((prev.derived.filteredLostCount / prev.prevDerivedTotal) * 100) : null;
  const arm = d.derivedTotalMembers > 0 ? round2(d.totalRevenue / d.derivedTotalMembers) : 0;
  const prevArm = prev && prev.derived.derivedTotalMembers > 0 ? round2(prev.derived.totalRevenue / prev.derived.derivedTotalMembers) : null;
  const armClasses = d.armClasses != null && d.classMembers ? round2(d.armClasses) : null;
  const other = round2(d.totalRevenue - d.ptRevenue - d.smallGroupRevenue - d.openGymRevenue);
  // The same people the dashboard counts: GymMaster's new and lost lists after exclusions,
  // plus members paid for by someone else (added or lost with their payer) and losses marked by hand
  const held = d.filteredLostMembers.filter((m) => m.type === "hold");
  const prevRoster = new Map((prev?.derived.rosterMembers ?? []).map((r) => [r.memberId, r]));
  const joined = [
    ...d.filteredNewMembers.map((m) => `${shortName(m.name)}: ${money(m.amount)} this month`),
    ...d.linkedAdded.map((l) => `${shortName(l.memberName)}: paid for by ${shortName(l.paidByName)}`),
  ];
  const left = [
    ...d.filteredLostMembers.filter((m) => m.type !== "hold").map((m) => `${shortName(m.name)}: ${money(m.amount)}/mo lost`),
    ...d.manualLost.map((x) => {
      const r = prevRoster.get(x.memberId);
      return `${shortName(r?.name ?? x.name)}: marked lost by hand${r?.amount ? `, ${money(r.amount)}/mo lost` : ""}`;
    }),
    ...d.linkedLost.map((l) => `${shortName(l.memberName)}: was paid for by ${shortName(l.paidByName)}, who left`),
  ];

  const pnlRow = await pnlSnapshot(year, month);
  const pnl = pnlRow ? pnlLines(pnlRow.data as unknown as MonthlyReconciliation) : null;
  const kpiStatus = cur.status === "finalized" ? `Final (finalized ${cur.finalizedAt ? pacificDateTime(cur.finalizedAt).split(",").slice(0, 2).join(",") : ""})` : "Draft (numbers can still change)";
  const pnlStatus = pnlRow ? (pnlRow.status === "finalized" ? "Final" : "Draft") : "None";

  const blocks: NotionBlock[] = [
    callout(
      `Sent ${pacificDateTime(new Date())} from the KPI dashboard. Membership and revenue: ${kpiStatus}. P&L: ${pnlStatus === "None" ? "not saved for this month" : pnlStatus}. Numbers are the dashboard's own; nothing here is estimated by AI. Members are shown as first name + last initial.`,
      "📊",
    ),
    heading(2, "What stands out"),
    paragraph("(Coming: OpenClaw's monthly analysis, a health check and recommendations computed from the facts below, will go here.)"),

    heading(2, "Membership"),
    bullet(`**Members:** ${d.derivedTotalMembers}${signed(prev ? d.derivedTotalMembers - prev.derived.derivedTotalMembers : null)}`),
    bullet(`**New:** ${d.filteredNewCount}${signed(prev ? d.filteredNewCount - prev.derived.filteredNewCount : null)}: ${newMembersJudgment(d.filteredNewCount)}`),
    bullet(`**Lost:** ${d.filteredLostCount} (${left.length} left, ${held.length} on hold)${signed(prev ? d.filteredLostCount - prev.derived.filteredLostCount : null)}`),
    bullet(`**Net change:** ${d.filteredNewCount - d.filteredLostCount}`),
    bullet(`**Churn:** ${churn != null ? `${churn}%${signed(churn != null && prevChurn != null ? churn - prevChurn : null, "pts")}: ${churnJudgment(churn)}` : "n/a (first month)"}`),
    bullet(`**Paying members this month:** ${d.totalMembers}${d.manualLost.length ? ` · marked lost by hand: ${d.manualLost.length}` : ""}`),
    heading(3, `Joined (${joined.length})`),
    ...(joined.length ? joined.map((t) => bullet(t)) : [paragraph("None.")]),
    heading(3, `Left (${left.length})`),
    ...(left.length ? left.map((t) => bullet(t)) : [paragraph("None.")]),
    heading(3, `On hold (${held.length})`),
    ...(held.length ? held.map((m) => bullet(`${shortName(m.name)}: ${money(m.amount)}/mo paused`)) : [paragraph("None.")]),

    heading(2, "Revenue (GymMaster)"),
    paragraph("GymMaster revenue only. The true total, including Venmo and Zelle, is in the P&L below."),
    bullet(`**Total:** ${money(d.totalRevenue)}${signed(prev ? d.totalRevenue - prev.derived.totalRevenue : null, "$")}`),
    bullet(`**Classes:** ${money(d.smallGroupRevenue)} · **Open gym:** ${money(d.openGymRevenue)} · **PT:** ${money(d.ptRevenue)} (mostly prepaid packages, lumpy) · **Other, net of refunds:** ${money(other)}`),
    bullet(`**From new members:** ${money(d.filteredNewRevenue)} · **Lost with leavers:** ${money(d.filteredLostRevenue)}`),
    bullet(`**ARM (revenue per member):** ${money(arm)}${signed(prevArm != null ? arm - prevArm : null, "$")}${armClasses != null ? ` · **ARM, classes:** ${money(armClasses)} over ${d.classMembers} class members` : ""}`),

    heading(2, `P&L${pnlRow ? ` (${pnlStatus})` : ""}`),
    ...(pnl
      ? [
          bullet(`**Revenue:** ${money(pnl.allRevenue)} = Stripe ${money(pnl.stripeRevenue)} (net of refunds) + other income ${money(pnl.otherIncome)}`),
          bullet(`**Expenses:** ${money(pnl.expenses)}`),
          ...(
            [
              ["Advertising & marketing", pnl.expenseBreakdown.advertisingMarketing],
              ["Contract labor", pnl.expenseBreakdown.contractLabor],
              ["Apps & software", pnl.expenseBreakdown.appsSoftware],
              ["Materials & supplies", pnl.expenseBreakdown.materialsSupplies],
              ["Liability insurance", pnl.expenseBreakdown.liabilityInsurance],
              ["Utilities", pnl.expenseBreakdown.utilities],
              ["Repairs & maintenance", pnl.expenseBreakdown.repairsMaintenance],
              ["Business licenses", pnl.expenseBreakdown.businessLicenses],
              ["Client compensation", pnl.expenseBreakdown.clientCompensation],
              ["Stripe fees", pnl.expenseBreakdown.stripeFees],
              ["Other", pnl.expenseBreakdown.other],
            ] as [string, number][]
          )
            .filter(([, v]) => v)
            .map(([label, v]) => bullet(`${label}: ${money(v)}`)),
          bullet(`**Net income:** ${money(pnl.netIncome)}${pnl.allRevenue ? ` (margin ${Math.round((pnl.netIncome / pnl.allRevenue) * 100)}%)` : ""}`),
        ]
      : [paragraph("No P&L saved for this month. Refresh it on the P&L tab, then send again.")]),
    ...(live ? liveBlocks(live, short) : []),
  ];

  const properties: Record<string, unknown> = {
    Name: { title: [{ text: { content: title } }] },
    Month: { date: { start: `${monthKey(year, month)}-01` } },
    Key: { rich_text: [{ text: { content: monthKey(year, month) } }] },
    Members: { number: d.derivedTotalMembers },
    New: { number: d.filteredNewCount },
    Lost: { number: d.filteredLostCount },
    "Churn %": { number: churn },
    "GymMaster revenue": { number: round2(d.totalRevenue) },
    ARM: { number: arm },
    "P&L revenue": { number: pnl ? round2(pnl.allRevenue) : null },
    "Net income": { number: pnl ? round2(pnl.netIncome) : null },
    KPI: { select: { name: cur.status === "finalized" ? "Final" : "Draft" } },
    "P&L": { select: { name: pnlStatus } },
    "Live views": { checkbox: !!live },
    Sent: { date: { start: new Date().toISOString() } },
  };

  const summary = `${title}: ${d.derivedTotalMembers} members, +${d.filteredNewCount}/-${d.filteredLostCount}, churn ${churn ?? "n/a"}%, GymMaster ${money(d.totalRevenue)}, KPI ${cur.status}, P&L ${pnlStatus}${pnl ? ` (net ${money(pnl.netIncome)})` : ""}, ${blocks.length} blocks${live ? ", with live views" : ""}`;
  return { key: monthKey(year, month), title, properties, blocks, summary };
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

function dataSource(): string {
  const id = process.env.NOTION_KPI_DATA_SOURCE_ID;
  if (!id) throw new Error("NOTION_KPI_DATA_SOURCE_ID is not set");
  return id;
}

/**
 * Write the month's page. Every send writes a complete NEW page (with a Version, the send's
 * millisecond timestamp), then moves every older page for that month to Notion's trash.
 * Two sends that overlap (Draft then Final a minute apart, Nov 14) can no longer clear each
 * other's content: whichever order they finish in, only the newest version is kept, and a
 * reader sees the old page until the new one is complete.
 */
export async function sendReport(report: MonthReport): Promise<{ url: string; created: boolean }> {
  const version = Date.now();
  const page = await notion<{ id: string; url: string }>("pages", "POST", {
    parent: { type: "data_source_id", data_source_id: dataSource() },
    properties: { ...report.properties, Version: { number: version } },
    children: report.blocks.slice(0, 100),
  });
  for (let i = 100; i < report.blocks.length; i += 100) await notion(`blocks/${page.id}/children`, "PATCH", { children: report.blocks.slice(i, i + 100) });

  const found = await notion<{ results: { id: string; properties: { Version?: { number: number | null } } }[] }>(`data_sources/${dataSource()}/query`, "POST", {
    filter: { property: "Key", rich_text: { equals: report.key } },
    page_size: 100,
  });
  const newest = Math.max(...found.results.map((r) => r.properties.Version?.number ?? 0));
  const stale = found.results.filter((r) => (r.properties.Version?.number ?? 0) < newest);
  for (const r of stale) await notion(`pages/${r.id}`, "PATCH", { in_trash: true });
  return { url: page.url, created: stale.length === 0 };
}

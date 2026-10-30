"use client";

import { useState } from "react";
import { UsersIcon, PhoneIcon, CopyIcon } from "./icons";
import { BillingGap, PaymentRow } from "../types";

interface PaymentsTableProps {
  members: PaymentRow[];
  onCopyPhone?: (phone: string) => void;
}

function ChevronIcon({ className, expanded }: { className?: string; expanded?: boolean }) {
  return (
    <svg
      className={`${className} transition-transform ${expanded ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function formatDate(s: string) {
  if (!s) return "";
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + "T12:00:00" : s);
  if (isNaN(d.getTime())) return s;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(s: string) {
  if (!s) return Infinity;
  return Math.round((new Date(s + "T12:00:00").getTime() - Date.now()) / 864e5);
}

const formatMoney = (n: number) => `${n < 0 ? "−" : ""}$${Math.abs(n).toFixed(2)}`;

const monthLabel = (month: string) =>
  new Date(month + "-01T12:00:00").toLocaleDateString("en-US", { month: "short" });

// An expired card alone isn't a problem while the member is paid up; no card at all is
const hasNoCard = (m: PaymentRow) => m.cardStatus === "none";
const hasUnrecoveredFailure = (m: PaymentRow) => m.ledger.some(l => l.failed.some(f => !f.recovered));
// Billed less than usual (or not at all) on a billing date, which GymMaster doesn't count as owed
const gapTotal = (m: PaymentRow) => m.billingGaps.reduce((t, g) => t + g.expected - g.charged, 0);
export const needsAttention = (m: PaymentRow) => m.owed > 0 || hasNoCard(m) || hasUnrecoveredFailure(m) || m.billingGaps.length > 0;
const isDueSoon = (m: PaymentRow) => {
  const due = daysUntil(m.nextCharge);
  return due >= 0 && due <= 7;
};

// Red: owes, no card, a failed charge never recovered, or a short/missed billing. Amber: charge due within 7 days. Green: paid up.
function borderColor(m: PaymentRow) {
  if (needsAttention(m)) return "border-l-red-500";
  if (isDueSoon(m)) return "border-l-yellow-500";
  return "border-l-green-500";
}

type LedgerEntry =
  | { kind: "charge"; date: string; amount: number; latest: boolean; recovery: boolean; expected: number | null }
  | { kind: "failed"; date: string; amount: number; reason: string; recovered: boolean }
  | { kind: "missed"; date: string; amount: number };

function ledgerEntries(member: PaymentRow): Map<string, LedgerEntry[]> {
  const charges = member.ledger.flatMap(m => m.charges);
  const latestDate = [...charges].reverse().find(c => c.amount > 0)?.date;

  // The first payment on/after each recovered failure is the recovery
  const recoveryDates = new Set<string>();
  for (const f of member.ledger.flatMap(m => m.failed)) {
    if (!f.recovered) continue;
    const hit = charges.find(c => c.amount > 0 && c.date >= f.date);
    if (hit) recoveryDates.add(hit.date);
  }

  // Short billings read on the charge that came in low; missed ones get a row on their billing date
  const shortOn = new Map(member.billingGaps.filter(g => g.chargedOn).map(g => [g.chargedOn!, g.expected]));
  const missed = member.billingGaps.filter(g => g.kind === "missed");

  const byMonth = new Map<string, LedgerEntry[]>();
  for (const { month, charges: cs, failed } of member.ledger) {
    const entries: LedgerEntry[] = [
      ...cs.map(c => ({
        kind: "charge" as const,
        ...c,
        latest: c.date === latestDate,
        recovery: recoveryDates.has(c.date),
        expected: shortOn.get(c.date) ?? null,
      })),
      ...failed.map(f => ({ kind: "failed" as const, ...f })),
      ...missed.filter(g => g.date.startsWith(month)).map(g => ({ kind: "missed" as const, date: g.date, amount: g.expected })),
    ];
    // Same day: the failed attempt reads before the payment that followed it
    entries.sort((x, y) => x.date.localeCompare(y.date) || (x.kind === "failed" ? -1 : 1));
    byMonth.set(month, entries);
  }
  return byMonth;
}

function Ledger({ member }: { member: PaymentRow }) {
  const entriesByMonth = ledgerEntries(member);
  const startMonth = member.startDate.slice(0, 7);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-4">
      {member.ledger.map(({ month, charges }) => {
        const entries = entriesByMonth.get(month) || [];
        const total = charges.reduce((t, c) => t + c.amount, 0);
        const beforeStart = !!startMonth && month < startMonth;
        return (
          <div key={month}>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-1.5 mb-2">
              {monthLabel(month)}
            </div>
            {!entries.length && (
              <div className={`text-sm ${beforeStart ? "text-gray-400" : "text-yellow-700 font-medium"}`}>
                {beforeStart ? "Not started" : "No charges"}
              </div>
            )}
            <div className="space-y-1.5">
              {entries.map(e => {
                if (e.kind === "missed") {
                  return (
                    <div key={`m-${e.date}`} className="grid grid-cols-[4rem_1fr_auto] items-baseline gap-2 text-sm text-orange-700">
                      <span>{formatDate(e.date)}</span>
                      <span className="text-xs font-medium">Missed · not charged</span>
                      <span className="tabular-nums">{formatMoney(e.amount)} due</span>
                    </div>
                  );
                }
                if (e.kind === "failed") {
                  const tone = e.recovered ? "text-gray-500" : "text-red-600";
                  return (
                    <div key={`f-${e.date}-${e.amount}`} className={`grid grid-cols-[4rem_1fr_auto] items-baseline gap-2 text-sm ${tone}`}>
                      <span>{formatDate(e.date)}</span>
                      <span className="text-xs">Failed · {e.reason}</span>
                      <span className="tabular-nums line-through">{formatMoney(e.amount)}</span>
                    </div>
                  );
                }
                const tone = e.amount < 0 ? "text-red-600" : "text-gray-900";
                return (
                  <div
                    key={`c-${e.date}`}
                    className={`relative grid grid-cols-[4rem_1fr_auto] items-baseline gap-2 text-sm ${tone}`}
                    title={e.latest ? "Most recent charge" : undefined}
                  >
                    {e.latest && <span className="absolute -left-3 top-1.5 w-1.5 h-1.5 rounded-full bg-gray-400" />}
                    <span className={e.latest ? "" : "text-gray-600"}>{formatDate(e.date)}</span>
                    <span className="text-xs">
                      {e.recovery && <span className="text-green-700">Recovered</span>}
                      {e.amount < 0 && <span className="text-red-600">Refund</span>}
                      {e.expected !== null && <span className="font-medium text-orange-700">Short</span>}
                    </span>
                    <span className={`tabular-nums ${e.latest ? "font-semibold" : ""}`}>
                      {formatMoney(e.amount)}
                      {e.expected !== null && <span className="font-normal text-orange-700"> of {formatMoney(e.expected)}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
            {charges.length > 1 && (
              <div className="grid grid-cols-[4rem_1fr_auto] gap-2 text-sm border-t border-gray-200 mt-2 pt-1.5">
                <span className="text-gray-500">Total</span>
                <span />
                <span className="tabular-nums font-medium text-gray-900">{formatMoney(total)}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Why the balance exists: the most recent failed attempt that was never recovered
function OwesStrip({ member }: { member: PaymentRow }) {
  const unrecovered = member.ledger.flatMap(m => m.failed).filter(f => !f.recovered);
  const last = unrecovered[unrecovered.length - 1];
  return (
    <div className="inline-flex flex-wrap items-baseline gap-x-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700">
      <span className="font-semibold">Owes {formatMoney(member.owed)}</span>
      <span>·</span>
      {last ? (
        <span>
          {formatDate(last.date)} · {formatMoney(last.amount)} failed — {last.reason}, not retried
          {unrecovered.length > 1 && ` (${unrecovered.length} unrecovered failures)`}
        </span>
      ) : (
        <span>no failed card charge on record in Stripe</span>
      )}
    </div>
  );
}

const gapLabel = (m: PaymentRow) => `${m.billingGaps.every(g => g.kind === "missed") ? "Missed" : "Short"} ${formatMoney(gapTotal(m))}`;

function gapDetail(g: BillingGap) {
  return g.kind === "missed"
    ? `${formatDate(g.date)} billing never ran, no failed attempt in Stripe (usually ${formatMoney(g.expected)})`
    : `${formatDate(g.chargedOn!)} charged ${formatMoney(g.charged)}, usually ${formatMoney(g.expected)}`;
}

// Why a member GymMaster calls paid up is still short
function GapStrip({ member }: { member: PaymentRow }) {
  return (
    <div className="inline-flex flex-wrap items-baseline gap-x-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-1.5 text-sm text-orange-800">
      <span className="font-semibold">{gapLabel(member)}</span>
      <span>·</span>
      <span>{member.billingGaps.map(gapDetail).join("; ")}</span>
      {member.owed === 0 && (
        <>
          <span>·</span>
          <span>GymMaster shows $0 owed</span>
        </>
      )}
    </div>
  );
}

function PaymentMemberRow({
  member,
  paysFor,
  onCopyPhone,
}: {
  member: PaymentRow;
  paysFor: string[]; // members whose membership this member's card pays for
  onCopyPhone?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const owes = member.owed > 0;
  const short = member.billingGaps.length > 0;

  return (
    // Row dividers set per side: divide-y's border-color would override the status color on the left edge
    <div className={`border-l-4 ${borderColor(member)} border-t border-t-gray-100 first:border-t-0`}>
      {/* Main row */}
      <div
        className="flex flex-wrap md:flex-nowrap items-center gap-y-2 hover:bg-gray-50 py-3 px-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-6 flex-shrink-0 mr-2">
          <ChevronIcon className="w-4 h-4 text-gray-400" expanded={expanded} />
        </div>

        {/* Member info */}
        <div className="flex-1 basis-[calc(100%-2rem)] md:basis-0 min-w-0">
          <div className="font-medium text-gray-900">{member.name}</div>
        </div>

        {/* Balance */}
        <div className="ml-8 md:ml-0 md:w-32 flex-shrink-0 md:px-2">
          <span
            className={`inline-block px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
              owes
                ? "bg-red-100 text-red-700"
                : short
                  ? "bg-orange-100 text-orange-700"
                  : member.paidBy
                    ? "bg-gray-100 text-gray-700"
                    : "bg-green-100 text-green-700"
            }`}
          >
            {owes
              ? `Owes ${formatMoney(member.owed)}`
              : short
                ? gapLabel(member)
                : member.paidBy
                  ? `Paid by ${member.paidBy.name.split(",")[1]?.trim() || member.paidBy.name}`
                  : "Paid up"}
          </span>
        </div>

        {/* Plan price per month */}
        <div className="md:w-28 flex-shrink-0 pl-2 md:pl-0">
          <span className="inline-block px-2 py-1 rounded text-xs font-medium whitespace-nowrap bg-gray-100 text-gray-700">{member.planPrice || "No plan price"}</span>
        </div>

        {/* Next charge */}
        <div className="pl-3 md:pl-0 md:w-28 md:text-center flex-shrink-0">
          {member.nextCharge ? (
            <div className="flex items-baseline gap-1 md:block">
              <div className={`text-sm font-semibold ${isDueSoon(member) ? "text-yellow-600" : "text-gray-900"}`}>
                {formatDate(member.nextCharge)}
              </div>
              <div className="text-xs text-gray-400">next charge</div>
            </div>
          ) : (
            <div className="text-xs text-gray-400">No charge scheduled</div>
          )}
        </div>

        {/* Phone & Actions */}
        <div
          className="w-full md:w-56 ml-8 md:ml-0 flex-shrink-0 flex items-center justify-start md:justify-end gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {member.phone ? (
            <>
              <span className="text-sm text-gray-600 whitespace-nowrap">{member.phone}</span>
              <button
                onClick={onCopyPhone}
                className="p-3 md:p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                title="Copy phone number"
              >
                <CopyIcon className="w-4 h-4" />
              </button>
              <a
                href={`tel:${member.phone.replace(/[^\d]/g, "")}`}
                className="flex items-center gap-1.5 px-4 py-2.5 md:px-3 md:py-1.5 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-800 transition-colors"
              >
                <PhoneIcon className="w-3.5 h-3.5" />
                Call
              </a>
            </>
          ) : (
            <span className="text-sm text-gray-400 italic">No phone</span>
          )}
        </div>
      </div>

      {/* Expanded detail view */}
      {expanded && (
        <div className="bg-gray-50 px-4 pt-4 pb-4 border-t border-gray-100">
          <div className="ml-8 space-y-4">
            {member.paidBy ? (
              <div className="text-sm text-gray-600">
                Billed to {member.paidBy.name}&apos;s card. Their charges, including this membership, are on {member.paidBy.name}&apos;s row.
              </div>
            ) : (
              <Ledger member={member} />
            )}

            {owes && <OwesStrip member={member} />}
            {short && <GapStrip member={member} />}

            <div className="flex flex-wrap gap-x-10 gap-y-2 text-sm">
              {[
                ["Plan price", member.price],
                ["Fee charged", member.feeCharged],
                ["Billed every", member.frequency],
                ["Started", formatDate(member.startDate)],
                ["Next charge", formatDate(member.nextCharge)],
                ...(paysFor.length ? [["Also pays for", paysFor.join(", ")]] : []),
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs text-gray-500">{label}</div>
                  <div className="text-gray-900">{value || "—"}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentBlock({
  title,
  members,
  paysFor,
  onCopyPhone,
  defaultOpen = true,
}: {
  title: string;
  members: PaymentRow[];
  paysFor: Map<string, string[]>;
  onCopyPhone?: (phone: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-lg border border-gray-200 mb-6">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full px-4 py-3 text-left hover:bg-gray-50 ${open ? "border-b border-gray-100" : ""}`}
      >
        <div className="flex items-center gap-3">
          <UsersIcon className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-gray-900">{title}</span>
          <span className="text-sm font-medium text-gray-700">{members.length}</span>
          <ChevronIcon className="w-4 h-4 text-gray-400 ml-auto" expanded={open} />
        </div>
      </button>
      {!open ? null : members.length ? (
        <div>
          {members.map(member => (
            <PaymentMemberRow
              key={member.memberId}
              member={member}
              paysFor={paysFor.get(member.memberId) || []}
              onCopyPhone={() => member.phone && onCopyPhone?.(member.phone)}
            />
          ))}
        </div>
      ) : (
        <div className="px-4 py-8 text-center text-gray-500">Nothing here.</div>
      )}
    </div>
  );
}

export function PaymentsTable({ members, onCopyPhone }: PaymentsTableProps) {
  // Problems first: biggest balance, then biggest short/missed billing, then card problems. Paid up: soonest charge first.
  const attention = members
    .filter(needsAttention)
    .sort(
      (a, b) =>
        b.owed - a.owed ||
        gapTotal(b) - gapTotal(a) ||
        Number(hasNoCard(b)) - Number(hasNoCard(a)) ||
        a.name.localeCompare(b.name)
    );
  const paidUp = members
    .filter(m => !needsAttention(m))
    .sort((a, b) => (a.nextCharge || "9999").localeCompare(b.nextCharge || "9999") || a.name.localeCompare(b.name));

  // Payer → members they pay for
  const paysFor = new Map<string, string[]>();
  for (const m of members) {
    if (m.paidBy) paysFor.set(m.paidBy.memberId, [...(paysFor.get(m.paidBy.memberId) || []), m.name]);
  }

  return (
    <div className="space-y-6">
      <PaymentBlock title="Needs attention" members={attention} paysFor={paysFor} onCopyPhone={onCopyPhone} />
      <PaymentBlock title="Paid up" members={paidUp} paysFor={paysFor} onCopyPhone={onCopyPhone} defaultOpen={false} />
    </div>
  );
}

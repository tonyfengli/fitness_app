import * as Papa from "papaparse";

export interface MemberOnHold {
  memberId: string;
  name: string;
  holdStartDate: string;
  holdEndDate: string;
  holdLength: string;
  suspensionCost: number;
  holdFee: string; // "FREE", "SETUPFEE", etc.
  reason: string;
  fullCost: number;
  // Calculated fields
  daysInPeriod: number; // Days of hold that overlap with reporting period
  hadPaymentInPeriod: boolean;
  paymentAmount: number;
  // From Current Members lookup
  membershipFee: number; // Their normal monthly fee
  revenueLost: number; // membershipFee - paymentAmount
}

export interface MembersOnHoldResult {
  membersOnHold: MemberOnHold[];
  totalCount: number;

  // For template
  freezeCount: number; // Members frozen during the period
  estimatedRevenueLost: number; // Sum of Full Cost (approximation)

  // Breakdown by hold fee type
  freeHolds: number;
  paidHolds: number;

  // Members who paid despite being on hold
  membersWhoPaid: MemberOnHold[];

  reportingPeriod: { start: string; end: string };
}

interface MembersOnHoldRow {
  "Member ID": string;
  "Member Name": string;
  "Date Hold Starts": string;
  "Date Hold Ends": string;
  "Hold Length": string;
  "Suspension Cost": string;
  "One Off Fee": string;
  "Hold Fee": string;
  "Reason": string;
  "Full Cost": string;
  "Fees Frozen": string;
  "Entry Allowed": string;
  "Extends Membership": string;
  "Prorata": string;
  "Company ID": string;
  "Date Created": string;
  "Member Billing Comment": string;
}

interface AllPaymentsRow {
  "Member ID": string;
  "Payment Amount": string;
  "Payment Details": string;
}

interface CurrentMembersRow {
  "Member ID": string;
  "Member Name": string;
  "Membership Fee": string;
}

export async function parseMembersOnHold(
  membersOnHoldCsv: string,
  allPaymentsCsv: string,
  currentMembersCsv: string
): Promise<MembersOnHoldResult> {
  console.log("=== parseMembersOnHold DEBUG ===");

  // Step 1: Parse All Payments - build map of Member ID -> total paid
  const paymentsByMemberId = new Map<string, number>();

  await new Promise<void>((resolve) => {
    Papa.parse<AllPaymentsRow>(allPaymentsCsv, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        for (const row of results.data) {
          const memberId = row["Member ID"] || "";
          const amount = parseFloat(row["Payment Amount"]?.replace(/[^0-9.-]/g, "") || "0") || 0;
          const details = row["Payment Details"] || "";

          if (details.includes("Payment Refund")) continue;

          if (memberId) {
            const current = paymentsByMemberId.get(memberId) || 0;
            paymentsByMemberId.set(memberId, current + amount);
          }
        }
        console.log("paymentsByMemberId size:", paymentsByMemberId.size);
        resolve();
      },
    });
  });

  // Step 1.5: Parse Current Members - build map of Member ID -> membership fee
  const membershipFeeByMemberId = new Map<string, number>();

  await new Promise<void>((resolve) => {
    Papa.parse<CurrentMembersRow>(currentMembersCsv, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        for (const row of results.data) {
          const memberId = row["Member ID"] || "";
          const fee = parseFloat(row["Membership Fee"]?.replace(/[^0-9.-]/g, "") || "0") || 0;

          if (memberId && fee > 0) {
            membershipFeeByMemberId.set(memberId, fee);
          }
        }
        console.log("membershipFeeByMemberId size:", membershipFeeByMemberId.size);
        resolve();
      },
    });
  });

  // Step 2: Parse Members on Hold
  const membersOnHold: MemberOnHold[] = [];
  let reportingPeriod = { start: "", end: "" };

  await new Promise<void>((resolve) => {
    Papa.parse<MembersOnHoldRow>(membersOnHoldCsv, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        console.log("Members on Hold parsed rows:", results.data.length);

        // Detect reporting period from hold dates
        const allDates = results.data
          .flatMap(row => [row["Date Hold Starts"], row["Date Hold Ends"]])
          .filter(Boolean)
          .sort();

        if (allDates.length > 0) {
          // Infer the reporting month from the data
          // Look for the most common month in the dates
          const firstDate = allDates[0];
          const match = firstDate?.match(/^(\d{4})-(\d{2})/);
          if (match) {
            const [, year, month] = match;
            const lastDay = new Date(parseInt(year!), parseInt(month!), 0).getDate();
            reportingPeriod = {
              start: `${year}-${month}-01`,
              end: `${year}-${month}-${lastDay.toString().padStart(2, '0')}`
            };
          }
        }
        console.log("Reporting period:", reportingPeriod);

        for (const row of results.data) {
          const memberId = row["Member ID"] || "";
          const name = row["Member Name"] || "";
          const holdStartDate = row["Date Hold Starts"] || "";
          const holdEndDate = row["Date Hold Ends"] || "";
          const holdLength = row["Hold Length"] || "";
          const suspensionCost = parseFloat(row["Suspension Cost"]?.replace(/[^0-9.-]/g, "") || "0") || 0;
          const holdFee = row["Hold Fee"] || "";
          const reason = row["Reason"] || "";
          const fullCost = parseFloat(row["Full Cost"]?.replace(/[^0-9.-]/g, "") || "0") || 0;

          // Calculate days of hold that overlap with reporting period
          const daysInPeriod = calculateOverlapDays(
            holdStartDate,
            holdEndDate,
            reportingPeriod.start,
            reportingPeriod.end
          );

          // Check if they made payments
          const paymentAmount = paymentsByMemberId.get(memberId) || 0;
          const hadPaymentInPeriod = paymentAmount > 0;

          // Look up their normal membership fee from Current Members
          const membershipFee = membershipFeeByMemberId.get(memberId) || 0;
          // Revenue lost = what they should pay - what they actually paid
          const revenueLost = daysInPeriod > 0 ? Math.max(0, membershipFee - paymentAmount) : 0;

          console.log(`Processing: ${name} (${memberId})`);
          console.log(`  Hold: ${holdStartDate} to ${holdEndDate} (${holdLength})`);
          console.log(`  Days in period: ${daysInPeriod}`);
          console.log(`  Membership fee: $${membershipFee}, Payment: $${paymentAmount}, Lost: $${revenueLost}`);

          membersOnHold.push({
            memberId,
            name,
            holdStartDate,
            holdEndDate,
            holdLength,
            suspensionCost,
            holdFee,
            reason,
            fullCost,
            daysInPeriod,
            hadPaymentInPeriod,
            paymentAmount,
            membershipFee,
            revenueLost,
          });
        }

        resolve();
      },
    });
  });

  // Calculate summary stats
  const freezeCount = membersOnHold.filter(m => m.daysInPeriod > 0).length;
  // Sum up actual revenue lost (membershipFee - paymentAmount for each frozen member)
  const estimatedRevenueLost = membersOnHold
    .filter(m => m.daysInPeriod > 0)
    .reduce((sum, m) => sum + m.revenueLost, 0);

  const freeHolds = membersOnHold.filter(m => m.holdFee === "FREE").length;
  const paidHolds = membersOnHold.filter(m => m.holdFee !== "FREE" && m.holdFee !== "").length;

  const membersWhoPaid = membersOnHold.filter(m => m.hadPaymentInPeriod);

  console.log("=== MEMBERS ON HOLD RESULTS ===");
  console.log("Total count:", membersOnHold.length);
  console.log("Freeze count (in period):", freezeCount);
  console.log("Estimated revenue lost:", estimatedRevenueLost);
  console.log("Members who paid despite hold:", membersWhoPaid.length);

  return {
    membersOnHold,
    totalCount: membersOnHold.length,
    freezeCount,
    estimatedRevenueLost,
    freeHolds,
    paidHolds,
    membersWhoPaid,
    reportingPeriod,
  };
}

/**
 * Calculate the number of days that two date ranges overlap
 */
function calculateOverlapDays(
  holdStart: string,
  holdEnd: string,
  periodStart: string,
  periodEnd: string
): number {
  if (!holdStart || !holdEnd || !periodStart || !periodEnd) return 0;

  const hStart = new Date(holdStart);
  const hEnd = new Date(holdEnd);
  const pStart = new Date(periodStart);
  const pEnd = new Date(periodEnd);

  // Find the overlap
  const overlapStart = hStart > pStart ? hStart : pStart;
  const overlapEnd = hEnd < pEnd ? hEnd : pEnd;

  // Calculate days
  const diffTime = overlapEnd.getTime() - overlapStart.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays + 1 : 0; // +1 to include both start and end days
}

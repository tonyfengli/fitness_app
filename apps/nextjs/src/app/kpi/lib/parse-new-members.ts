import * as Papa from "papaparse";

export interface ConfirmedNewMember {
  memberId: string;
  name: string;
  membershipType: string;
  joiningDate: string;
  paidAmount: number;
}

export interface NewMembersResult {
  confirmedNewMembers: ConfirmedNewMember[];
  totalRevenue: number;
  excludedNoPayment: number;
  excludedJoinedBeforePeriod: number;
  excludedHadPreviousPaid: number;
  reportingPeriod: { start: string; end: string };
}

interface NewMembersRow {
  "Member ID": string;
  "Member Name": string;
  "Member Joining Date": string;
  "Membership Start Date": string;
  "Membership Type Name": string;
}

interface AllPaymentsRow {
  "Member ID": string;
  "Payment Amount": string;
  "Payment Details": string;
}

interface CurrentMembersRow {
  "Member ID": string;
  "Member Name": string;
  "All Memberships": string;
}

export async function parseNewMembers(
  newMembersCsv: string,
  allPaymentsCsv: string,
  currentMembersCsv: string
): Promise<NewMembersResult> {
  console.log("=== parseNewMembers DEBUG ===");
  console.log("newMembersCsv length:", newMembersCsv.length);
  console.log("allPaymentsCsv length:", allPaymentsCsv.length);
  console.log("currentMembersCsv length:", currentMembersCsv.length);

  // Detect reporting period from the New Members data
  let reportingPeriod = { start: "", end: "" };

  // Step 1: Parse All Payments - build map of Member ID -> total paid
  const paymentsByMemberId = new Map<string, number>();

  await new Promise<void>((resolve) => {
    Papa.parse<AllPaymentsRow>(allPaymentsCsv, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        console.log("All Payments parsed rows:", results.data.length);

        for (const row of results.data) {
          const memberId = row["Member ID"] || "";
          const amount = parseFloat(row["Payment Amount"]?.replace(/[^0-9.-]/g, "") || "0") || 0;
          const details = row["Payment Details"] || "";

          // Let refunds net out naturally (don't skip negative amounts)

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

  // Step 2: Parse Current Members - build map of Member ID -> All Memberships history
  const membershipHistoryById = new Map<string, string>();

  await new Promise<void>((resolve) => {
    Papa.parse<CurrentMembersRow>(currentMembersCsv, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        console.log("Current Members parsed rows:", results.data.length);

        for (const row of results.data) {
          const memberId = row["Member ID"] || "";
          const allMemberships = row["All Memberships"] || "";

          if (memberId) {
            membershipHistoryById.set(memberId, allMemberships);
          }
        }
        console.log("membershipHistoryById size:", membershipHistoryById.size);
        resolve();
      },
    });
  });

  // Step 3: Parse New Members and apply cross-validation logic
  const confirmedNewMembers: ConfirmedNewMember[] = [];
  let excludedNoPayment = 0;
  let excludedJoinedBeforePeriod = 0;
  let excludedHadPreviousPaid = 0;
  const seenMemberIds = new Set<string>();

  await new Promise<void>((resolve) => {
    Papa.parse<NewMembersRow>(newMembersCsv, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        console.log("New Members parsed rows:", results.data.length);
        console.log("New Members headers:", results.meta.fields);
        if (results.data[0]) {
          console.log("New Members first row:", results.data[0]);
        }

        // Detect reporting period from member joining dates (not start dates, which can be backdated)
        const joiningDates = results.data
          .map(row => row["Member Joining Date"])
          .filter(Boolean)
          .sort();

        if (joiningDates.length > 0) {
          // Get year and month from most common month to determine reporting period
          const firstDate = joiningDates[0];
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
        console.log("Detected reporting period:", reportingPeriod);

        for (const row of results.data) {
          const memberId = row["Member ID"] || "";
          const name = row["Member Name"] || "";
          const membershipType = row["Membership Type Name"] || "";
          const joiningDate = row["Member Joining Date"] || "";

          console.log(`Processing: ${name} (${memberId}), Joining Date: "${joiningDate}"`);

          // Skip if already processed (dedupe)
          if (seenMemberIds.has(memberId)) {
            console.log(`  -> Skipped (duplicate)`);
            continue;
          }
          seenMemberIds.add(memberId);

          // Check 1: Member Joining Date must be within reporting period
          if (!isDateInPeriod(joiningDate, reportingPeriod.start, reportingPeriod.end)) {
            console.log(`  -> Excluded: joined before period (${joiningDate} not in ${reportingPeriod.start} to ${reportingPeriod.end})`);
            excludedJoinedBeforePeriod++;
            continue;
          }

          // Check 2: Must have actually paid (in All Payments)
          const paidAmount = paymentsByMemberId.get(memberId) || 0;
          if (paidAmount <= 0) {
            console.log(`  -> Excluded: no payment found`);
            excludedNoPayment++;
            continue;
          }

          // Check 3: Must not have previous PAID memberships (only trials allowed)
          const membershipHistory = membershipHistoryById.get(memberId) || "";
          if (hasPreviousPaidMembership(membershipHistory)) {
            console.log(`  -> Excluded: had previous paid membership. History: ${membershipHistory}`);
            excludedHadPreviousPaid++;
            continue;
          }

          console.log(`  -> CONFIRMED NEW MEMBER! Paid: $${paidAmount}`);
          // Passed all checks - truly a new member
          confirmedNewMembers.push({
            memberId,
            name,
            membershipType,
            joiningDate,
            paidAmount,
          });
        }

        console.log("=== FINAL RESULTS ===");
        console.log("confirmedNewMembers:", confirmedNewMembers.length);
        console.log("excludedJoinedBeforePeriod:", excludedJoinedBeforePeriod);
        console.log("excludedNoPayment:", excludedNoPayment);
        console.log("excludedHadPreviousPaid:", excludedHadPreviousPaid);
        resolve();
      },
    });
  });

  const totalRevenue = confirmedNewMembers.reduce((sum, m) => sum + m.paidAmount, 0);

  return {
    confirmedNewMembers,
    totalRevenue,
    excludedNoPayment,
    excludedJoinedBeforePeriod,
    excludedHadPreviousPaid,
    reportingPeriod,
  };
}

/**
 * Check if a date string (YYYY-MM-DD) is within the given period
 */
function isDateInPeriod(dateStr: string, periodStart: string, periodEnd: string): boolean {
  if (!dateStr || !periodStart || !periodEnd) return false;

  // Compare as strings since they're in YYYY-MM-DD format
  return dateStr >= periodStart && dateStr <= periodEnd;
}

/**
 * Check if member has previous PAID memberships (not just trials)
 * Returns true if they had a paid membership that ended
 */
function hasPreviousPaidMembership(allMemberships: string): boolean {
  if (!allMemberships) return false;

  // Split by comma to get individual memberships
  const memberships = allMemberships.split(",").map((m) => m.trim());

  // Trial patterns to exclude
  const trialPatterns = [
    "Trial",
    "Free",
    "Waiver",
    "Liability",
  ];

  for (const membership of memberships) {
    // Check if this membership ended
    const hasEnded = membership.includes("[ended");

    if (hasEnded) {
      // Check if it's NOT a trial
      const isTrial = trialPatterns.some((pattern) =>
        membership.toLowerCase().includes(pattern.toLowerCase())
      );

      if (!isTrial) {
        // This is a previous PAID membership that ended
        return true;
      }
    }
  }

  return false;
}

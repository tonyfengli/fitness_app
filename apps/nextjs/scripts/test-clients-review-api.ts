/**
 * Test the updated Clients Needing Review API
 * Run: npx tsx scripts/test-clients-review-api.ts
 */

import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, "../.env.local") });

async function fetchReport(reportId: number, startDate: string, endDate: string) {
  const baseUrl = process.env.GYMMASTER_BASE_URL;
  const apiKey = process.env.GYMMASTER_REPORT_API_KEY;

  const response = await fetch(`${baseUrl}/api/v2/report/standard_report`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-GM-API-KEY": apiKey!,
    },
    body: JSON.stringify({
      report_id: reportId,
      start_date: startDate,
      end_date: endDate,
    }),
  });

  const data = await response.json();
  return data.result || [];
}

async function main() {
  console.log("=".repeat(80));
  console.log("TESTING CLIENTS NEEDING REVIEW - CURRENT MEMBERS FILTER");
  console.log("=".repeat(80));

  // Fetch current members for October
  const currentMembers = await fetchReport(1, "2026-10-01", "2026-10-31");

  console.log(`\nCurrent Members (Report 1): ${currentMembers.length} members`);

  // Show a few sample current members
  console.log("\nSample current members:");
  for (let i = 0; i < Math.min(5, currentMembers.length); i++) {
    const m = currentMembers[i];
    console.log(`  - ${m["Member Name"]} (ID: ${m["Member ID"]}) - ${m["Membership Type Name"]} - $${m["Membership Fee"]}`);
  }

  // Check which of the 18 flagged members from before are still current members
  const flaggedMemberIds = [
    "322744", // Balvas, Sam
    "322752", // Palencia, Neftali
    "322746", // Bursey, Laura
    "323067", // Lovo, Reneil
    "322768", // Estrada, Roger
    "323251", // Atkins, Shanta
    "323515", // Vargas, Edgar
    "323492", // Contreras, Rebecca
    "323888", // Shiao, Bruce
    "322714", // Maciel, Veronica
    "322839", // Baez Gonzalez, Vanessa
    "322996", // Villeda, Ruby
    "322800", // Downton, Vanessa
    "323035", // Oviedo, Lexi
    "322747", // Martinez, Elisabeth
    "323249", // Estrada, Rosa
    "323462", // Jones, Sonja
    "322750", // Erdtsieck, Jacob
  ];

  const currentMemberIds = new Set(currentMembers.map((m: any) => String(m["Member ID"])));

  console.log("\n" + "=".repeat(80));
  console.log("FILTERING: Which of the 18 flagged are CURRENT members?");
  console.log("=".repeat(80));

  let stillCurrent = 0;
  let notCurrent = 0;

  for (const id of flaggedMemberIds) {
    const isCurrent = currentMemberIds.has(id);
    const member = currentMembers.find((m: any) => String(m["Member ID"]) === id);

    if (isCurrent) {
      stillCurrent++;
      console.log(`✅ ${id}: ${member?.["Member Name"]} - CURRENT (${member?.["Membership Type Name"]})`);
    } else {
      notCurrent++;
      console.log(`❌ ${id}: NOT a current member`);
    }
  }

  console.log("\n" + "─".repeat(80));
  console.log(`SUMMARY:`);
  console.log(`  Current members: ${stillCurrent}`);
  console.log(`  Not current: ${notCurrent}`);
  console.log(`  Original flagged: ${flaggedMemberIds.length}`);
  console.log(`  Reduction: ${flaggedMemberIds.length} → ${stillCurrent} (${Math.round((1 - stillCurrent/flaggedMemberIds.length) * 100)}% fewer)`);

  console.log("\n");
}

main().catch(console.error);

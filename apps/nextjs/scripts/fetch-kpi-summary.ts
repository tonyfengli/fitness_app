import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, "../.env.local") });

import { fetchKpiReportsAsCsv } from "../src/app/kpi/lib/gymmaster-api";
import { calculateNewMembers } from "../src/app/kpi/lib/calculate-new-members";
import { calculateLostMembers } from "../src/app/kpi/lib/calculate-lost-members";

function parseCsv(csv: string): Record<string, string>[] {
  if (!csv.trim()) return [];
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0]!.split(",").map(h => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === "," && !inQuotes) { values.push(current.trim()); current = ""; }
      else current += char;
    }
    values.push(current.trim());
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) row[headers[j]!] = values[j] || "";
    rows.push(row);
  }
  return rows;
}

function parsePayments(csv: string) {
  const rows = parseCsv(csv);
  let pt = 0, smallGrp = 0, total = 0;
  const members = new Set<string>();
  
  for (const row of rows) {
    const memberId = row["Member ID"] || "";
    const amount = parseFloat((row["Payment Amount"] || "0").replace(/[$,]/g, "")) || 0;
    const details = row["Payment Details"] || "";
    
    if (memberId && amount > 0) members.add(memberId);
    total += amount;
    
    if (details.includes("Personal Training")) pt += amount;
    else if (details.includes("Small Group")) smallGrp += amount;
  }
  
  return { pt, smallGrp, total, memberCount: members.size };
}

async function main() {
  const months = [7, 8, 9];
  const monthNames = ["July", "August", "September"];
  
  for (let i = 0; i < months.length; i++) {
    const month = months[i];
    await new Promise(r => setTimeout(r, 2000));
    
    const data = await fetchKpiReportsAsCsv(2026, month);
    
    const payments = parsePayments(data.current.allPaymentsCsv);
    const newMembers = calculateNewMembers(
      data.current.allPaymentsCsv,
      data.previous.allPaymentsCsv,
      data.previous2.allPaymentsCsv
    );
    const lostMembers = calculateLostMembers(
      data.current.allPaymentsCsv,
      data.previous.allPaymentsCsv,
      data.previous2.allPaymentsCsv,
      data.current.currentMembersCsv,
      data.previous.currentMembersCsv,
      data.current.membersOnHoldCsv,
      data.previous.membersOnHoldCsv
    );
    
    const arm = payments.memberCount > 0 ? payments.total / payments.memberCount : 0;
    
    console.log(`=== ${monthNames[i]} 2026 ===`);
    console.log(`PT Revenue: $${payments.pt.toFixed(2)}`);
    console.log(`Small Group Revenue: $${payments.smallGrp.toFixed(2)}`);
    console.log(`New Group Members: ${newMembers.groupMemberCount} ($${newMembers.groupMemberRevenue.toFixed(2)})`);
    console.log(`New PT Clients: ${newMembers.ptClientCount} ($${newMembers.ptClientRevenue.toFixed(2)})`);
    console.log(`Lost Group Members: ${lostMembers.lostGroupCount} ($${lostMembers.lostGroupRevenue.toFixed(2)}/mo)`);
    console.log(`Lost PT Clients: ${lostMembers.lostPtCount} ($${lostMembers.lostPtRevenue.toFixed(2)}/mo)`);
    console.log(`Newly On Hold: ${lostMembers.newlyOnHoldCount} ($${lostMembers.newlyOnHoldRevenue.toFixed(2)}/mo)`);
    console.log(`Total Paying Members: ${payments.memberCount}`);
    console.log(`Total Revenue: $${payments.total.toFixed(2)}`);
    console.log(`ARM: $${arm.toFixed(2)}`);
    console.log("");
  }
}

main().catch(console.error);

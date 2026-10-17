/**
 * Debug endpoint to check GymMaster CURRENT_MEMBERS fields
 */

import { NextResponse } from "next/server";

export async function GET() {
  const baseUrl = process.env.GYMMASTER_BASE_URL;
  const apiKey = process.env.GYMMASTER_REPORT_API_KEY;

  if (!baseUrl || !apiKey) {
    return NextResponse.json({ error: "Missing GymMaster config" }, { status: 500 });
  }

  try {
    const response = await fetch(`${baseUrl}/api/v2/report/standard_report`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-GM-API-KEY": apiKey,
      },
      body: JSON.stringify({
        report_id: 1, // CURRENT_MEMBERS
        start_date: "2026-01-01",
        end_date: "2026-12-31",
      }),
    });

    if (!response.ok) {
      return NextResponse.json({
        error: `API error: ${response.status}`,
        text: await response.text()
      }, { status: response.status });
    }

    const data = await response.json();
    const members = data.result || [];

    // Get columns and sample data
    const columns = members.length > 0 ? Object.keys(members[0]).filter(k => !k.startsWith('sorted_')) : [];

    // Find members with billing comments
    const withBillingComment = members.filter((m: Record<string, any>) => m["Member Billing Comment"]);

    const sample = members.slice(0, 3).map((m: Record<string, any>) => {
      const clean: Record<string, any> = {};
      for (const [k, v] of Object.entries(m)) {
        if (!k.startsWith('sorted_') && v) {
          clean[k] = v;
        }
      }
      return clean;
    });

    return NextResponse.json({
      totalMembers: members.length,
      columns,
      sample,
      membersWithBillingComment: withBillingComment.map((m: Record<string, any>) => ({
        name: m["Member Name"],
        billingComment: m["Member Billing Comment"],
      })),
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Failed"
    }, { status: 500 });
  }
}

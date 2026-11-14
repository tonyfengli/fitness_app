/**
 * One-time setup: the Notion "Monthly KPIs" database (lib/kpi-notion.ts), under a page shared
 * with the "Chief of Staff" integration. Prints the data source id to set as
 * NOTION_KPI_DATA_SOURCE_ID (in .env.local and on Vercel).
 *
 *   npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/create-kpi-notion-db.ts <parent page URL or id>
 */

import { notion } from "~/lib/notion";

const parent = /[0-9a-f]{32}(?=[^0-9a-f]*$)/i.exec((process.argv[2] ?? "").split("?")[0]!.replace(/-/g, ""))?.[0];
if (!parent) {
  console.error("Usage: create-kpi-notion-db.ts <parent page URL or id>");
  process.exit(1);
}

const money = { number: { format: "dollar" } };
const db = await notion<{ url: string; data_sources?: { id: string }[] }>("databases", "POST", {
  parent: { type: "page_id", page_id: parent },
  title: [{ text: { content: "Monthly KPIs" } }],
  description: [{ text: { content: "One row per month, sent from the KPI dashboard when a month is finalized or reopened. Numbers are the dashboard's own; members shown as first name + last initial." } }],
  initial_data_source: {
    properties: {
      Name: { title: {} },
      Month: { date: {} },
      Key: { rich_text: {} },
      Members: { number: {} },
      New: { number: {} },
      Lost: { number: {} },
      "Churn %": { number: {} },
      "GymMaster revenue": money,
      ARM: money,
      "P&L revenue": money,
      "Net income": money,
      KPI: { select: { options: [{ name: "Final", color: "green" }, { name: "Draft", color: "yellow" }] } },
      "P&L": { select: { options: [{ name: "Final", color: "green" }, { name: "Draft", color: "yellow" }, { name: "None", color: "gray" }] } },
      "Live views": { checkbox: {} },
      Sent: { date: {} },
      Version: { number: {} }, // the send's timestamp in ms: the newest page per month is kept
    },
  },
});
console.log(`Monthly KPIs: ${db.url}`);
console.log(`NOTION_KPI_DATA_SOURCE_ID=${db.data_sources?.[0]?.id}`);

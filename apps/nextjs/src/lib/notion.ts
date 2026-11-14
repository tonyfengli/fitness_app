/**
 * A small Notion API client for the gym app (the "Chief of Staff" integration, NOTION_TOKEN).
 * Used to write the monthly KPI pages ChatGPT reads (lib/kpi-notion.ts). Pages and databases
 * must be shared with the integration in Notion (page ⋯ → Connections).
 */

const NOTION_VERSION = "2025-09-03";

export async function notion<T>(path: string, method: "GET" | "POST" | "PATCH" | "DELETE" = "GET", body?: unknown): Promise<T> {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("NOTION_TOKEN is not set");
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://api.notion.com/v1/${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    // Notion rate-limits at about 3 requests a second: wait and retry
    if (res.status === 429 && attempt < 4) {
      await new Promise((r) => setTimeout(r, (Number(res.headers.get("retry-after")) || 1) * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`Notion ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return (await res.json()) as T;
  }
}

export type NotionBlock = Record<string, unknown>;

/** Text as Notion rich text (split at Notion's 2,000-character limit); **bold** runs are bold */
export function richText(text: string) {
  const out: { type: "text"; text: { content: string }; annotations?: { bold: boolean } }[] = [];
  text.split(/\*\*(.+?)\*\*/g).forEach((part, i) => {
    for (let k = 0; k < part.length; k += 2000) out.push({ type: "text", text: { content: part.slice(k, k + 2000) }, ...(i % 2 ? { annotations: { bold: true } } : {}) });
  });
  return out;
}

export const heading = (level: 2 | 3, text: string): NotionBlock => ({ type: `heading_${level}`, [`heading_${level}`]: { rich_text: richText(text) } });
export const paragraph = (text: string): NotionBlock => ({ type: "paragraph", paragraph: { rich_text: richText(text) } });
export const bullet = (text: string): NotionBlock => ({ type: "bulleted_list_item", bulleted_list_item: { rich_text: richText(text) } });
export const callout = (text: string, emoji = "ℹ️"): NotionBlock => ({ type: "callout", callout: { rich_text: richText(text), icon: { type: "emoji", emoji } } });

/** Replace a page's whole body: archive what's there, then append the new blocks (100 per call) */
export async function replacePageBody(pageId: string, blocks: NotionBlock[]): Promise<void> {
  const existing: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await notion<{ results: { id: string }[]; has_more: boolean; next_cursor: string | null }>(
      `blocks/${pageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`,
    );
    existing.push(...page.results.map((b) => b.id));
    cursor = page.has_more ? (page.next_cursor ?? undefined) : undefined;
  } while (cursor);
  for (const id of existing) await notion(`blocks/${id}`, "DELETE");
  for (let i = 0; i < blocks.length; i += 100) await notion(`blocks/${pageId}/children`, "PATCH", { children: blocks.slice(i, i + 100) });
}

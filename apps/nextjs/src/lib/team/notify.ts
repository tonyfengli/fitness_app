/**
 * Delivery for team nudges. Callers say who and what; this picks the channel from the
 * person's profile. Slack DM today; iMessage (the business door on the Mini) and SMS later,
 * each a case here, so removing a channel is removing a case.
 *
 * Slack: SLACK_BOT_TOKEN (the same bot the Mini uses; scopes chat:write + im:write).
 */

export interface Recipient {
  userId: string;
  name: string;
  slackUserId: string | null;
}

export interface Delivery {
  channel: "slack";
  externalId: string | null; // Slack message ts
}

async function slack<T extends { ok: boolean; error?: string }>(method: string, body: Record<string, unknown>): Promise<T> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN is not set");
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json()) as T;
  if (!data.ok) throw new Error(`Slack ${method}: ${data.error ?? res.status}`);
  return data;
}

export async function sendSlackDm(slackUserId: string, text: string): Promise<Delivery> {
  const open = await slack<{ ok: boolean; channel?: { id: string } }>("conversations.open", { users: slackUserId });
  const channel = open.channel?.id;
  if (!channel) throw new Error("Slack conversations.open returned no channel");
  const posted = await slack<{ ok: boolean; ts?: string }>("chat.postMessage", { channel, text, unfurl_links: false, unfurl_media: false });
  return { channel: "slack", externalId: posted.ts ?? null };
}

/** The channel a person can be reached on right now, or null */
export function channelFor(r: Recipient): "slack" | null {
  return r.slackUserId ? "slack" : null;
}

export async function notify(r: Recipient, text: string): Promise<Delivery> {
  if (r.slackUserId) return sendSlackDm(r.slackUserId, text);
  throw new Error(`${r.name} has no channel to reach them on`);
}

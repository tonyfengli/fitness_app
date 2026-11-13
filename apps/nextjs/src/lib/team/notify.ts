/**
 * Delivery for team messages. Slack DM today (SLACK_BOT_TOKEN, the Mini's bot: chat:write,
 * im:write, files:write); iMessage/SMS would be more cases here.
 * A message can carry images (a birthday card): the text goes first (its ts is what we record),
 * then each image is uploaded into the same DM so it can be long-pressed and saved.
 */

export interface Recipient {
  userId: string;
  name: string;
  slackUserId: string | null;
}

export interface Delivery {
  channel: "slack";
  externalId: string | null; // Slack ts of the text message
  imagesAttached: number;
}

async function slack<T extends { ok: boolean; error?: string }>(method: string, body: Record<string, unknown>, form = false): Promise<T> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN is not set");
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: form
      ? { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" }
      : { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
    body: form ? new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)])).toString() : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json()) as T;
  if (!data.ok) throw new Error(`Slack ${method}: ${data.error ?? res.status}`);
  return data;
}

/** An image to attach: the bytes when the caller has them (a card rendered a moment ago), otherwise a URL to fetch */
export interface SlackImage {
  url: string;
  filename: string;
  bytes?: Buffer;
}

/** Upload one image into a channel, via Slack's external upload flow */
async function uploadImage(channelId: string, image: SlackImage): Promise<void> {
  const { filename } = image;
  let bytes = image.bytes;
  if (!bytes) {
    const img = await fetch(image.url, { signal: AbortSignal.timeout(20_000) });
    if (!img.ok) throw new Error(`image ${img.status}`);
    bytes = Buffer.from(await img.arrayBuffer());
  }
  const slot = await slack<{ ok: boolean; upload_url?: string; file_id?: string }>("files.getUploadURLExternal", { filename, length: bytes.length }, true);
  if (!slot.upload_url || !slot.file_id) throw new Error("Slack gave no upload URL");
  const put = await fetch(slot.upload_url, { method: "POST", body: new Uint8Array(bytes), signal: AbortSignal.timeout(30_000) });
  if (!put.ok) throw new Error(`Slack upload ${put.status}`);
  await slack("files.completeUploadExternal", { files: [{ id: slot.file_id, title: filename }], channel_id: channelId });
}

export async function sendSlackDm(slackUserId: string, text: string, images: SlackImage[] = []): Promise<Delivery> {
  const open = await slack<{ ok: boolean; channel?: { id: string } }>("conversations.open", { users: slackUserId });
  const channel = open.channel?.id;
  if (!channel) throw new Error("Slack conversations.open returned no channel");
  const posted = await slack<{ ok: boolean; ts?: string }>("chat.postMessage", { channel, text, unfurl_links: false, unfurl_media: false });
  let imagesAttached = 0;
  for (const img of images) {
    try {
      await uploadImage(channel, img);
      imagesAttached++;
    } catch (err) {
      // The text already went out; a missing image is logged, not a failed message
      console.warn(`[team/notify] image not attached (${img.filename}):`, err instanceof Error ? err.message : err);
    }
  }
  return { channel: "slack", externalId: posted.ts ?? null, imagesAttached };
}

/** The channel a person can be reached on right now, or null */
export function channelFor(r: Recipient): "slack" | null {
  return r.slackUserId ? "slack" : null;
}

export async function notify(r: Recipient, text: string): Promise<Delivery> {
  if (r.slackUserId) return sendSlackDm(r.slackUserId, text);
  throw new Error(`${r.name} has no channel to reach them on`);
}

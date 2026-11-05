/**
 * Kilo (Gym Lead Machine, built on HighLevel) API v2 client, server-side.
 * Private Integration token with contacts r/w, conversations + messages read, users read,
 * locations / custom fields / tags read (custom fields write); no message sending.
 * Docs: ai-crew/docs/KILO-INTEGRATION.md.
 */

const BASE = "https://services.leadconnectorhq.com/";

export interface KiloContact {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  tags?: string[];
  customFields?: { id: string; value?: unknown }[];
}

export function kiloConfig() {
  const token = process.env.KILO_API_TOKEN;
  const locationId = process.env.KILO_LOCATION_ID;
  if (!token || !locationId) throw new Error("Missing KILO_API_TOKEN or KILO_LOCATION_ID");
  return { token, locationId };
}

export async function kiloRequest<T>(method: string, path: string, opts: { query?: Record<string, string | number>; body?: unknown } = {}): Promise<T> {
  const { token } = kiloConfig();
  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Version: "2021-07-28",
      Accept: "application/json",
      // Cloudflare in front of the API rejects requests without a normal user agent (error 1010)
      "User-Agent": "elev8-dashboard-sync/1.0",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Kilo ${method} ${path}: HTTP ${res.status} ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

/** Every contact in the location (paged 100 at a time) */
export async function listKiloContacts(): Promise<KiloContact[]> {
  const { locationId } = kiloConfig();
  const all: KiloContact[] = [];
  let startAfter: number | undefined;
  let startAfterId: string | undefined;
  for (;;) {
    const page = await kiloRequest<{ contacts: (KiloContact & { startAfter?: [number, string] })[] }>("GET", "contacts/", {
      query: { locationId, limit: 100, ...(startAfterId ? { startAfter: startAfter ?? 0, startAfterId } : {}) },
    });
    all.push(...page.contacts);
    const last = page.contacts[page.contacts.length - 1];
    if (page.contacts.length < 100 || !last) break;
    [startAfter, startAfterId] = last.startAfter ?? [0, last.id];
  }
  return all;
}

export async function listKiloCustomFields(): Promise<{ id: string; name: string }[]> {
  const { locationId } = kiloConfig();
  const r = await kiloRequest<{ customFields: { id: string; name: string }[] }>("GET", `locations/${locationId}/customFields`);
  return r.customFields;
}

/** Last 10 digits, for matching phone numbers written in different formats */
export const phoneKey = (phone: unknown) => {
  const d = String(phone ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
};

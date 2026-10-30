/**
 * Plan price pill for the Retention views: a member's GymMaster plan price as one
 * monthly number, e.g. "$120/mo" for $60 every 14 days. 28-day plans count as
 * monthly. Prepaid plans (no recurring charge, or no billing cycle) read "Prepaid".
 */

export interface PlanMembership {
  startdate?: string;
  paymentfreq?: string;
  paymentdue?: string;
  history?: boolean;
  completed?: boolean;
}

// Billings counted per month: 28-day plans are treated as monthly
const BILLINGS_PER_MONTH: Record<string, number> = { "1 mon": 1, "28 days": 1, "14 days": 2, "7 days": 4 };
const CONCURRENCY = 6;

const money = (v: unknown) => parseFloat(String(v ?? "").replace(/[^0-9.-]/g, "")) || 0;

// Monthly price of the newest live membership
export function monthlyPlanPrice(memberships: PlanMembership[]): string | null {
  const live = memberships.filter(m => !m.history && m.completed !== false);
  if (!live.length) return null;
  const plan = [...live]
    .sort((a, b) => String(b.startdate).localeCompare(String(a.startdate)))
    .find(m => money(m.paymentdue) > 0 && BILLINGS_PER_MONTH[m.paymentfreq ?? ""]);
  if (!plan) return "Prepaid";
  const monthly = Math.round(money(plan.paymentdue) * BILLINGS_PER_MONTH[plan.paymentfreq!]! * 100) / 100;
  return `$${Number.isInteger(monthly) ? monthly : monthly.toFixed(2)}/mo`;
}

async function fetchMemberships(memberId: string): Promise<PlanMembership[]> {
  const baseUrl = process.env.GYMMASTER_BASE_URL;
  const apiKey = process.env.GYMMASTER_STAFF_API_KEY;
  if (!baseUrl || !apiKey) return [];
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`${baseUrl}/api/v3/member/${memberId}/membership`, {
      headers: { Accept: "application/json", "X-GM-API-KEY": apiKey },
    });
    if (response.status === 429) {
      await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    if (!response.ok) return [];
    return ((await response.json()) || []) as PlanMembership[];
  }
  return [];
}

// Plan price per member ID, a few lookups at a time
export async function getPlanPrices(memberIds: string[]): Promise<Map<string, string | null>> {
  const prices = new Map<string, string | null>();
  const queue = [...new Set(memberIds)];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
        prices.set(id, monthlyPlanPrice(await fetchMemberships(id).catch(() => [])));
      }
    })
  );
  return prices;
}

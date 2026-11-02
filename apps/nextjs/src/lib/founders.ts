/**
 * Elev8 founders: the only accounts with KPI dashboard access, each with their
 * own landing page (opening the site root and right after login). Hard-coded on
 * purpose: this group is fixed. Emails compare case-insensitively.
 */

const FOUNDER_HOMES: Record<string, string> = {
  "tony.li.feng@gmail.com": "/trainer-home",
  "eileenmtz27@gmail.com": "/kpi",
  "richiecakis@gmail.com": "/kpi",
  "davemar1977@gmail.com": "/kpi",
  "k.kuratadpt@gmail.com": "/trainer-home",
};

const normalize = (email: string | null | undefined) => (email ?? "").trim().toLowerCase();

export function isFounder(email: string | null | undefined): boolean {
  return normalize(email) in FOUNDER_HOMES;
}

// Landing page for a founder, or null for everyone else
export function founderHome(email: string | null | undefined): string | null {
  return FOUNDER_HOMES[normalize(email)] ?? null;
}

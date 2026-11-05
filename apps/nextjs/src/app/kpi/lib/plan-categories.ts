/**
 * New GymMaster account (Nov 2026 on): which plans count as Group, Open Gym or PT, and
 * whether the person counts as a member. The new account labels payments by plan category
 * ("Promos", "One on One", ...) instead of the old account's two labels, so revenue
 * sources and member counts are read from the plan's GymMaster category here.
 *
 * Settled with Tony on 2026-11-05. The account is shared with Costa Mesa, so this covers
 * every category, not only the ones Anaheim sells. A category not listed is "unmapped":
 * shown as such, never guessed. Change a line here, not in parsers or prompts.
 */

export type PlanBucket = "group" | "open_gym" | "pt" | "other";

export interface PlanClass {
  bucket: PlanBucket;
  /** Counts toward member totals (new / lost / members) */
  member: boolean;
}

const NOT_MEMBER: PlanClass = { bucket: "other", member: false };

/** Whole category decides the bucket */
const BY_CATEGORY: Record<string, PlanClass> = {
  "One on One": { bucket: "pt", member: true },
  "One on One Packs & Access Passes": { bucket: "pt", member: true },
  "Partner Training": { bucket: "pt", member: true },
  "Semi-Private": { bucket: "pt", member: true },

  "Open Gym - Unlimited": { bucket: "open_gym", member: true },
  "Open Gym - Limited": { bucket: "open_gym", member: true },
  "Overnight Access": { bucket: "open_gym", member: true },

  "Classes - Unlimited": { bucket: "group", member: true },
  "Classes - Limited": { bucket: "group", member: true },
  "Small Group (old)": { bucket: "group", member: true },

  // Not members: outside coaches' clients, coaches renting space, online-only, staff, comped
  "Private Coaches Client": NOT_MEMBER,
  "Independent Contractors": NOT_MEMBER,
  Online: NOT_MEMBER,
  "Staff Members": NOT_MEMBER,
  Comped: NOT_MEMBER,
  "Functional Health Coaching": NOT_MEMBER, // not offered at Anaheim
  Recovery: NOT_MEMBER,

  // The old account's own categories (Jan-Nov 2026 archive)
  "Personal Training Packages": { bucket: "pt", member: true },
};

/** Categories holding class, open gym and PT plans alike: the plan name decides */
const BY_NAME = new Set([
  "Gym Memberships", // the old account's one membership category: Open Gym by plan name, else Group
  "Promos", // Founders plans
  "PIF Memberships",
  "PIF Memberships Fixed Term",
  "Family Add-On",
  "Minor Memberships",
  "Retention Offers",
  "Class Packs & Access Passes",
  "Open Gym Packs & Access Passes",
  "Referrals",
]);

export function classifyPlan(planName: string, category: string | null | undefined): PlanClass | null {
  const fixed = category ? BY_CATEGORY[category.trim()] : undefined;
  if (fixed) return fixed;
  if (!category || !BY_NAME.has(category.trim())) return null; // unmapped
  const name = planName.toLowerCase();
  if (name.includes("open gym")) return { bucket: "open_gym", member: true };
  if (name.includes("one on one")) return { bucket: "pt", member: true };
  return { bucket: "group", member: true };
}

export type PaymentKind = { kind: "membership"; bucket: PlanBucket; member: boolean } | { kind: "unmapped"; plan: string; category: string } | { kind: "other" };

/**
 * What a payment row is, from its label and plan name. Membership payments carry
 * "Membership Category: <GymMaster category>" and (new account, or the archive once
 * converted) "Membership-Type Name". Everything else (products, fees, refund entries) is other.
 */
export function paymentKind(row: Record<string, unknown>): PaymentKind {
  const details = typeof row["Payment Details"] === "string" ? row["Payment Details"] : "";
  if (!details.startsWith("Membership Category:")) return { kind: "other" };
  const category = details.slice("Membership Category:".length).trim();
  const plan = typeof row["Membership-Type Name"] === "string" ? row["Membership-Type Name"].trim() : "";
  const cls = classifyPlan(plan, category);
  return cls ? { kind: "membership", ...cls } : { kind: "unmapped", plan, category };
}

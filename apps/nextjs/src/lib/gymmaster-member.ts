/**
 * One member's record across the Nov 2026 account move: profile, memberships, phone, name.
 * Members in the new account are read from its staff API; former members who never moved
 * (old numbers only) are read from the archive. Phones fall back to the archived old record
 * through the member match, since most new-account records were entered without one.
 */

import { eq } from "@acme/db";
import { db } from "@acme/db/client";
import { GymMasterArchiveMember } from "@acme/db/schema";

import { getMatches, newAccountApi, newAccountConfig } from "./gymmaster-sources";

export interface MemberProfile {
  id?: number | string;
  firstname?: string;
  surname?: string;
  email?: string;
  phonecell?: string;
  phonehome?: string;
  phonework?: string;
  dob?: string;
  joindate?: string;
  [key: string]: unknown;
}

export interface Membership {
  membershiptypename?: string;
  membershiptypeid?: number;
  startdate?: string;
  enddate?: string;
  nextpayment?: string;
  paymentfreq?: string;
  paymentdue?: string;
  pricedesc?: string;
  history?: boolean;
  completed?: boolean;
  [key: string]: unknown;
}

const CACHE_MS = 10 * 60 * 1000;
let oldOnlyCache: { at: number; ids: Set<string> } | null = null;

/** Old-account numbers with no new-account counterpart (former members) */
async function oldOnlyIds(): Promise<Set<string>> {
  if (oldOnlyCache && Date.now() - oldOnlyCache.at < CACHE_MS) return oldOnlyCache.ids;
  const [archived, matches] = await Promise.all([db.select({ memberId: GymMasterArchiveMember.memberId }).from(GymMasterArchiveMember), getMatches()]);
  const ids = new Set(archived.map((a) => a.memberId).filter((id) => !matches.oldToNew.has(id)));
  oldOnlyCache = { at: Date.now(), ids };
  return ids;
}

async function archived(memberId: string) {
  const [row] = await db.select().from(GymMasterArchiveMember).where(eq(GymMasterArchiveMember.memberId, memberId)).limit(1);
  return row ?? null;
}

const first = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export async function getMemberProfile(memberId: string): Promise<MemberProfile | null> {
  if ((await oldOnlyIds()).has(memberId)) return ((await archived(memberId))?.profile as MemberProfile | null) ?? null;
  if (!newAccountConfig()) return null;
  return first(await newAccountApi<MemberProfile | MemberProfile[]>(`/api/v3/member/${memberId}`).catch(() => null));
}

export async function getMemberMemberships(memberId: string): Promise<Membership[]> {
  if ((await oldOnlyIds()).has(memberId)) return ((await archived(memberId))?.membership as Membership[] | null) ?? [];
  if (!newAccountConfig()) return [];
  return (await newAccountApi<Membership[]>(`/api/v3/member/${memberId}/membership`).catch(() => null)) ?? [];
}

/** Cell, home or work phone; the archived old record's phone when the new one has none */
export async function getMemberPhone(memberId: string): Promise<string | null> {
  const p = await getMemberProfile(memberId);
  const phone = [p?.phonecell, p?.phonehome, p?.phonework].find((v) => typeof v === "string" && v.trim());
  if (phone) return phone;
  const oldId = (await getMatches()).newToOld.get(memberId);
  return oldId ? ((await archived(oldId))?.phone ?? null) : null;
}

/**
 * Date of birth (YYYY-MM-DD); the archived old record's when the new one has none (several
 * members were re-entered in the new account without it). The new account wins when both exist.
 */
export async function getMemberDob(memberId: string, profile?: MemberProfile | null): Promise<string | null> {
  const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v);
  const p = profile === undefined ? await getMemberProfile(memberId) : profile;
  if (isDate(p?.dob)) return p.dob.slice(0, 10);
  const oldId = (await getMatches()).newToOld.get(memberId);
  const old = oldId ? ((await archived(oldId))?.profile as MemberProfile | null | undefined) : null;
  return isDate(old?.dob) ? old.dob.slice(0, 10) : null;
}

/** "First Last" */
export async function getMemberName(memberId: string): Promise<string | null> {
  const p = await getMemberProfile(memberId);
  const name = [p?.firstname, p?.surname].filter(Boolean).join(" ").trim();
  return name || null;
}

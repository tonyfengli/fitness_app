/**
 * Apify API v2 client, server-side: start a scraper run, check it, read what it collected.
 * Used only by the intel collection (src/lib/intel); agents never call Apify.
 * Every run is started with a cost cap (maxTotalChargeUsd), which Apify enforces for
 * pay-per-event scrapers. Docs: ai-crew/docs/INTEL-COLLECTION.md.
 */

const BASE = "https://api.apify.com/v2/";

export interface ApifyRun {
  id: string;
  /** READY | RUNNING | SUCCEEDED | FAILED | ABORTING | ABORTED | TIMING-OUT | TIMED-OUT */
  status: string;
  statusMessage?: string | null;
  defaultDatasetId: string;
  startedAt?: string;
  finishedAt?: string | null;
  usageTotalUsd?: number;
}

export const APIFY_DONE = ["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"];

function token() {
  const t = process.env.APIFY_TOKEN;
  if (!t) throw new Error("Missing APIFY_TOKEN");
  return t;
}

async function apifyRequest<T>(method: "GET" | "POST", path: string, opts: { query?: Record<string, string | number>; body?: unknown } = {}): Promise<T> {
  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token()}`, Accept: "application/json", ...(opts.body ? { "Content-Type": "application/json" } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Apify ${method} ${path}: HTTP ${res.status} ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

/**
 * Starts a run and returns at once (the scraper works for minutes; intel-poll picks it up).
 * `actor` is "owner~name". `maxTotalChargeUsd` is the most this run may cost.
 */
export async function startApifyRun(actor: string, input: unknown, opts: { maxTotalChargeUsd: number; timeoutSecs?: number }): Promise<ApifyRun> {
  const r = await apifyRequest<{ data: ApifyRun }>("POST", `acts/${actor}/runs`, {
    query: { maxTotalChargeUsd: opts.maxTotalChargeUsd, timeout: opts.timeoutSecs ?? 1800 },
    body: input,
  });
  return r.data;
}

export async function getApifyRun(runId: string): Promise<ApifyRun> {
  return (await apifyRequest<{ data: ApifyRun }>("GET", `actor-runs/${runId}`)).data;
}

/** Everything a run collected (paged 500 at a time). Apify keeps a dataset for a few days only. */
export async function getApifyItems<T = Record<string, unknown>>(datasetId: string): Promise<T[]> {
  const all: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const page = await apifyRequest<T[]>("GET", `datasets/${datasetId}/items`, { query: { clean: "true", limit: 500, offset } });
    all.push(...page);
    if (page.length < 500) break;
  }
  return all;
}

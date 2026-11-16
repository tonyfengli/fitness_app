/**
 * The intel collection's settings in one place: what is collected, how often, and what it may
 * cost. Change a number here, not in the code that uses it. Docs: ai-crew/docs/INTEL-COLLECTION.md.
 */

export const TIME_ZONE = "America/Los_Angeles";

/** Collection runs only when this is "true" (Vercel env). Runs already started are still stored. */
export const collectionEnabled = () => process.env.INTEL_COLLECTION_ENABLED === "true";

/** The most scheduled and manual runs may cost in a calendar month. Backfills have their own cap. */
export const monthlyCapUsd = () => Number(process.env.INTEL_MONTHLY_CAP_USD) || 20;

export const INSTAGRAM = {
  actor: "apify~instagram-scraper",
  /** Pacific weekday of the weekly pull (0 = Sunday). The start cron runs daily at about 1:30am Pacific. */
  weekday: 1,
  /** The latest posts taken per account, all formats */
  postsPerAccount: 15,
  /** Apify's price per result on the free plan (Nov 2026 spike); used to estimate and cap a run */
  usdPerResult: 0.0027,
} as const;

/** A scheduled pull is skipped when one started less than this long ago (a retry the same week is not a new pull) */
export const MIN_DAYS_BETWEEN_PULLS = 5;
/** ...and is started on any day once the last one is this old (the Monday pull was missed or failed) */
export const CATCH_UP_AFTER_DAYS = 8;

/** A run that has not finished after this long is marked failed */
export const RUN_TIMEOUT_HOURS = 6;

/** The cap handed to Apify for one run: the estimate plus half again, never under 25 cents */
export const runCapUsd = (estimateUsd: number) => Math.max(0.25, Math.round(estimateUsd * 1.5 * 100) / 100);

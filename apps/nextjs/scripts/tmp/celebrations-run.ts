/**
 * Run the celebrations job now, exactly as the nightly cron does (creates rows, renders cards,
 * records GroupMe photo suggestions, creates tasks). Writes to the database and Blob.
 *   npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/tmp/celebrations-run.ts
 */
import { runCelebrations } from "../../src/lib/celebrations/service";

const run = await runCelebrations({ apply: true });
console.log(JSON.stringify({ ...run, upcoming: run.upcoming.length }, null, 2));
process.exit(0);

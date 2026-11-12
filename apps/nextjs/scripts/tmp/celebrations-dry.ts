/**
 * Dry run of the celebrations cron: who is upcoming, whose birthday came from the old account.
 * Reads only; writes nothing.
 *   npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/tmp/celebrations-dry.ts
 */
import { runCelebrations } from "../../src/lib/celebrations/service";

const run = await runCelebrations({ apply: false });
console.log(JSON.stringify(run, null, 2));
process.exit(0);

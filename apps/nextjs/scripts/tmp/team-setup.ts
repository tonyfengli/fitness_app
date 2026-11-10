/**
 * One-off: register the celebrations workflow (owner: Tony) and Tony's messaging profile.
 *   npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/tmp/team-setup.ts <tonySlackUserId>
 * Re-running updates; nothing is duplicated. Add partners the same way once they're in Slack.
 */

import { ensureProfile, ensureWorkflow, trainerIdByEmail } from "../../src/lib/team/setup";

const [slackUserId] = process.argv.slice(2);
if (!slackUserId?.startsWith("U")) throw new Error("usage: team-setup.ts <slackUserId like U0…>");

const tony = await trainerIdByEmail("tony.li.feng@gmail.com");
await ensureWorkflow("celebrations", "Member celebrations (birthday cards)", tony);
await ensureProfile(tony, { slackUserId, aliases: ["Tony"], active: true });
console.log(`workflow celebrations → owner ${tony}; profile set with Slack ${slackUserId}`);
process.exit(0);

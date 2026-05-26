import { NextResponse } from "next/server";

import { syncTrainerizeEventsFromSheet } from "@acme/api";

// Vercel Cron endpoint. Configured in `apps/nextjs/vercel.json` at the
// `crons` array. Vercel signs the call with the `CRON_SECRET` env var
// as `Authorization: Bearer <secret>`.
//
// Locally you can hit this with:
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
//     http://localhost:3001/api/cron/trainerize-sync
//
// The underlying sync is idempotent (external_event_key UNIQUE constraint),
// so this is safe to retry, re-run, or hit concurrently.
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  try {
    const result = await syncTrainerizeEventsFromSheet();
    const durationMs = Date.now() - start;
    // Server log — visible in Vercel's deployment logs / local terminal.
    console.log("[cron] trainerize-sync ok", { durationMs, ...result });
    return NextResponse.json({ ok: true, durationMs, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[cron] trainerize-sync failed", { message, err });
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}

// Vercel Cron only ever issues GETs, but we accept POST too so manual
// curl/fetch tests don't fail mysteriously.
export const POST = GET;

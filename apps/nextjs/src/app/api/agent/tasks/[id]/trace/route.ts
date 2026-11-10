/**
 * One task's full timeline: GET /api/agent/tasks/<id>/trace
 * <id> is the task uuid or "<source>:<sourceRef>" (e.g. celebrations:birthday:31521:2026-11-16).
 * ?format=text returns the readable version. Founders, or the OpenClaw key (read-only).
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateFounderAccess } from "~/lib/api-auth";
import { formatTrace, resolveTaskId, traceTask } from "~/lib/team/trace";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await validateFounderAccess(request);
  if (authError) return authError;
  const { id } = await params;
  try {
    const taskId = await resolveTaskId(decodeURIComponent(id));
    const trace = taskId ? await traceTask(taskId) : null;
    if (!trace) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    if (request.nextUrl.searchParams.get("format") === "text") return new NextResponse(formatTrace(trace), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    return NextResponse.json({ status: "ok", ...trace, text: formatTrace(trace) });
  } catch (err) {
    console.error("[API /agent/tasks/trace] Error:", err);
    return NextResponse.json({ error: "Failed to trace task", message: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

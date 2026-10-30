/**
 * Health Check API for OpenClaw Agent
 * GET /api/agent/health
 *
 * Returns service status and timestamp.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "openclaw-agent-api",
  });
}

import { NextResponse } from "next/server";
import { sseConnections } from "../connections";

export async function GET() {
  const connections = Array.from(sseConnections.entries()).map(([sessionId, controllers]) => ({
    sessionId,
    activeConnections: controllers.size
  }));
  
  return NextResponse.json({
    totalSessions: sseConnections.size,
    connections,
    timestamp: new Date().toISOString()
  });
}
import { NextRequest, NextResponse } from "next/server";
import { broadcastCheckIn } from "../../sse/connections";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, userId, name, checkedInAt } = body;
    
    if (!sessionId || !userId || !name || !checkedInAt) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    // Broadcast the check-in event
    broadcastCheckIn(sessionId, {
      userId,
      name,
      checkedInAt
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[BroadcastCheckIn] Error:", error);
    return NextResponse.json(
      { error: "Failed to broadcast" },
      { status: 500 }
    );
  }
}
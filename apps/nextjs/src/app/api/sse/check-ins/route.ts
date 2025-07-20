import { NextRequest } from "next/server";
import { sseConnections } from "../connections";

// Lightweight SSE endpoint - minimal implementation to avoid hanging
export const runtime = 'nodejs'; // Use Node.js runtime
export const dynamic = 'force-dynamic'; // Disable caching

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  
  if (!sessionId) {
    return new Response("Session ID required", { status: 400 });
  }

  const encoder = new TextEncoder();
  let intervalId: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Register controller
      if (!sseConnections.has(sessionId)) {
        sseConnections.set(sessionId, new Set());
      }
      const controllers = sseConnections.get(sessionId)!;
      controllers.add(controller);

      // Send initial event
      const event = `event: connected\ndata: ${JSON.stringify({ 
        sessionId,
        timestamp: new Date().toISOString()
      })}\n\n`;
      
      controller.enqueue(encoder.encode(event));

      // Heartbeat every 30 seconds
      intervalId = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch (error) {
          if (intervalId) clearInterval(intervalId);
        }
      }, 30000);
    },
    
    cancel() {
      // Cleanup on client disconnect
      if (intervalId) clearInterval(intervalId);
      
      const controllers = sseConnections.get(sessionId);
      if (controllers && controllers.size > 0) {
        for (const controller of controllers) {
          try {
            controller.close();
          } catch (e) {
            // Controller already closed
          }
        }
        sseConnections.delete(sessionId);
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
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
  let timeoutId: NodeJS.Timeout | null = null;
  let isCleanedUp = false;

  const cleanup = (controller: ReadableStreamDefaultController) => {
    if (isCleanedUp) return;
    isCleanedUp = true;

    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    const controllers = sseConnections.get(sessionId);
    if (controllers) {
      controllers.delete(controller);
      if (controllers.size === 0) {
        sseConnections.delete(sessionId);
      }
    }

    try {
      controller.close();
    } catch (e) {
      // Already closed
    }
  };

  // Handle request abort
  request.signal.addEventListener('abort', () => {
    console.log(`SSE request aborted for session ${sessionId}`);
    if (!isCleanedUp) {
      cleanup(null as any);
    }
  });

  const stream = new ReadableStream({
    start(controller) {
      // Set a 2-minute timeout for the connection
      timeoutId = setTimeout(() => {
        console.log(`SSE connection timeout for session ${sessionId}`);
        cleanup(controller);
      }, 120000); // 2 minutes

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
      
      try {
        controller.enqueue(encoder.encode(event));
      } catch (error) {
        cleanup(controller);
        return;
      }

      // Heartbeat every 30 seconds
      intervalId = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch (error) {
          cleanup(controller);
        }
      }, 30000);
    },
    
    cancel() {
      // Cleanup on client disconnect
      cleanup(this as any);
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
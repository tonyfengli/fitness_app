import { NextRequest } from "next/server";

// Store connections per session
const sessionConnections = new Map<string, Set<ReadableStreamDefaultController>>();

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return new Response('Session ID required', { status: 400 });
  }

  const stream = new ReadableStream({
    start(controller) {
      // Add this connection to the session's connections
      if (!sessionConnections.has(sessionId)) {
        sessionConnections.set(sessionId, new Set());
      }
      sessionConnections.get(sessionId)!.add(controller);

      // Send initial connection message
      controller.enqueue(`data: {"type":"connected"}\n\n`);

      // Keep connection alive with periodic pings
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(': ping\n\n');
        } catch (error) {
          // Connection closed
          clearInterval(pingInterval);
        }
      }, 30000);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(pingInterval);
        sessionConnections.get(sessionId)?.delete(controller);
        if (sessionConnections.get(sessionId)?.size === 0) {
          sessionConnections.delete(sessionId);
        }
        // Silent cleanup - removed logging to reduce noise
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// Export function to broadcast preference updates
export function broadcastPreferenceUpdate(sessionId: string, data: any) {
  const connections = sessionConnections.get(sessionId);
  if (connections) {
    const message = `event: preference-update\ndata: ${JSON.stringify(data)}\n\n`;
    connections.forEach(controller => {
      try {
        controller.enqueue(message);
      } catch (error) {
        // Remove dead connections
        connections.delete(controller);
      }
    });
  }
}
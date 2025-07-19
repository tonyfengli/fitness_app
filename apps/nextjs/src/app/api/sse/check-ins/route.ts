import { NextRequest } from "next/server";
import { createLogger } from "@acme/api";
import { getSession } from "~/auth/server";
import { db } from "@acme/db/client";
import { eq, and } from "@acme/db";
import { TrainingSession } from "@acme/db/schema";
import { sseConnections } from "../connections";

const logger = createLogger("SSE-CheckIns");

export async function GET(request: NextRequest) {
  // Authenticate the request
  const session = await getSession();
  
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  
  // Check if user is a trainer
  if (session.user.role !== 'trainer') {
    return new Response("Only trainers can monitor check-ins", { status: 403 });
  }
  
  // Get session ID from query params
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  
  if (!sessionId) {
    return new Response("Session ID required", { status: 400 });
  }
  
  // Verify the trainer has access to this session
  const trainingSession = await db.query.TrainingSession.findFirst({
    where: and(
      eq(TrainingSession.id, sessionId),
      eq(TrainingSession.businessId, session.user.businessId)
    ),
  });
  
  if (!trainingSession) {
    return new Response("Session not found or access denied", { status: 404 });
  }

  // Create a new readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      logger.info("SSE connection opened", { sessionId });
      
      // Add controller to session room
      if (!sseConnections.has(sessionId)) {
        sseConnections.set(sessionId, new Set());
      }
      sseConnections.get(sessionId)!.add(controller);
      
      // Send initial connection message with session details
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(
          `event: connected\ndata: ${JSON.stringify({ 
            sessionId,
            sessionName: trainingSession.name,
            sessionStatus: trainingSession.status,
            timestamp: new Date().toISOString()
          })}\n\n`
        )
      );
      
      // Set up heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch (error) {
          // Connection closed, clean up
          clearInterval(heartbeatInterval);
        }
      }, 30000); // Every 30 seconds
      
      // Clean up on close
      request.signal.addEventListener("abort", () => {
        logger.info("SSE connection closed", { sessionId });
        
        // Remove controller from session room
        const sessionControllers = sseConnections.get(sessionId);
        if (sessionControllers) {
          sessionControllers.delete(controller);
          if (sessionControllers.size === 0) {
            sseConnections.delete(sessionId);
          }
        }
        
        clearInterval(heartbeatInterval);
        controller.close();
      });
    },
  });

  // Return SSE response
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Disable Nginx buffering
      "X-Content-Type-Options": "nosniff",
    },
  });
}


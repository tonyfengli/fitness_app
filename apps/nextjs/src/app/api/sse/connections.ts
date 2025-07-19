// Global store for SSE connections
// This ensures connections are shared across all API routes

// Use globalThis to ensure true global scope in Next.js
declare global {
  var sseConnections: Map<string, Set<ReadableStreamDefaultController>> | undefined;
}

// Initialize only once
if (!globalThis.sseConnections) {
  globalThis.sseConnections = new Map<string, Set<ReadableStreamDefaultController>>();
}

export const sseConnections = globalThis.sseConnections;

export function broadcastCheckIn(sessionId: string, clientData: {
  userId: string;
  name: string;
  checkedInAt: string;
}) {
  console.log("[SSE] broadcastCheckIn called", { 
    sessionId, 
    clientName: clientData.name,
    activeConnections: sseConnections.get(sessionId)?.size || 0,
    allSessions: Array.from(sseConnections.keys())
  });
  
  const sessionControllers = sseConnections.get(sessionId);
  
  if (!sessionControllers || sessionControllers.size === 0) {
    console.log("[SSE] No active connections for session", { sessionId });
    return;
  }
  
  const encoder = new TextEncoder();
  const eventData = `event: client-checked-in\ndata: ${JSON.stringify({
    ...clientData,
    timestamp: new Date().toISOString()
  })}\n\n`;
  
  const deadControllers = new Set<ReadableStreamDefaultController>();
  
  sessionControllers.forEach((controller) => {
    try {
      controller.enqueue(encoder.encode(eventData));
      console.log("[SSE] Event sent to controller");
    } catch (error) {
      console.log("[SSE] Controller is closed, marking for removal");
      deadControllers.add(controller);
    }
  });
  
  // Remove dead controllers
  deadControllers.forEach(controller => {
    sessionControllers.delete(controller);
  });
  
  if (sessionControllers.size === 0) {
    sseConnections.delete(sessionId);
  }
  
  console.log("[SSE] Broadcast complete", { 
    sessionId, 
    clientName: clientData.name,
    remainingConnections: sessionControllers.size 
  });
}

export function broadcastPreferenceUpdate(sessionId: string, preferenceData: {
  userId: string;
  preferences: {
    intensity?: string | null;
    muscleTargets?: string[] | null;
    muscleLessens?: string[] | null;
    includeExercises?: string[] | null;
    avoidExercises?: string[] | null;
    avoidJoints?: string[] | null;
    sessionGoal?: string | null;
  };
}) {
  console.log("[SSE] broadcastPreferenceUpdate called", { 
    sessionId, 
    userId: preferenceData.userId,
    activeConnections: sseConnections.get(sessionId)?.size || 0
  });
  
  const sessionControllers = sseConnections.get(sessionId);
  
  if (!sessionControllers || sessionControllers.size === 0) {
    console.log("[SSE] No active connections for session", { sessionId });
    return;
  }
  
  const encoder = new TextEncoder();
  const eventData = `event: preference-updated\ndata: ${JSON.stringify({
    ...preferenceData,
    timestamp: new Date().toISOString()
  })}\n\n`;
  
  const deadControllers = new Set<ReadableStreamDefaultController>();
  
  sessionControllers.forEach((controller) => {
    try {
      controller.enqueue(encoder.encode(eventData));
      console.log("[SSE] Preference update sent to controller");
    } catch (error) {
      console.log("[SSE] Controller is closed, marking for removal");
      deadControllers.add(controller);
    }
  });
  
  // Remove dead controllers
  deadControllers.forEach(controller => {
    sessionControllers.delete(controller);
  });
  
  if (sessionControllers.size === 0) {
    sseConnections.delete(sessionId);
  }
  
  console.log("[SSE] Preference broadcast complete", { 
    sessionId, 
    userId: preferenceData.userId,
    remainingConnections: sessionControllers.size 
  });
}
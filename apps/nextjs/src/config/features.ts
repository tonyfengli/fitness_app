// Feature flags for controlling app functionality
export const features = {
  // Server-Sent Events for real-time updates
  sse: {
    enabled: process.env.NEXT_PUBLIC_ENABLE_SSE === "true" || true, // Enable by default
    sessionLobby:
      process.env.NEXT_PUBLIC_ENABLE_SSE_SESSION_LOBBY === "true" || true, // Enable for session lobby
    messages: process.env.NEXT_PUBLIC_ENABLE_SSE_MESSAGES === "true" || false, // Keep disabled for messages
  },
};

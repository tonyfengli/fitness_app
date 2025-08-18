"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { authClient } from "~/auth/client";
import { FrontendDebugClient } from "~/utils/frontendDebugClient";

export function useAuth() {
  const {
    data: session,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["auth-session"],
    queryFn: async () => {
      try {
        FrontendDebugClient.log("useAuth", "Fetching session", {
          timestamp: Date.now(),
          url: "/api/auth/get-session",
        });

        // Make a direct fetch call to get the full session
        const response = await fetch("/api/auth/get-session", {
          method: "GET",
          credentials: "include",
        });

        const data = await response.json();

        // The actual response structure is: { session: {...}, user: {...} }
        // Combine them into a single session object
        const session = data
          ? {
              ...data.session,
              user: data.user,
            }
          : null;

        FrontendDebugClient.log("useAuth", "Session raw response", {
          data,
          session,
          hasUser: !!session?.user,
          userData: session?.user,
          fullResponse: JSON.stringify(data),
          // Debug the exact structure
          dataKeys: data ? Object.keys(data) : [],
          sessionKeys: session ? Object.keys(session) : [],
          // Check different possible locations
          directUser: data?.user,
          nestedUser: data?.session?.user,
          extractedUser: session?.user,
        });

        return session;
      } catch (err) {
        console.error("Error fetching session:", err);
        FrontendDebugClient.log("useAuth", "Session fetch error", {
          error: err,
        });
        return null;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });

  const authState = {
    user: session?.user,
    isLoading,
    isAuthenticated: !!session?.user,
    isTrainer: session?.user?.role === "trainer",
    isClient: session?.user?.role === "client",
  };

  // Log auth state changes
  useEffect(() => {
    FrontendDebugClient.logAuthState({
      user: authState.user,
      isAuthenticated: authState.isAuthenticated,
      isLoading: authState.isLoading,
      session,
    });
  }, [authState.isAuthenticated, authState.isLoading, authState.user?.id]);

  return authState;
}

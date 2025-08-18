"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { authClient } from "~/auth/client";

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    console.log("[Login] ========== LOGIN ATTEMPT ==========");
    console.log("[Login] Email:", formData.email);
    console.log("[Login] Current URL:", window.location.href);
    console.log("[Login] Origin:", window.location.origin);
    console.log("[Login] Auth client baseURL:", authClient._baseUrl || "not accessible");

    try {
      console.log("[Login] Calling authClient.signIn.email...");
      const result = await authClient.signIn.email({
        email: formData.email,
        password: formData.password,
      });

      console.log("[Login] Sign in result:", {
        success: !result.error,
        hasData: !!result.data,
        error: result.error,
        errorMessage: result.error?.message,
        errorCode: result.error?.code,
        fullResult: result
      });

      if (result.error) {
        console.error("[Login] Authentication failed:", {
          error: result.error,
          message: result.error.message,
          code: result.error.code,
          isOnline: navigator.onLine
        });
        
        // Check if we're offline
        if (!navigator.onLine) {
          setError("Connection failed. Please check your internet connection.");
        } else {
          setError(result.error.message ?? "Invalid email or password");
        }
      } else {
        console.log("[Login] Authentication successful, setting redirect state");
        // Set redirecting state to show loading UI
        setIsRedirecting(true);

        console.log("[Login] Invalidating auth-session query");
        // Invalidate the session query to force a refetch
        await queryClient.invalidateQueries({ queryKey: ["auth-session"] });

        console.log("[Login] Fetching fresh session data from /api/auth/get-session");
        // Get fresh session data from API
        const response = await fetch("/api/auth/get-session", {
          credentials: "include",
          cache: "no-store",
        });
        
        console.log("[Login] Session response status:", response.status);
        const sessionData = await response.json();
        console.log("[Login] Session data:", {
          hasUser: !!sessionData?.user,
          userRole: sessionData?.user?.role,
          userId: sessionData?.user?.id,
          businessId: sessionData?.user?.businessId,
          fullData: sessionData
        });

        const userRole = sessionData?.user?.role;

        console.log("[Login] Routing based on role:", userRole);
        if (userRole === "trainer") {
          console.log("[Login] Redirecting to trainer dashboard");
          router.push("/trainer-dashboard");
        } else if (userRole === "client") {
          console.log("[Login] Redirecting to client dashboard");
          router.push("/client-dashboard");
        } else {
          console.log("[Login] No role found, redirecting to home");
          router.push("/");
        }
        router.refresh();
      }
    } catch (err) {
      console.error("[Login] Caught error during login:", {
        error: err,
        message: err instanceof Error ? err.message : "Unknown error",
        stack: err instanceof Error ? err.stack : undefined,
        type: err?.constructor?.name
      });
      
      // Simple network vs other error detection
      if (err instanceof TypeError && err.message.includes("fetch")) {
        setError("Connection failed. Please check your internet connection.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
      console.error(err);
    } finally {
      console.log("[Login] ========== END LOGIN ATTEMPT ==========");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      {isRedirecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-75">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">
              Redirecting to your dashboard...
            </p>
          </div>
        </div>
      )}
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{" "}
            <Link
              href="/signup"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              create a new account
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="-space-y-px rounded-md shadow-sm">
            <div>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="relative block w-full rounded-t-md border-0 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                placeholder="Email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="relative block w-full rounded-b-md border-0 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                placeholder="Password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

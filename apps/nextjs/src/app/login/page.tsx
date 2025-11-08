"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@acme/ui-shared";

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
          console.log("[Login] Redirecting to trainer-home");
          router.push("/trainer-home");
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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12 sm:px-6 lg:px-8">
      {/* Loading Overlay */}
      {isRedirecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/75 dark:bg-gray-900/75 backdrop-blur-sm">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-gray-200 border-t-purple-600 dark:border-gray-700 dark:border-t-purple-400"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Redirecting to your dashboard...
            </p>
          </div>
        </div>
      )}

      <div className="w-full max-w-md">
        {/* Logo / Brand Area */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Sign in to your account to continue
          </p>
        </div>

        {/* Card Container */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Error Message */}
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 animate-fadeIn">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400 dark:text-red-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className={cn(
                  "block w-full rounded-lg border px-4 py-3 text-sm",
                  "border-gray-300 dark:border-gray-600",
                  "bg-white dark:bg-gray-800",
                  "text-gray-900 dark:text-white",
                  "placeholder-gray-400 dark:placeholder-gray-500",
                  "focus:border-purple-500 dark:focus:border-purple-400",
                  "focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:focus:ring-purple-400/20",
                  "transition-colors duration-200"
                )}
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className={cn(
                  "block w-full rounded-lg border px-4 py-3 text-sm",
                  "border-gray-300 dark:border-gray-600",
                  "bg-white dark:bg-gray-800",
                  "text-gray-900 dark:text-white",
                  "placeholder-gray-400 dark:placeholder-gray-500",
                  "focus:border-purple-500 dark:focus:border-purple-400",
                  "focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:focus:ring-purple-400/20",
                  "transition-colors duration-200"
                )}
                placeholder="Enter your password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
              />
            </div>

            {/* Remember Me */}
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className={cn(
                  "h-4 w-4 rounded border-gray-300 dark:border-gray-600",
                  "text-purple-600 focus:ring-purple-500 dark:focus:ring-purple-400",
                  "bg-white dark:bg-gray-800"
                )}
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Remember me
              </label>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className={cn(
                  "w-full flex justify-center items-center px-4 py-3 rounded-lg text-sm font-semibold",
                  "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700",
                  "text-white shadow-lg hover:shadow-xl",
                  "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800",
                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg",
                  "transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                )}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </>
                ) : (
                  <>
                    Continue
                    <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </div>

          </form>
        </div>

        {/* Sign up link */}
        <p className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          Don't have an account?{" "}
          <Link
            href="/signup"
            className="font-semibold text-purple-600 hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300 transition-colors duration-200"
          >
            Sign up for free
          </Link>
        </p>
      </div>
    </div>
  );
}
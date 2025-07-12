"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "~/hooks/use-auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "trainer" | "client";
  redirectTo?: string;
}

export function ProtectedRoute({ 
  children, 
  requiredRole,
  redirectTo = "/login" 
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(redirectTo);
    }

    if (!isLoading && isAuthenticated && requiredRole && user?.role !== requiredRole) {
      // If user has wrong role, redirect to their appropriate dashboard
      if (user?.role === "trainer") {
        router.push("/trainer-dashboard");
      } else if (user?.role === "client") {
        router.push("/client-dashboard");
      } else {
        router.push("/");
      }
    }
  }, [isLoading, isAuthenticated, user, requiredRole, redirectTo, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return null;
  }

  return <>{children}</>;
}
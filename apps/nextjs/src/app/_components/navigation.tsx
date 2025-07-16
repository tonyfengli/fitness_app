"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@acme/ui-shared";
import { authClient } from "~/auth/client";
import { useAuth } from "~/hooks/use-auth";
import { FrontendDebugClient } from "~/utils/frontendDebugClient";

export function Navigation() {
  const { user, isAuthenticated, isTrainer, isClient, isLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Log navigation renders
  FrontendDebugClient.log('Navigation', 'Render', {
    isAuthenticated,
    isLoading,
    userName: user?.name,
    userRole: user?.role
  });

  const handleSignOut = async () => {
    FrontendDebugClient.log('Navigation', 'Sign out clicked', { user: user?.name });
    
    await authClient.signOut();
    // Clear the session from the query cache
    queryClient.setQueryData(["auth-session"], null);
    queryClient.invalidateQueries({ queryKey: ["auth-session"] });
    
    FrontendDebugClient.log('Navigation', 'Sign out complete', { redirectTo: '/login' });
    router.push("/login");
    router.refresh();
  };

  if (isLoading) {
    return (
      <nav className="border-b">
        <div className="flex h-16 items-center">
          <div className="w-80 flex items-center justify-center">
            <Link href="/" className="text-xl font-bold">
              Fitness App
            </Link>
          </div>
          <div className="flex-1 px-8 flex justify-end">
            <div className="h-9 w-20 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="border-b">
      <div className="flex h-16 items-center">
        <div className="w-80 flex items-center justify-center">
          <Link href="/" className="text-xl font-bold">
            Fitness App
          </Link>
        </div>
        
        <div className="flex-1 px-8 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            {isAuthenticated && isClient && (
              <Link 
                href="/client-dashboard" 
                className="text-sm font-medium text-muted-foreground hover:text-primary"
              >
                My Workouts
              </Link>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <Button onClick={handleSignOut} size="lg" variant="ghost">
                Log Out
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}
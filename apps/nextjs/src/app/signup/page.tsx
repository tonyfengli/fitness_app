"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "~/auth/client";
import { useTRPC } from "~/trpc/react";

export default function SignupPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Check if current user is a trainer
  const { data: currentSession } = useQuery({
    queryKey: ["auth-session"],
    queryFn: () => authClient.getSession(),
  });
  const isTrainerCreatingClient = currentSession?.user && (currentSession.user as any).role === 'trainer';
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    role: "client",
    businessId: isTrainerCreatingClient ? (currentSession?.user as any)?.businessId || "" : "",
    strengthLevel: "moderate",
    skillLevel: "moderate",
  });
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Fetch businesses
  const { data: businesses, isLoading: businessesLoading } = useQuery(
    trpc.business.all.queryOptions()
  );

  // Mutation for creating user profile
  const createProfile = useMutation(
    trpc.auth.createUserProfile.mutationOptions({
      onError: (err) => {
        console.error("Failed to create user profile:", err);
      },
    })
  );

  // Mutation for trainer creating user
  const createUserAsTrainer = useMutation(
    trpc.auth.createUserAsTrainer.mutationOptions({
      onSuccess: async () => {
        // Invalidate clients query to refresh the trainer dashboard
        await queryClient.invalidateQueries({ 
          queryKey: ["auth", "getClientsByBusiness"] 
        });
      },
      onError: (err) => {
        setError(err.message || "Failed to create user");
      },
    })
  );

  // Update form data when session loads
  useEffect(() => {
    if (isTrainerCreatingClient && currentSession?.user) {
      const trainerBusinessId = (currentSession.user as any).businessId;
      if (trainerBusinessId && !formData.businessId) {
        setFormData(prev => ({ ...prev, businessId: trainerBusinessId }));
      }
    }
  }, [currentSession, isTrainerCreatingClient, formData.businessId]);
  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // If trainer is creating a user, use the special API endpoint
      if (isTrainerCreatingClient) {
        setIsRedirecting(true);
        
        await createUserAsTrainer.mutateAsync({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          phone: formData.phone,
          role: formData.role as "client" | "trainer",
          strengthLevel: formData.role === "client" ? (formData.strengthLevel as "very_low" | "low" | "moderate" | "high") : undefined,
          skillLevel: formData.role === "client" ? (formData.skillLevel as "very_low" | "low" | "moderate" | "high") : undefined,
        });
        
        // Navigate back to trainer dashboard
        router.push("/trainer-dashboard");
        router.refresh();
      } else {
        // Normal signup flow
        const result = await authClient.signUp.email({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          phone: formData.phone,
          role: formData.role,
          businessId: formData.businessId,
        });

        if (result.error) {
          setError(result.error.message ?? "Failed to create account");
        } else {
          // Normal signup flow - sign in as the new user
          const signInResult = await authClient.signIn.email({
            email: formData.email,
            password: formData.password,
          });

          if (signInResult.error) {
            setError("Account created but failed to sign in. Please try logging in.");
            router.push("/login");
          } else {
            // Set redirecting state
            setIsRedirecting(true);
            
            // Invalidate auth cache to force refetch
            await queryClient.invalidateQueries({ queryKey: ["auth-session"] });
            
            // Get fresh session data
            const session = await authClient.getSession();
            
            // Create user profile for clients
            if (formData.role === "client" && session?.user?.id) {
              try {
                await createProfile.mutateAsync({
                  userId: session.user.id,
                  businessId: formData.businessId,
                  strengthLevel: formData.strengthLevel as "very_low" | "low" | "moderate" | "high",
                  skillLevel: formData.skillLevel as "very_low" | "low" | "moderate" | "high",
                });
              } catch (profileError) {
                console.error("Failed to create user profile:", profileError);
                // Continue with redirect even if profile creation fails
              }
            }
            
            // Redirect based on user role
            if (session?.user?.role === "trainer") {
              router.push("/trainer-dashboard");
            } else if (session?.user?.role === "client") {
              router.push("/client-dashboard");
            } else {
              router.push("/");
            }
            router.refresh();
          }
        }
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      {isRedirecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-75">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">
              {isTrainerCreatingClient ? "Creating new user..." : "Setting up your account..."}
            </p>
          </div>
        </div>
      )}
      <div className="w-full max-w-md space-y-8">
        <div>
          <button
            onClick={() => router.back()}
            className="mb-4 flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <svg
              className="mr-2 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back
          </button>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            {isTrainerCreatingClient ? "Create New User" : "Create your account"}
          </h2>
          {!isTrainerCreatingClient && (
            <p className="mt-2 text-center text-sm text-gray-600">
              Or{" "}
              <Link
                href="/login"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                sign in to your existing account
              </Link>
            </p>
          )}
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                className="mt-1 block w-full rounded-md border-0 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 block w-full rounded-md border-0 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Phone Number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                className="mt-1 block w-full rounded-md border-0 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                placeholder="(555) 123-4567"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="mt-1 block w-full rounded-md border-0 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
              />
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                Role
              </label>
              <select
                id="role"
                name="role"
                required
                className="mt-1 block w-full rounded-md border-0 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value })
                }
              >
                <option value="client">Client</option>
                <option value="trainer">Trainer</option>
              </select>
            </div>

            {!isTrainerCreatingClient && (
              <div>
                <label htmlFor="business" className="block text-sm font-medium text-gray-700">
                  Business
                </label>
                <select
                  id="business"
                  name="business"
                  required
                  disabled={businessesLoading}
                  className="mt-1 block w-full rounded-md border-0 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  value={formData.businessId}
                  onChange={(e) =>
                    setFormData({ ...formData, businessId: e.target.value })
                  }
                >
                  <option value="">Select a business</option>
                  {businesses?.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.role === "client" && (
              <>
                <div>
                  <label htmlFor="strengthLevel" className="block text-sm font-medium text-gray-700">
                    Strength Level
                  </label>
                  <select
                    id="strengthLevel"
                    name="strengthLevel"
                    required
                    className="mt-1 block w-full rounded-md border-0 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                    value={formData.strengthLevel}
                    onChange={(e) =>
                      setFormData({ ...formData, strengthLevel: e.target.value })
                    }
                  >
                    <option value="very_low">Very Low</option>
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="skillLevel" className="block text-sm font-medium text-gray-700">
                    Skill Level
                  </label>
                  <select
                    id="skillLevel"
                    name="skillLevel"
                    required
                    className="mt-1 block w-full rounded-md border-0 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                    value={formData.skillLevel}
                    onChange={(e) =>
                      setFormData({ ...formData, skillLevel: e.target.value })
                    }
                  >
                    <option value="very_low">Very Low</option>
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading || businessesLoading}
              className="group relative flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading 
                ? (isTrainerCreatingClient ? "Creating user..." : "Creating account...") 
                : (isTrainerCreatingClient ? "Create User" : "Create account")
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
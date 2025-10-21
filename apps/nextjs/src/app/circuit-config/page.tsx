"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@acme/ui-shared";
import { cn } from "@acme/ui-shared";
import { useTRPC } from "~/trpc/react";
import { toast } from "sonner";

// Icons
const ChevronLeftIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const DumbbellIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
  </svg>
);

const TemplateIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);

const LoaderIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={cn("animate-spin", className)} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export default function CircuitConfigPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const [isCreating, setIsCreating] = useState(false);
  const [selectedType, setSelectedType] = useState<'custom' | 'template' | null>(null);

  // Create session mutation
  const createSessionMutation = useMutation(
    trpc.trainingSession.createCircuitSessionPublic.mutationOptions({
      onSuccess: (data) => {
        // Navigate to the circuit config page with the new session ID and workout type
        router.push(`/circuit-sessions/${data.sessionId}/circuit-config?workoutType=${data.workoutType}&fromNew=true`);
      },
      onError: (error) => {
        console.error('[CircuitConfig] Failed to create session:', error);
        toast.error("Failed to create session. Please try again.");
        setIsCreating(false);
      },
    })
  );

  const handleWorkoutTypeSelect = async (type: 'custom' | 'template') => {
    setSelectedType(type);
    setIsCreating(true);
    
    // Create the session with the selected workout type
    createSessionMutation.mutate({ workoutType: type });
  };

  const handleBack = () => {
    router.push('/circuit-sessions');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between p-4 pb-2">
            <button
              onClick={handleBack}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors rounded-md"
            >
              <ChevronLeftIcon className="h-4 w-4" />
              <span className="text-sm">Back</span>
            </button>
            
            <div className="text-center">
              <h1 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                New Circuit Session
              </h1>
            </div>
            
            <div className="w-20" /> {/* Spacer for centering */}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-24 p-4 pb-8">
        <div className="mx-auto max-w-md">
          <Card className="p-0 shadow-sm bg-white dark:bg-gray-800">
            <div className="p-6 space-y-6">
              {!isCreating ? (
                <>
                  <div className="text-center space-y-2 mb-8">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Choose Your Workout Type
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Select how you want to build your circuit workout
                    </p>
                  </div>

                  <div className="space-y-3">
                    {/* Custom Workout Option */}
                    <button
                      onClick={() => handleWorkoutTypeSelect('custom')}
                      className="w-full group relative flex items-center p-4 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-200 text-left border-2 border-transparent hover:border-blue-500 dark:hover:border-blue-400"
                    >
                      <div className="flex-shrink-0 w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                        <DumbbellIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="ml-4 flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          Build Custom Workout
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                          Create a workout from scratch with full control
                        </p>
                      </div>
                      <ChevronLeftIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 rotate-180 group-hover:translate-x-1 transition-transform duration-200" />
                    </button>

                    {/* Template Option */}
                    <button
                      onClick={() => handleWorkoutTypeSelect('template')}
                      className="w-full group relative flex items-center p-4 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-200 text-left border-2 border-transparent hover:border-emerald-500 dark:hover:border-emerald-400"
                    >
                      <div className="flex-shrink-0 w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                        <TemplateIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="ml-4 flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          Use Workout Template
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                          Start from a pre-built template and customize
                        </p>
                      </div>
                      <ChevronLeftIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 rotate-180 group-hover:translate-x-1 transition-transform duration-200" />
                    </button>
                  </div>
                </>
              ) : (
                /* Loading State */
                <div className="flex flex-col items-center justify-center py-16 space-y-4">
                  <LoaderIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Creating your session...
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {selectedType === 'custom' ? 'Setting up custom workout' : 'Loading templates'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
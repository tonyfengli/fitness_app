"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, Button, Loader2Icon as Loader2, useRealtimeExerciseSwaps } from "@acme/ui-shared";
import { supabase } from "~/lib/supabase";
import { useTRPC } from "~/trpc/react";

interface RoundData {
  roundName: string;
  exercises: Array<{
    id: string;
    exerciseId: string;
    exerciseName: string;
    orderIndex: number;
  }>;
}

function CircuitWorkoutOverviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  
  const [roundsData, setRoundsData] = useState<RoundData[]>([]);
  const [hasExercises, setHasExercises] = useState(false);

  // Use real-time exercise swap updates
  useRealtimeExerciseSwaps({
    sessionId: sessionId || "",
    supabase,
    onSwapUpdate: (swap) => {
      console.log("[CircuitWorkoutOverview] Exercise swap detected:", swap);
      
      // Force refetch of exercise selections
      queryClient.invalidateQueries({
        queryKey: [["workoutSelections", "getSelections"]],
      });
    },
    onError: (error) => {
      console.error("[CircuitWorkoutOverview] Real-time error:", error);
    },
  });

  // Fetch circuit config
  const { data: circuitConfig } = useQuery({
    ...trpc.circuitConfig.getBySession.queryOptions({ 
      sessionId: sessionId || "" 
    }),
    enabled: !!sessionId,
  });

  // Fetch saved selections (for circuit, we don't filter by clientId)
  const { data: savedSelections, isLoading: isLoadingSelections } = useQuery({
    ...trpc.workoutSelections.getSelections.queryOptions({
      sessionId: sessionId || "",
    }),
    enabled: !!sessionId,
    refetchInterval: !hasExercises ? 5000 : false, // Poll when no exercises
  });

  // Process selections into rounds
  useEffect(() => {
    if (savedSelections && savedSelections.length > 0) {
      console.log("[CircuitWorkoutOverview] Processing selections:", savedSelections.length);
      
      // Group exercises by round (using groupName)
      const roundsMap = new Map<string, typeof savedSelections>();
      
      // Deduplicate exercises since circuit exercises are shared
      const uniqueExercises = new Map<string, any>();
      
      savedSelections.forEach((selection: any) => {
        const key = `${selection.exerciseId}-${selection.groupName}`;
        if (!uniqueExercises.has(key)) {
          uniqueExercises.set(key, selection);
        }
      });
      
      // Group by round
      uniqueExercises.forEach((selection) => {
        const round = selection.groupName || 'Round 1';
        if (!roundsMap.has(round)) {
          roundsMap.set(round, []);
        }
        roundsMap.get(round)!.push(selection);
      });
      
      // Sort exercises within each round and create final structure
      let rounds: RoundData[] = Array.from(roundsMap.entries())
        .map(([roundName, exercises]) => ({
          roundName,
          exercises: exercises
            .sort((a: any, b: any) => a.orderIndex - b.orderIndex)
            .map((ex: any) => ({
              id: ex.id,
              exerciseId: ex.exerciseId,
              exerciseName: ex.exerciseName,
              orderIndex: ex.orderIndex,
            }))
        }))
        .sort((a, b) => {
          // Extract round numbers for sorting
          const aNum = parseInt(a.roundName.match(/\d+/)?.[0] || '0');
          const bNum = parseInt(b.roundName.match(/\d+/)?.[0] || '0');
          return aNum - bNum;
        });
      
      // If repeat is enabled, only show the base rounds (first half)
      if (circuitConfig?.config?.repeatRounds) {
        const baseRoundCount = Math.floor(rounds.length / 2);
        rounds = rounds.slice(0, baseRoundCount);
      }
      
      setRoundsData(rounds);
      setHasExercises(true);
    }
  }, [savedSelections, circuitConfig]);

  if (isLoadingSelections) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading circuit exercises...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-12 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Circuit Workout Overview
            </h1>
            <div className="mt-2 flex items-center gap-4">
              <span className="text-lg text-muted-foreground font-medium">
                {circuitConfig?.config?.rounds || 0} rounds × {circuitConfig?.config?.exercisesPerRound || 0} exercises
              </span>
              {circuitConfig?.config?.repeatRounds && (
                <span className="px-3 py-1 text-sm font-semibold bg-primary/10 text-primary rounded-full">
                  Repeats 2×
                </span>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="font-medium"
          >
            ← Back
          </Button>
        </div>

        {/* Content */}
        {roundsData.length > 0 ? (
          <div className="grid gap-6">
            {roundsData.map((round) => (
              <Card key={round.roundName} className="p-8 border-2 shadow-lg hover:shadow-xl transition-shadow">
                <h2 className="mb-6 text-2xl font-bold flex items-center gap-3">
                  <span className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                    {round.roundName.match(/\d+/)?.[0] || ''}
                  </span>
                  {round.roundName}
                </h2>
                <div className="space-y-3">
                  {round.exercises.map((exercise, idx) => (
                    <div key={exercise.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all border border-transparent hover:border-primary/20 min-h-[72px]">
                      <div className="flex items-center gap-4 flex-1">
                        <span className="w-8 h-8 bg-background rounded-lg flex items-center justify-center text-sm font-semibold text-muted-foreground flex-shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-medium text-lg leading-tight py-1">{exercise.exerciseName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Up button */}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={idx === 0}
                          onClick={() => console.log('Move up:', exercise.exerciseName)}
                          className="h-8 w-8 p-0 disabled:opacity-50"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M10.5 8.75L7 5.25L3.5 8.75" />
                          </svg>
                        </Button>
                        
                        {/* Down button */}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={idx === round.exercises.length - 1}
                          onClick={() => console.log('Move down:', exercise.exerciseName)}
                          className="h-8 w-8 p-0 disabled:opacity-50"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3.5 5.25L7 8.75L10.5 5.25" />
                          </svg>
                        </Button>
                        
                        {/* Replace button */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => console.log('Replace exercise:', exercise.exerciseName)}
                          className="h-8 px-3 font-medium"
                        >
                          Replace
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
            
            {/* Repeat indicator */}
            {circuitConfig?.config?.repeatRounds && (
              <div className="text-center py-8">
                <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary/10 to-primary/5 rounded-full border border-primary/20">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-primary">
                    <path d="M4 10C4 13.3137 6.68629 16 10 16C11.6569 16 13.1569 15.3137 14.2426 14.2426M16 10C16 6.68629 13.3137 4 10 4C8.34315 4 6.84315 4.68629 5.75736 5.75736" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M4 4V10H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M10 16H16V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-lg font-semibold text-primary">Circuit Repeats 2×</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Card className="p-16 text-center border-2 border-dashed">
            <div className="flex flex-col items-center justify-center">
              <div className="mb-6 w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-primary animate-pulse">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h2 className="mb-3 text-2xl font-bold">
                Generating Your Circuit...
              </h2>
              <p className="text-muted-foreground max-w-md">
                The AI is creating your personalized circuit workout. This page will update automatically when ready.
              </p>
              <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <span>Checking for updates every 5 seconds</span>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function CircuitWorkoutOverviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <CircuitWorkoutOverviewContent />
    </Suspense>
  );
}
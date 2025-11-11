"use client";

import React from "react";
import type { CircuitConfig, RoundData } from "@acme/ui-shared";

interface TimerBadgeProps {
  circuitConfig: CircuitConfig | null | undefined;
  roundsData: RoundData[];
  className?: string;
}

export function TimerBadge({ circuitConfig, roundsData, className = "" }: TimerBadgeProps) {
  // Calculate total workout time
  let totalWorkoutTime = 0;
  
  if (circuitConfig?.config?.roundTemplates) {
    console.log('[TimerBadge] Starting calculation, rest between rounds:', circuitConfig.config.restBetweenRounds);
    
    circuitConfig.config.roundTemplates.forEach((rt, index) => {
      const roundTemplate = rt.template;
      const round = roundsData[index];
      let roundDuration = 0;
      
      if (roundTemplate.type === 'amrap_round') {
        roundDuration = (roundTemplate as any).totalDuration || 300;
        totalWorkoutTime += roundDuration;
      } else if (roundTemplate.type === 'circuit_round' || roundTemplate.type === 'stations_round') {
        let unitsCount = roundTemplate.exercisesPerRound;
        
        // Use actual exercise count if available, fallback to template count
        if (round?.exercises) {
          if (roundTemplate.type === 'stations_round') {
            const uniqueStations = new Set(round.exercises.map((ex: any) => ex.orderIndex));
            unitsCount = uniqueStations.size || roundTemplate.exercisesPerRound;
          } else {
            // For circuit_round, count actual exercises
            unitsCount = round.exercises.length || roundTemplate.exercisesPerRound;
          }
        }
        
        const workTime = (roundTemplate as any).workDuration || 0;
        const restTime = (roundTemplate as any).restDuration || 0;
        const sets = (roundTemplate as any).repeatTimes || 1;
        const restBetweenSets = (roundTemplate as any).restBetweenSets || 0;
        
        // Time for one set: (units * work) + (rest between units)
        const timePerSet = (unitsCount * workTime) + ((unitsCount - 1) * restTime);
        roundDuration = (timePerSet * sets) + (restBetweenSets * (sets - 1));
        
        console.log(`[TimerBadge] Round ${index + 1}:`, {
          type: roundTemplate.type,
          unitsCount,
          workTime,
          restTime,
          sets,
          restBetweenSets,
          timePerSet,
          roundDuration
        });
        
        totalWorkoutTime += roundDuration;
      }
      
      // Add rest between rounds (except after last round)
      if (index < circuitConfig.config.roundTemplates.length - 1 && circuitConfig.config.restBetweenRounds > 0) {
        console.log(`[TimerBadge] Adding rest after round ${index + 1}:`, circuitConfig.config.restBetweenRounds);
        totalWorkoutTime += circuitConfig.config.restBetweenRounds;
      }
    });
    
    console.log('[TimerBadge] Total workout time:', totalWorkoutTime);
  }
  
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const remainingSecs = seconds % 60;
    return remainingSecs === 0 ? `${mins}m` : `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };
  
  if (totalWorkoutTime === 0) {
    return null;
  }

  return (
    <div className={`relative px-3 py-2 bg-white/25 dark:bg-gray-700/50 backdrop-blur-md rounded-lg inline-flex items-center shadow-lg border border-white/20 dark:border-gray-600/30 ${className}`}>
      <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-600 dark:bg-gray-400 rounded-full flex items-center justify-center shadow-md border border-white/30">
        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <span className="text-sm font-semibold text-white tracking-wide">
        {formatDuration(totalWorkoutTime)}
      </span>
    </div>
  );
}
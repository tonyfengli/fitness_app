"use client";

import React from "react";
import type { CircuitConfig, RoundData } from "@acme/ui-shared";

interface LightingTabProps {
  circuitConfig?: CircuitConfig | null;
  roundsData?: RoundData[];
}

export function LightingTab({ circuitConfig, roundsData }: LightingTabProps) {
  // Generate lighting configurations from actual workout data
  const roundsWithLighting = React.useMemo(() => {
    if (!circuitConfig?.config?.roundTemplates || !roundsData) {
      return [];
    }

    return roundsData.map((round, index) => {
      const roundTemplate = circuitConfig.config.roundTemplates[index]?.template;
      if (!roundTemplate) return null;

      const roundType = roundTemplate.type;
      
      // Calculate duration
      let duration = "0:00";
      if (roundType === 'amrap_round') {
        const totalTime = (roundTemplate as any).totalDuration || 300;
        const mins = Math.floor(totalTime / 60);
        const secs = totalTime % 60;
        duration = `${mins}:${secs.toString().padStart(2, '0')}`;
      } else if (roundType === 'circuit_round' || roundType === 'stations_round') {
        const workTime = (roundTemplate as any).workDuration || 45;
        const restTime = (roundTemplate as any).restDuration || 15;
        const sets = (roundTemplate as any).repeatTimes || 1;
        const exercisesCount = round.exercises?.length || 1;
        const totalTime = (workTime + restTime) * exercisesCount * sets;
        const mins = Math.floor(totalTime / 60);
        const secs = totalTime % 60;
        duration = `${mins}:${secs.toString().padStart(2, '0')}`;
      }

      // Generate granular lighting configuration based on actual structure
      let phases: any[] = [];
      
      if (roundType === 'stations_round') {
        // Get unique stations from exercises
        const stations = Array.from(new Set(round.exercises?.map((ex: any) => ex.orderIndex) || [])).sort();
        
        phases = [
          { type: "preview", label: "Round Preview", config: { global: { color: "#4F46E5", brightness: 40, active: true } } },
        ];
        
        // Add phase for each station
        stations.forEach((stationIndex) => {
          const stationExercises = round.exercises?.filter((ex: any) => ex.orderIndex === stationIndex) || [];
          const exerciseNames = stationExercises.map((ex: any) => ex.exerciseName).join(", ");
          
          phases.push({
            type: "work",
            label: `Station ${stationIndex + 1}: ${exerciseNames}`,
            stationIndex,
            config: {
              [`station_${stationIndex + 1}`]: { 
                color: `hsl(${(stationIndex * 60) % 360}, 70%, 55%)`, // Generate distinct colors
                brightness: 95, 
                active: true 
              },
              global: { color: "#2D1508", brightness: 20, active: true }
            }
          });
        });
        
        phases.push(
          { type: "rest", label: "Exercise Rest", config: { global: { color: "#5DE1FF", brightness: 60, active: true } } },
          { type: "setBreak", label: "Set Break", config: { global: { color: "#8B5CF6", brightness: 40, active: true } } }
        );
        
      } else if (roundType === 'circuit_round') {
        phases = [
          { type: "preview", label: "Round Preview", config: { global: { color: "#4F46E5", brightness: 40, active: true } } },
        ];
        
        // Add phase for each exercise
        round.exercises?.forEach((exercise: any, index: number) => {
          phases.push({
            type: "work",
            label: `${exercise.exerciseName}`,
            exerciseIndex: index,
            config: {
              [`exercise_${index + 1}`]: { 
                color: `hsl(${(index * 45) % 360}, 75%, 60%)`, // Generate distinct colors
                brightness: 90, 
                active: true 
              },
              global: { color: "#1F2937", brightness: 15, active: true }
            }
          });
          
          // Add rest phase between exercises (except after last)
          if (index < (round.exercises?.length || 0) - 1) {
            phases.push({
              type: "rest",
              label: "Exercise Rest",
              config: { global: { color: "#5DE1FF", brightness: 50, active: true } }
            });
          }
        });
        
      } else if (roundType === 'amrap_round') {
        phases = [
          { type: "preview", label: "Round Preview", config: { global: { color: "#4F46E5", brightness: 40, active: true } } },
          { 
            type: "work", 
            label: "AMRAP Work", 
            exercises: round.exercises?.map((ex: any, i: number) => ({
              name: ex.exerciseName,
              color: `hsl(${(i * 40) % 360}, 65%, 58%)` // Different color per exercise
            })),
            config: { 
              main: { color: "#EF4444", brightness: 95, active: true },
              ...Object.fromEntries(
                (round.exercises || []).map((ex: any, i: number) => [
                  `exercise_${i + 1}`,
                  { color: `hsl(${(i * 40) % 360}, 65%, 58%)`, brightness: 80, active: true }
                ])
              )
            } 
          },
          { type: "warning", label: "Final Warning", config: { global: { color: "#F59E0B", brightness: 100, active: true } } }
        ];
      }

      return {
        id: index + 1,
        name: round.roundName,
        type: roundType,
        duration,
        lightingConfigured: true, // Default to configured for demo
        phases
      };
    }).filter(Boolean);
  }, [circuitConfig, roundsData]);

  // Helper function to render light bulb with color and state
  const LightBulb = ({ color, brightness, active, size = "w-8 h-8" }: { color: string, brightness: number, active: boolean, size?: string }) => (
    <div className={`${size} relative`}>
      <div 
        className={`w-full h-full rounded-full border-2 transition-all ${active ? 'border-gray-300' : 'border-gray-400'}`}
        style={{ 
          backgroundColor: active ? color : '#E5E7EB',
          opacity: active ? brightness / 100 : 0.3,
          boxShadow: active ? `0 0 12px ${color}40` : 'none'
        }}
      />
      {active && (
        <div className="absolute inset-0 rounded-full animate-pulse" 
             style={{ backgroundColor: color, opacity: 0.2 }} />
      )}
    </div>
  );

  // Show fallback if no data
  if (!roundsWithLighting.length) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Lighting Configuration
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Configure workout lighting once rounds are loaded
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Lighting Configuration
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Configure lights for each workout phase
        </p>
      </div>

      {/* Rounds Visual Layout */}
      <div className="space-y-6">
        {roundsWithLighting.map((round) => (
          <div key={round.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800">
            
            {/* Round Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                  {round.name}
                </h3>
                <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded uppercase font-medium text-gray-600 dark:text-gray-400">
                  {round.type.replace('_', ' ')}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {round.duration}
                </span>
              </div>
              
              <button className={`px-3 py-1.5 rounded text-sm font-medium ${
                round.lightingConfigured 
                  ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
                {round.lightingConfigured ? 'Edit Lights' : 'Configure'}
              </button>
            </div>

            {/* Clean Lighting Timeline */}
            <div className="space-y-6 p-1">
              
              {round.lightingConfigured && round.phases ? (
                <div className="space-y-6">
                  {/* Workout Phases */}
                  {round.phases.map((phase, i) => (
                    <div key={i} className="relative flex items-center justify-center">
                      {/* Timeline connector - connects circle to circle */}
                      {i < round.phases.length - 1 && (
                        <div className="absolute top-20 w-0.5 h-12 bg-gray-300 dark:bg-gray-600 z-0" />
                      )}
                      
                      <div className="flex flex-col items-center space-y-3 relative z-10">
                        {/* Large Interactive Light Circle - FOCAL POINT */}
                        <button 
                          className="group relative w-20 h-20 rounded-full flex items-center justify-center border-4 border-white shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-purple-500/30"
                          style={{ 
                            backgroundColor: Object.values(phase.config)[0]?.color || '#6B7280',
                            opacity: Object.values(phase.config)[0]?.active ? Math.max(0.8, Object.values(phase.config)[0]?.brightness / 100) : 0.4,
                            boxShadow: Object.values(phase.config)[0]?.active ? `0 0 30px ${Object.values(phase.config)[0]?.color}50, 0 8px 25px rgba(0,0,0,0.15)` : '0 8px 25px rgba(0,0,0,0.15)'
                          }}
                        >
                          <div className="text-xs font-extrabold uppercase tracking-wider text-center leading-tight text-white drop-shadow-lg">
                            {phase.type === 'setBreak' ? 'SET\nBREAK' : phase.type}
                          </div>
                          
                          {/* Edit indicator on hover */}
                          <div className="absolute inset-0 rounded-full bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </div>
                        </button>
                        
                        {/* Minimal Phase Label - Secondary */}
                        <div className="text-center">
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 px-3 py-1 rounded-lg">
                            {phase.label}
                          </div>
                          
                          {/* Exercise list for AMRAP rounds */}
                          {phase.type === 'work' && phase.exercises && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 mt-2">
                              {phase.exercises.map((exercise: any, i: number) => (
                                <div key={i} className="flex items-center justify-center gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: exercise.color }}
                                  />
                                  <span>{exercise.name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
                  No timeline configuration set up
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
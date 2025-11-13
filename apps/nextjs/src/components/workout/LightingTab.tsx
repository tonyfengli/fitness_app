"use client";

import React from "react";
import type { CircuitConfig, RoundData } from "@acme/ui-shared";

interface LightingTabProps {
  circuitConfig?: CircuitConfig | null;
  roundsData?: RoundData[];
  onConfigureLight?: (config: { roundId: number; phaseType: string }) => void;
}

export function LightingTab({ circuitConfig, roundsData, onConfigureLight }: LightingTabProps) {
  // State for controlling round view modes (global vs detailed)
  const [detailedRounds, setDetailedRounds] = React.useState<Record<number, boolean>>({});
  
  const toggleRoundMode = (roundId: number) => {
    setDetailedRounds(prev => ({ ...prev, [roundId]: !prev[roundId] }));
  };

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

      // Generate both global and detailed timeline configurations
      let globalPhases: any[] = [];
      let detailedPhases: any[] = [];
      
      if (roundType === 'stations_round') {
        const stations = Array.from(new Set(round.exercises?.map((ex: any) => ex.orderIndex) || [])).sort();
        
        // Global view - simplified timeline
        globalPhases = [
          { type: "preview", label: "Round Preview", config: { color: "#4F46E5", brightness: 40, active: true } },
          { type: "work", label: "Station Work", config: { color: "#FFB366", brightness: 95, active: true } },
          { type: "rest", label: "Exercise Rest", config: { color: "#5DE1FF", brightness: 60, active: true } },
          { type: "setBreak", label: "Set Break", config: { color: "#8B5CF6", brightness: 40, active: true } }
        ];
        
        // Detailed view - complete station-by-station breakdown
        detailedPhases = [
          { type: "preview", label: "Round Preview", config: { color: "#4F46E5", brightness: 40, active: true } }
        ];
        
        // Add each station as individual phases
        stations.forEach((stationIndex) => {
          const stationExercises = round.exercises?.filter((ex: any) => ex.orderIndex === stationIndex) || [];
          const exerciseNames = stationExercises.map((ex: any) => ex.exerciseName).join(", ");
          
          detailedPhases.push({
            type: "work",
            label: `Station ${stationIndex + 1}: ${exerciseNames}`,
            config: { color: `hsl(${(stationIndex * 60) % 360}, 70%, 55%)`, brightness: 95, active: true }
          });
          
          // Add rest after each station (except last)
          if (stationIndex < stations[stations.length - 1]) {
            detailedPhases.push({
              type: "rest",
              label: "Rest",
              config: { color: "#5DE1FF", brightness: 40, active: true }
            });
          }
        });
        
        
      } else if (roundType === 'circuit_round') {
        // Global view
        globalPhases = [
          { type: "preview", label: "Round Preview", config: { color: "#4F46E5", brightness: 40, active: true } },
          { type: "work", label: "Exercise Work", config: { color: "#EF4444", brightness: 90, active: true } },
          { type: "rest", label: "Exercise Rest", config: { color: "#5DE1FF", brightness: 50, active: true } }
        ];
        
        // Detailed view - exercise by exercise
        detailedPhases = [
          { type: "preview", label: "Round Preview", config: { color: "#4F46E5", brightness: 40, active: true } }
        ];
        
        round.exercises?.forEach((exercise: any, index: number) => {
          detailedPhases.push({
            type: "work",
            label: exercise.exerciseName,
            config: { color: `hsl(${(index * 45) % 360}, 75%, 60%)`, brightness: 90, active: true }
          });
          
          // Add rest between exercises (except after last)
          if (index < (round.exercises?.length || 0) - 1) {
            detailedPhases.push({
              type: "rest",
              label: "Rest",
              config: { color: "#5DE1FF", brightness: 35, active: true }
            });
          }
        });
        
        
      } else if (roundType === 'amrap_round') {
        // Global view
        globalPhases = [
          { type: "preview", label: "Round Preview", config: { color: "#4F46E5", brightness: 40, active: true } },
          { type: "work", label: "AMRAP Work", config: { color: "#EF4444", brightness: 95, active: true } },
          { type: "warning", label: "Final Warning", config: { color: "#F59E0B", brightness: 100, active: true } }
        ];
        
        // Detailed view - exercise zones + alerts
        detailedPhases = [
          { type: "preview", label: "Round Preview", config: { color: "#4F46E5", brightness: 40, active: true } }
        ];
        
        // Add exercise zones
        round.exercises?.forEach((ex: any, i: number) => {
          detailedPhases.push({
            type: "work",
            label: `${ex.exerciseName} Zone`,
            config: { color: `hsl(${(i * 40) % 360}, 65%, 58%)`, brightness: 80, active: true }
          });
        });
        
      }

      return {
        id: index + 1,
        name: round.roundName,
        type: roundType,
        duration,
        lightingConfigured: true, // Default to configured for demo
        globalPhases,
        detailedPhases
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
      {/* Global Controls */}
      <div className="flex justify-between items-center py-4 px-1">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Lighting Setup
          </h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {roundsWithLighting.length} rounds
          </span>
        </div>
        
        {/* Global Lighting Control */}
        <button className="flex items-center gap-2 px-5 py-3 bg-purple-500 hover:bg-purple-600 active:bg-purple-700 text-white rounded-xl font-semibold text-sm transition-all duration-150 shadow-lg hover:shadow-xl active:scale-95 group">
          <svg className="w-4 h-4 group-hover:animate-pulse" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .5.4 1 1 1h6c.6 0 1-.5 1-1v-2.3c1.8-1.2 3-3.3 3-5.7 0-3.9-3.1-7-7-7z"/>
          </svg>
          <span>All Rounds</span>
        </button>
      </div>

      {/* Rounds Visual Layout */}
      <div className="space-y-6">
        {roundsWithLighting.map((round) => (
          <div key={round.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800">
            
            {/* Round Header */}
            <div className="flex items-center justify-between mb-8">
              {/* Primary Info - Left Side */}
              <div className="flex flex-col gap-1">
                {/* 1. Round Name - Highest Priority */}
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Round {round.id}
                </h3>
                
                {/* 2. Round Type - Secondary Priority */}
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {round.type === 'stations_round' ? 'Stations' : 
                   round.type === 'circuit_round' ? 'Circuit' : 
                   round.type === 'amrap_round' ? 'AMRAP' : round.type}
                </span>
              </div>
              
              {/* Actions - Right Side */}
              <div className="flex items-center gap-3">
                {/* 3. View Toggle - Third Priority */}
                {round.type !== 'amrap_round' && (
                  <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                    <button
                      onClick={() => toggleRoundMode(round.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        !detailedRounds[round.id]
                          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      Master
                    </button>
                    <button
                      onClick={() => toggleRoundMode(round.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        detailedRounds[round.id]
                          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      Custom
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Clean Lighting Timeline */}
            <div className="space-y-6 p-1">
              
              {round.lightingConfigured ? (
                <div className="space-y-6">
                  
                  {/* Workout Phases Timeline */}
                  {(() => {
                    // Force global view for AMRAP rounds
                    const currentPhases = (detailedRounds[round.id] && round.type !== 'amrap_round') ? round.detailedPhases : round.globalPhases;
                    const isDetailed = detailedRounds[round.id] && round.type !== 'amrap_round';
                    
                    if (isDetailed) {
                      // Detailed view: Group work phases with their corresponding rest phases
                      const workPhases = currentPhases.filter(phase => phase.type === 'work');
                      const restPhases = currentPhases.filter(phase => phase.type === 'rest');
                      const otherPhases = currentPhases.filter(phase => !['work', 'rest'].includes(phase.type));
                      
                      // Group phases by type for non-work/rest phases
                      const groupedOtherPhases = otherPhases.reduce((acc, phase) => {
                        const key = phase.type;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(phase);
                        return acc;
                      }, {} as Record<string, any[]>);
                      
                      const phaseTypeConfig = {
                        preview: { 
                          title: "Setup & Preview", 
                          description: "Round preparation lighting",
                          icon: "👁️"
                        },
                        warning: { 
                          title: "Alert System", 
                          description: "Time warnings and alerts",
                          icon: "⚠️"
                        },
                        setBreak: { 
                          title: "Set Breaks", 
                          description: "Between sets/rounds",
                          icon: "🔄"
                        }
                      };
                      
                      return (
                        <div className="space-y-8">
                          {/* Clean vertical flow with consistent alignment */}
                          {(() => {
                            const processedPhases: any[] = [];
                            let displayCounter = 1;
                            
                            // Process phases and group work+rest pairs
                            for (let i = 0; i < currentPhases.length; i++) {
                              const phase = currentPhases[i];
                              const nextPhase = currentPhases[i + 1];
                              const isWorkPhase = phase.type === 'work';
                              const hasCorrespondingRest = isWorkPhase && nextPhase?.type === 'rest';
                              
                              if (hasCorrespondingRest) {
                                // Work+Rest pair
                                processedPhases.push({
                                  type: 'pair',
                                  number: displayCounter++,
                                  workPhase: phase,
                                  restPhase: nextPhase,
                                  key: `pair-${i}`
                                });
                                i++; // Skip the rest phase as it's included in the pair
                              } else {
                                // Single phase
                                processedPhases.push({
                                  type: 'single',
                                  number: displayCounter++,
                                  phase: phase,
                                  key: `single-${i}`
                                });
                              }
                            }
                            
                            return processedPhases.map((item, index) => {
                              if (item.type === 'pair') {
                                // Work+Rest pair in horizontal layout
                                return (
                                  <div key={item.key} className="group">
                                    {/* Consistent header structure */}
                                    <div className="flex items-center gap-4 mb-6">
                                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                        <span className="text-sm font-bold text-gray-600 dark:text-gray-300">
                                          {item.number}
                                        </span>
                                      </div>
                                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        {item.workPhase.label}
                                      </h3>
                                    </div>

                                    {/* Work + Rest lights in horizontal layout */}
                                    <div className="flex items-center justify-center gap-8">
                                      {/* Work Light */}
                                      <div className="text-center group/light">
                                        <button 
                                          onClick={() => onConfigureLight?.({ roundId: round.id, phaseType: 'work' })}
                                          className="relative w-20 h-20 rounded-full border-4 border-white shadow-lg active:scale-95 transition-transform duration-150 active:shadow-xl"
                                          style={{ 
                                            backgroundColor: item.workPhase.config?.color || '#6B7280',
                                            opacity: item.workPhase.config?.active ? Math.max(0.9, item.workPhase.config?.brightness / 100) : 0.5,
                                            boxShadow: item.workPhase.config?.active ? `0 0 32px ${item.workPhase.config?.color}40, 0 8px 25px rgba(0,0,0,0.15)` : '0 8px 25px rgba(0,0,0,0.15)'
                                          }}
                                        >
                                          <div className="text-xs font-black uppercase tracking-wider text-center leading-tight text-white drop-shadow-lg">
                                            WORK
                                          </div>
                                        </button>
                                      </div>

                                      {/* Flow connector */}
                                      <div className="flex items-center px-2">
                                        <div className="w-12 h-0.5 bg-gray-300 dark:bg-gray-600 relative">
                                          <div className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[5px] border-l-gray-300 dark:border-l-gray-600 border-t-[3px] border-b-[3px] border-t-transparent border-b-transparent"></div>
                                        </div>
                                      </div>

                                      {/* Rest Light */}
                                      <div className="text-center group/light">
                                        <button 
                                          onClick={() => onConfigureLight?.({ roundId: round.id, phaseType: 'rest' })}
                                          className="relative w-20 h-20 rounded-full border-4 border-white shadow-lg active:scale-95 transition-transform duration-150 active:shadow-xl"
                                          style={{ 
                                            backgroundColor: item.restPhase.config?.color || '#6B7280',
                                            opacity: item.restPhase.config?.active ? Math.max(0.9, item.restPhase.config?.brightness / 100) : 0.5,
                                            boxShadow: item.restPhase.config?.active ? `0 0 32px ${item.restPhase.config?.color}40, 0 8px 25px rgba(0,0,0,0.15)` : '0 8px 25px rgba(0,0,0,0.15)'
                                          }}
                                        >
                                          <div className="text-xs font-black uppercase tracking-wider text-center leading-tight text-white drop-shadow-lg">
                                            REST
                                          </div>
                                        </button>
                                      </div>
                                    </div>
                                    
                                  </div>
                                );
                              } else {
                                // Single phase with consistent layout
                                return (
                                  <div key={item.key} className="group">
                                    {/* Consistent header structure */}
                                    <div className="flex items-center gap-4 mb-6">
                                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                        <span className="text-sm font-bold text-gray-600 dark:text-gray-300">
                                          {item.number}
                                        </span>
                                      </div>
                                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        {item.phase.label}
                                      </h3>
                                    </div>

                                    {/* Single light centered */}
                                    <div className="flex justify-center">
                                      <div className="text-center group/light">
                                        <button 
                                          onClick={() => onConfigureLight?.({ roundId: round.id, phaseType: item.phase.type })}
                                          className="relative w-20 h-20 rounded-full border-4 border-white shadow-lg active:scale-95 transition-transform duration-150 active:shadow-xl"
                                          style={{ 
                                            backgroundColor: item.phase.config?.color || '#6B7280',
                                            opacity: item.phase.config?.active ? Math.max(0.9, item.phase.config?.brightness / 100) : 0.5,
                                            boxShadow: item.phase.config?.active ? `0 0 32px ${item.phase.config?.color}40, 0 8px 25px rgba(0,0,0,0.15)` : '0 8px 25px rgba(0,0,0,0.15)'
                                          }}
                                        >
                                          <div className="text-xs font-black uppercase tracking-wider text-center leading-tight text-white drop-shadow-lg">
                                            {item.phase.type === 'setBreak' ? 'SET' : 
                                             item.phase.type === 'work' ? 'WORK' :
                                             item.phase.type === 'preview' ? 'PRE' :
                                             item.phase.type === 'warning' ? 'WARN' :
                                             item.phase.type.slice(0,3)}
                                          </div>
                                        </button>
                                      </div>
                                    </div>
                                    
                                  </div>
                                );
                              }
                            });
                          })()}
                        </div>
                      );
                    } else {
                      // Global view: Clean timeline with larger, more prominent circles
                      return (
                        <div className="space-y-8">
                          {currentPhases.map((phase, i) => (
                            <div key={i} className="relative">
                              <div className="flex items-center gap-6">
                                {/* Phase Number */}
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                  <span className="text-sm font-bold text-gray-600 dark:text-gray-300">
                                    {i + 1}
                                  </span>
                                </div>
                                
                                {/* Phase Content */}
                                <div className="flex-1 flex items-center gap-6">
                                  {/* Light Preview */}
                                  <button 
                                    onClick={() => onConfigureLight?.({ roundId: round.id, phaseType: phase.type })}
                                    className="relative w-20 h-20 rounded-full flex items-center justify-center border-4 border-white shadow-lg active:scale-95 transition-transform duration-150 active:shadow-xl"
                                    style={{ 
                                      backgroundColor: phase.config?.color || '#6B7280',
                                      opacity: phase.config?.active ? Math.max(0.85, phase.config?.brightness / 100) : 0.4,
                                      boxShadow: phase.config?.active ? `0 0 24px ${phase.config?.color}50, 0 8px 25px rgba(0,0,0,0.15)` : '0 8px 25px rgba(0,0,0,0.15)'
                                    }}
                                  >
                                    <div className="text-xs font-extrabold uppercase tracking-wider text-center leading-tight text-white drop-shadow-lg">
                                      {phase.type === 'setBreak' ? 'SET\nBREAK' : phase.type}
                                    </div>
                                    
                                    {/* Edit indicator on hover */}
                                    <div className="absolute inset-0 rounded-full bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                      </svg>
                                    </div>
                                  </button>
                                  
                                  {/* Phase Details */}
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                                      {phase.label}
                                    </h4>
                                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                                      <span className="capitalize">{phase.type.replace(/([A-Z])/g, ' $1').trim()}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Timeline connector */}
                              {i < currentPhases.length - 1 && (
                                <div className="ml-4 w-0.5 h-6 bg-gray-300 dark:bg-gray-600 mt-4" />
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    }
                  })()}
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
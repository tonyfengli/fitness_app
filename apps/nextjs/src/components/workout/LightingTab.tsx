"use client";

import React from "react";
import type { CircuitConfig, RoundData } from "@acme/ui-shared";
import { api } from "~/trpc/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { OptionsDrawer } from "./OptionsDrawer";
import { AllRoundsLightingDrawer } from "./AllRoundsLightingDrawer";
import { RoundLightingDrawer } from "./RoundLightingDrawer";

interface LightingTabProps {
  sessionId?: string | null;
  circuitConfig?: CircuitConfig | null;
  roundsData?: RoundData[];
  onConfigureLight?: (config: { roundId: number; phaseType: string; isDetailedView?: boolean }) => void;
  onLightingStateChange?: (isEnabled: boolean) => void;
}

export function LightingTab({ sessionId, circuitConfig, roundsData, onConfigureLight, onLightingStateChange }: LightingTabProps) {
  console.log('[LightingTab] Component mounted/rendered');
  
  // State for All Rounds drawer
  const [isAllRoundsDrawerOpen, setIsAllRoundsDrawerOpen] = React.useState(false);
  
  // State for Round Settings drawer
  const [roundSettingsDrawer, setRoundSettingsDrawer] = React.useState<{isOpen: boolean; roundId: number | null}>({
    isOpen: false,
    roundId: null
  });
  
  // State for special effects testing
  const [selectedSpecialEffect, setSelectedSpecialEffect] = React.useState("");
  const [applyingEffect, setApplyingEffect] = React.useState(false);
  
  const trpc = api();
  const queryClient = useQueryClient();
  
  // Note: We're not checking lighting system status since we're using
  // the remote API directly, which doesn't require local bridge connection
  
  // Query current light state on mount to set initial toggle position
  const { data: lightsData, isLoading: lightsLoading, error: lightsError } = useQuery({
    ...trpc.lighting.getLights.queryOptions(),
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: false, // Don't refetch on reconnect
  });
  
  // Log the query state for debugging
  React.useEffect(() => {
    console.log('[LightingTab] Lights query state:', {
      isLoading: lightsLoading,
      hasData: !!lightsData,
      dataLength: lightsData?.length,
      error: lightsError,
      lightsData: lightsData
    });
  }, [lightsLoading, lightsData, lightsError]);
  
  
  // Get current lighting configuration from backend
  const { data: lightingConfig, dataUpdatedAt } = useQuery({
    ...trpc.lightingConfig.get.queryOptions({ sessionId: sessionId! }),
    enabled: !!sessionId
  });
  
  // Get scenes data to extract colors from scene names
  const { data: rawScenes } = useQuery({
    ...trpc.lighting.getScenes.queryOptions(),
  });
  
  // Helper function to extract color from scene name
  const getSceneColor = React.useCallback((sceneId: string): string | null => {
    if (!rawScenes) return null;
    const scene = rawScenes.find(s => s.id === sceneId);
    if (!scene) return null;
    
    // Extract color from name if present (e.g., "Pink Special Effects 1 (#d36972)")
    const colorMatch = scene.name.match(/#([a-fA-F0-9]{6})/);
    return colorMatch ? `#${colorMatch[1]}` : null;
  }, [rawScenes]);
  
  // Helper function to get effective scene for a phase (3-level hierarchy)
  const getEffectiveScene = React.useCallback((roundId: number, phaseType: string, isDetailedView: boolean) => {
    if (!lightingConfig) return null;
    
    const roundKey = `round-${roundId}`;
    
    // 1. Check specific custom override first (e.g., work-station-0)
    const customOverride = lightingConfig.roundOverrides?.[roundKey]?.[phaseType];
    if (customOverride) return customOverride;
    
    // 2. Check round master default (e.g., round-1.work for work-station-0)
    const basePhaseType = phaseType.split('-')[0]; // work-station-0 → work, rest-after-exercise-1 → rest
    const roundMaster = lightingConfig.roundOverrides?.[roundKey]?.[basePhaseType];
    if (roundMaster) return roundMaster;
    
    // 3. Fallback to global default
    const globalDefault = lightingConfig.globalDefaults[basePhaseType as keyof typeof lightingConfig.globalDefaults];
    return globalDefault || null;
  }, [lightingConfig]);
  
  // Helper function to determine if a round has any lighting configured
  const isRoundConfigured = React.useCallback((roundId: number): boolean => {
    if (!lightingConfig) return false;
    
    // Check if any global defaults are set
    const hasGlobalDefaults = Object.values(lightingConfig.globalDefaults).some(config => config);
    
    // Check if this specific round has overrides
    const roundKey = `round-${roundId}`;
    const hasRoundOverrides = lightingConfig.roundOverrides?.[roundKey] && 
      Object.values(lightingConfig.roundOverrides[roundKey]).some(config => config);
    
    return hasGlobalDefaults || hasRoundOverrides;
  }, [lightingConfig]);
  
  // Helper function to detect mixed state (master + custom overrides exist)
  const hasCustomOverrides = React.useCallback((roundId: number, basePhaseType: string): boolean => {
    if (!lightingConfig) return false;
    
    const roundKey = `round-${roundId}`;
    const roundConfig = lightingConfig.roundOverrides?.[roundKey];
    if (!roundConfig) return false;
    
    // Check if any keys start with basePhaseType- (e.g., work-station-, work-exercise-)
    return Object.keys(roundConfig).some(key => key.startsWith(`${basePhaseType}-`));
  }, [lightingConfig]);
  
  // Helper function to get the scene name for a phase
  const getSceneName = React.useCallback((roundId: number, phaseType: string, isDetailedView: boolean): string => {
    const effectiveScene = getEffectiveScene(roundId, phaseType, isDetailedView);
    return effectiveScene?.sceneName || 'No scene selected';
  }, [getEffectiveScene]);
  
  // Helper function to generate phase config based on saved scene or fallback
  const generatePhaseConfig = React.useCallback((roundId: number, phaseType: string, isDetailedView: boolean, fallbackColor?: string) => {
    // If lighting config or scenes are still loading, show grey to prevent flash
    if (!lightingConfig || !rawScenes) {
      return {
        color: '#E5E7EB', // Grey while loading
        brightness: 30, // Low opacity
        active: false,
        isMixed: false
      };
    }
    
    const effectiveScene = getEffectiveScene(roundId, phaseType, isDetailedView);
    
    // Check for mixed state in Master view (when master exists but custom overrides also exist)
    const basePhaseType = phaseType.split('-')[0];
    const isMasterView = !isDetailedView && !phaseType.includes('-');
    const hasMixed = isMasterView && hasCustomOverrides(roundId, basePhaseType);
    
    if (effectiveScene) {
      const sceneColor = getSceneColor(effectiveScene.sceneId);
      // Only use fallback color if scene has no hex code AND data is loaded
      const finalColor = sceneColor || fallbackColor || '#6B7280';
      
      return {
        color: finalColor,
        brightness: hasMixed ? 70 : 90, // Dimmer brightness for mixed state
        active: true,
        isMixed: hasMixed // Flag for special styling
      };
    }
    
    // No scene configured - show as disabled/grey
    return {
      color: '#E5E7EB', // Grey for unconfigured
      brightness: 30, // Low opacity
      active: false,
      isMixed: false
    };
  }, [getEffectiveScene, getSceneColor, hasCustomOverrides, lightingConfig, rawScenes]);
  
  
  // Handle special effects testing
  const handleApplySpecialEffect = async () => {
    if (!selectedSpecialEffect || applyingEffect) return;
    
    setApplyingEffect(true);
    
    try {
      // Create test effect based on selection
      const effectConfig = getSpecialEffectConfig(selectedSpecialEffect);
      
      // Apply the effect using existing lighting system
      const response = await fetch('/api/lighting/apply-effect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          effectType: selectedSpecialEffect,
          config: effectConfig,
          sessionId
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to apply lighting effect');
      }
      
      // Reset selection after successful application
      setSelectedSpecialEffect("");
      
    } catch (error) {
      console.error('Error applying special effect:', error);
    } finally {
      setApplyingEffect(false);
    }
  };
  
  // Generate effect configurations
  const getSpecialEffectConfig = (effectType: string) => {
    switch (effectType) {
      case 'accelerating-countdown':
        return { animation: 'countdown-pulse', duration: 5000, intensity: 'high' };
      case 'victory-celebration':
        return { animation: 'rainbow-cycle', duration: 3000, intensity: 'max' };
      case 'heartrate-pulse':
        return { animation: 'pulse', duration: 1000, color: '#FF4444', intensity: 'medium' };
      case 'intensity-gradient':
        return { animation: 'gradient-shift', duration: 10000, colors: ['#FF0000', '#FF8800', '#FFFF00'], intensity: 'high' };
      case 'breathing-guide':
        return { animation: 'breathe', duration: 4000, color: '#00AA88', intensity: 'low' };
      case 'round-transition':
        return { animation: 'wave-flash', duration: 2000, intensity: 'max' };
      case 'motivation-blast':
        return { animation: 'strobe', duration: 1500, color: '#8800FF', intensity: 'high' };
      case 'focus-zone':
        return { animation: 'steady-glow', duration: 0, color: '#0066FF', intensity: 'medium' };
      default:
        return { animation: 'flash', duration: 500, intensity: 'medium' };
    }
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
        
        // Detailed view - complete station-by-station breakdown
        detailedPhases = [
          { type: "preview", label: "Round Preview", config: generatePhaseConfig(index + 1, "preview", true, "#4F46E5") }
        ];
        
        // Add each station as individual phases
        stations.forEach((stationOrderIndex, sequentialIndex) => {
          const stationExercises = round.exercises?.filter((ex: any) => ex.orderIndex === stationOrderIndex) || [];
          const exerciseNames = stationExercises.map((ex: any) => ex.exerciseName).join(", ");
          
          detailedPhases.push({
            type: `work-station-${sequentialIndex}`,
            label: `Station ${stationOrderIndex + 1}: ${exerciseNames}`,
            config: generatePhaseConfig(index + 1, `work-station-${sequentialIndex}`, true, `hsl(${(sequentialIndex * 60) % 360}, 70%, 55%)`)
          });
          
          // Add rest after each station (except last)
          if (sequentialIndex < stations.length - 1) {
            detailedPhases.push({
              type: `rest-after-station-${sequentialIndex}`,
              label: "Rest",
              config: generatePhaseConfig(index + 1, `rest-after-station-${sequentialIndex}`, true, "#5DE1FF")
            });
          }
        });
        
        
      } else if (roundType === 'circuit_round') {
        // Detailed view - exercise by exercise
        detailedPhases = [
          { type: "preview", label: "Round Preview", config: generatePhaseConfig(index + 1, "preview", true, "#4F46E5") }
        ];
        
        round.exercises?.forEach((exercise: any, exerciseIndex: number) => {
          detailedPhases.push({
            type: `work-exercise-${exerciseIndex}`,
            label: exercise.exerciseName,
            config: generatePhaseConfig(index + 1, `work-exercise-${exerciseIndex}`, true, `hsl(${(exerciseIndex * 45) % 360}, 75%, 60%)`)
          });
          
          // Add rest between exercises (except after last)
          if (exerciseIndex < (round.exercises?.length || 0) - 1) {
            detailedPhases.push({
              type: `rest-after-exercise-${exerciseIndex}`,
              label: "Rest",
              config: generatePhaseConfig(index + 1, `rest-after-exercise-${exerciseIndex}`, true, "#5DE1FF")
            });
          }
        });
        
        
      } else if (roundType === 'amrap_round') {
        // AMRAP has only 2 phases: Preview and continuous Work
        detailedPhases = [
          { type: "preview", label: "Round Preview", config: generatePhaseConfig(index + 1, "preview", true, "#4F46E5") },
          { type: "work", label: "AMRAP Work", config: generatePhaseConfig(index + 1, "work", true, "#EF4444") }
        ];
        
      }

      return {
        id: index + 1,
        name: round.roundName,
        type: roundType,
        duration,
        lightingConfigured: isRoundConfigured(index + 1),
        detailedPhases
      };
    }).filter(Boolean);
  }, [circuitConfig, roundsData, generatePhaseConfig, isRoundConfigured, getSceneName, lightingConfig, rawScenes, dataUpdatedAt]);

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
      {/* Rounds Visual Layout */}
      <div className="space-y-6">
        {roundsWithLighting.map((round) => (
          <div key={round.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800 relative transition-all duration-300">
            
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
              
              {/* Quick Setup Button */}
              <button
                onClick={() => setRoundSettingsDrawer({ isOpen: true, roundId: round.id })}
                className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Quick Setup
              </button>
            </div>

            {/* Clean Lighting Timeline */}
            <div className="space-y-6 p-1">
              
              <div className="space-y-6">
                
                {/* Workout Phases Timeline - Always Detailed View */}
                <div className="space-y-8">
                  {round.detailedPhases.map((phase, i) => (
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
                            onClick={() => onConfigureLight?.({ roundId: round.id, phaseType: phase.type, isDetailedView: true })}
                            className="relative w-20 h-20 rounded-full flex items-center justify-center border-4 border-white shadow-lg active:scale-95 transition-all duration-150 active:shadow-xl"
                            style={{ 
                              backgroundColor: phase.config?.color || '#6B7280',
                              opacity: phase.config?.active ? Math.max(0.85, phase.config?.brightness / 100) : 0.4,
                              boxShadow: phase.config?.active 
                                ? `0 0 12px ${phase.config?.color}40, 0 8px 25px rgba(0,0,0,0.15)` 
                                : '0 8px 25px rgba(0,0,0,0.15)'
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
                              <span>{getSceneName(round.id, phase.type, true)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Timeline connector */}
                      {i < round.detailedPhases.length - 1 && (
                        <div className="ml-4 w-0.5 h-6 bg-gray-300 dark:bg-gray-600 mt-4" />
                      )}
                    </div>
                  ))}
                </div>
                </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Special Effects Testing Section - Moved to Bottom */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-lg p-4 mt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
              🎆 Special Effects Testing
            </h3>
            <p className="text-sm text-purple-600 dark:text-purple-300">
              Experimental lighting effects - Will be removed later
            </p>
          </div>
          
          <select 
            className="px-3 py-2 border border-purple-300 dark:border-purple-600 rounded-md bg-white dark:bg-gray-800 text-purple-900 dark:text-purple-100"
            onChange={(e) => setSelectedSpecialEffect(e.target.value)}
            value={selectedSpecialEffect}
          >
            <option value="">Select Effect...</option>
            <option value="accelerating-countdown">🚀 Accelerating Countdown</option>
            <option value="victory-celebration">🎉 Victory Celebration</option>
            <option value="heartrate-pulse">💓 Heart Rate Pulse</option>
            <option value="intensity-gradient">🔥 Intensity Gradient</option>
            <option value="breathing-guide">🧘 Breathing Guide</option>
            <option value="round-transition">⚡ Round Transition Wave</option>
            <option value="motivation-blast">💪 Motivation Blast</option>
            <option value="focus-zone">🎯 Focus Zone</option>
          </select>
          
          <button
            onClick={handleApplySpecialEffect}
            disabled={!selectedSpecialEffect || applyingEffect}
            className={`px-4 py-2 rounded-md font-medium transition-all ${
              selectedSpecialEffect && !applyingEffect
                ? 'bg-purple-500 text-white hover:bg-purple-600 shadow-lg hover:shadow-xl'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            {applyingEffect ? 'Testing...' : 'Test Effect'}
          </button>
        </div>
      </div>
      
      {/* All Rounds Drawer using OptionsDrawer */}
      <OptionsDrawer
        isOpen={isAllRoundsDrawerOpen}
        onClose={() => setIsAllRoundsDrawerOpen(false)}
        customContent={
          <AllRoundsLightingDrawer
            sessionId={sessionId}
            onClose={() => setIsAllRoundsDrawerOpen(false)}
            onSave={() => {
              setIsAllRoundsDrawerOpen(false);
              // Future: Refresh lighting config or trigger re-fetch
            }}
          />
        }
      />
      
      {/* Round Settings Drawer using OptionsDrawer */}
      <OptionsDrawer
        isOpen={roundSettingsDrawer.isOpen}
        onClose={() => setRoundSettingsDrawer({ isOpen: false, roundId: null })}
        customContent={
          roundSettingsDrawer.roundId ? (
            <RoundLightingDrawer
              sessionId={sessionId}
              roundId={roundSettingsDrawer.roundId}
              roundType={roundsWithLighting.find(r => r.id === roundSettingsDrawer.roundId)?.type}
              onClose={() => setRoundSettingsDrawer({ isOpen: false, roundId: null })}
              onSave={() => {
                setRoundSettingsDrawer({ isOpen: false, roundId: null });
              }}
            />
          ) : null
        }
      />
    </div>
  );
}


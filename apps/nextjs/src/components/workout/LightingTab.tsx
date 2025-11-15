"use client";

import React from "react";
import type { CircuitConfig, RoundData } from "@acme/ui-shared";
import { api } from "~/trpc/react";
import { useQuery } from "@tanstack/react-query";

interface LightingTabProps {
  sessionId?: string | null;
  circuitConfig?: CircuitConfig | null;
  roundsData?: RoundData[];
  onConfigureLight?: (config: { roundId: number; phaseType: string; isDetailedView?: boolean }) => void;
  onLightingStateChange?: (isEnabled: boolean) => void;
}

export function LightingTab({ sessionId, circuitConfig, roundsData, onConfigureLight, onLightingStateChange }: LightingTabProps) {
  // State for controlling round view modes (global vs detailed)
  const [detailedRounds, setDetailedRounds] = React.useState<Record<number, boolean>>({});
  
  // State for global lighting on/off
  const [isLightingEnabled, setIsLightingEnabled] = React.useState(true);
  
  const trpc = api();
  
  // Debug: Log component mount and sessionId
  console.log('[LightingTab] Component rendered with sessionId:', sessionId);
  
  // Get current lighting configuration from backend
  const { data: lightingConfig, isLoading: isLoadingLightingConfig, dataUpdatedAt } = useQuery({
    ...trpc.lightingConfig.get.queryOptions({ sessionId: sessionId! }),
    enabled: !!sessionId
  });
  
  // Debug: Log query state and data changes
  console.log('[LightingTab] Query state:', { 
    hasLightingConfig: !!lightingConfig, 
    isLoadingLightingConfig, 
    dataUpdatedAt: new Date(dataUpdatedAt || 0).toISOString(),
    sessionId 
  });
  
  // Debug: Log when lightingConfig changes
  React.useEffect(() => {
    console.log('[LightingTab] Lighting config updated:', lightingConfig);
    console.log('[LightingTab] Using sessionId:', sessionId);
    console.log('[LightingTab] Data updated at:', new Date(dataUpdatedAt || 0).toISOString());
    const queryKey = trpc.lightingConfig.get.queryOptions({ sessionId: sessionId! }).queryKey;
    console.log('[LightingTab] Listening to query key:', queryKey);
  }, [lightingConfig, sessionId, trpc, dataUpdatedAt]);
  
  // Get scenes data to extract colors from scene names
  const { data: rawScenes } = useQuery({
    ...trpc.lighting.getRemoteScenes.queryOptions(),
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
    if (customOverride) {
      console.log(`[LightingTab] Found custom override for ${roundKey} ${phaseType}:`, customOverride);
      return customOverride;
    }
    
    // 2. Check round master default (e.g., round-1.work for work-station-0)
    const basePhaseType = phaseType.split('-')[0]; // work-station-0 → work, rest-after-exercise-1 → rest
    const roundMaster = lightingConfig.roundOverrides?.[roundKey]?.[basePhaseType];
    if (roundMaster) {
      console.log(`[LightingTab] Found round master for ${roundKey} ${basePhaseType}:`, roundMaster);
      return roundMaster;
    }
    
    // 3. Fallback to global default
    const globalDefault = lightingConfig.globalDefaults[basePhaseType as keyof typeof lightingConfig.globalDefaults];
    if (globalDefault) {
      console.log(`[LightingTab] Using global default for ${roundKey} ${phaseType}:`, globalDefault);
    } else {
      console.log(`[LightingTab] No configuration found for ${roundKey} ${phaseType}`);
    }
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
  
  // Helper function to generate phase config based on saved scene or fallback
  const generatePhaseConfig = React.useCallback((roundId: number, phaseType: string, isDetailedView: boolean, fallbackColor?: string) => {
    console.log(`[LightingTab] Generating config for round-${roundId} phase: ${phaseType} (detailed: ${isDetailedView})`);
    
    // If lighting config or scenes are still loading, show grey to prevent flash
    if (!lightingConfig || !rawScenes) {
      console.log(`[LightingTab] Data still loading for round-${roundId} phase: ${phaseType}, showing loading grey`);
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
      console.log(`[LightingTab] Using scene ${effectiveScene.sceneName} with color: ${finalColor}${hasMixed ? ' (MIXED STATE)' : ''}`);
      
      return {
        color: finalColor,
        brightness: hasMixed ? 70 : 90, // Dimmer brightness for mixed state
        active: true,
        isMixed: hasMixed // Flag for special styling
      };
    }
    
    // No scene configured - show as disabled/grey
    console.log(`[LightingTab] No scene configured for round-${roundId} phase: ${phaseType}, using grey`);
    return {
      color: '#E5E7EB', // Grey for unconfigured
      brightness: 30, // Low opacity
      active: false,
      isMixed: false
    };
  }, [getEffectiveScene, getSceneColor, hasCustomOverrides, lightingConfig, rawScenes]);
  
  // Notify parent when lighting state changes
  React.useEffect(() => {
    if (onLightingStateChange) {
      onLightingStateChange(isLightingEnabled);
    }
  }, [isLightingEnabled, onLightingStateChange]);
  
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
          { type: "preview", label: "Round Preview", config: generatePhaseConfig(index + 1, "preview", false, "#4F46E5") },
          { type: "work", label: "Station Work", config: generatePhaseConfig(index + 1, "work", false, "#FFB366") },
          { type: "rest", label: "Exercise Rest", config: generatePhaseConfig(index + 1, "rest", false, "#5DE1FF") },
          { type: "setBreak", label: "Set Break", config: generatePhaseConfig(index + 1, "setBreak", false, "#8B5CF6") }
        ];
        
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
        // Global view
        globalPhases = [
          { type: "preview", label: "Round Preview", config: generatePhaseConfig(index + 1, "preview", false, "#4F46E5") },
          { type: "work", label: "Exercise Work", config: generatePhaseConfig(index + 1, "work", false, "#EF4444") },
          { type: "rest", label: "Exercise Rest", config: generatePhaseConfig(index + 1, "rest", false, "#5DE1FF") }
        ];
        
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
        // Global view
        globalPhases = [
          { type: "preview", label: "Round Preview", config: generatePhaseConfig(index + 1, "preview", false, "#4F46E5") },
          { type: "work", label: "AMRAP Work", config: generatePhaseConfig(index + 1, "work", false, "#EF4444") }
        ];
        
        // Detailed view - exercise zones
        detailedPhases = [
          { type: "preview", label: "Round Preview", config: generatePhaseConfig(index + 1, "preview", true, "#4F46E5") }
        ];
        
        // Add exercise zones
        round.exercises?.forEach((ex: any, exerciseIndex: number) => {
          detailedPhases.push({
            type: "work",
            label: `${ex.exerciseName} Zone`,
            config: generatePhaseConfig(index + 1, "work", true, `hsl(${(exerciseIndex * 40) % 360}, 65%, 58%)`)
          });
        });
        
      }

      return {
        id: index + 1,
        name: round.roundName,
        type: roundType,
        duration,
        lightingConfigured: isRoundConfigured(index + 1),
        globalPhases,
        detailedPhases
      };
    }).filter(Boolean);
  }, [circuitConfig, roundsData, generatePhaseConfig, isRoundConfigured, lightingConfig, rawScenes, dataUpdatedAt]);

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
    <div className={`space-y-6 transition-all duration-500 ${
      isLightingEnabled 
        ? 'bg-gradient-to-br from-purple-50/80 via-amber-50/80 to-orange-50/80 dark:from-purple-900/30 dark:via-amber-900/30 dark:to-orange-900/30 rounded-2xl -mx-4 px-4 -mt-4 pt-4 -mb-6 pb-6' 
        : ''
    }`}>
      {/* Enhanced Header Section with Dynamic Background */}
      <div className={`relative rounded-2xl transition-all duration-300 ${
        isLightingEnabled 
          ? 'bg-gradient-to-br from-purple-50 via-amber-50 to-orange-50 dark:from-purple-900/20 dark:via-amber-900/20 dark:to-orange-900/20 border border-purple-200/50 dark:border-purple-700/50 shadow-lg' 
          : 'bg-gray-50/40 dark:bg-gray-800/30 border border-gray-200/60 dark:border-gray-700/50 opacity-75'
      }`}>
        <div className="flex justify-between items-center py-6 px-6">
          {/* Global Power Toggle - Left */}
          <button 
            onClick={() => setIsLightingEnabled(!isLightingEnabled)}
            className={`relative flex items-center gap-3 px-6 py-3 rounded-2xl font-semibold text-sm transition-all duration-300 shadow-lg active:scale-95 ${
              isLightingEnabled
                ? 'bg-gradient-to-r from-purple-500 to-orange-500 hover:from-purple-600 hover:to-orange-600 text-white shadow-purple-500/25 hover:shadow-purple-500/40'
                : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-600/70 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 shadow-gray-500/15'
            }`}
          >
            {/* Toggle Switch */}
            <div className={`w-10 h-5 rounded-full relative transition-all duration-300 ${
              isLightingEnabled 
                ? 'bg-white/30' 
                : 'bg-gray-400/50 dark:bg-gray-500/50'
            }`}>
              <div className={`w-4 h-4 rounded-full absolute top-0.5 transition-all duration-300 ${
                isLightingEnabled 
                  ? 'left-5 bg-white shadow-sm' 
                  : 'left-0.5 bg-gray-500 dark:bg-gray-400'
              }`} />
            </div>
            
            {/* Dynamic Text */}
            <span className="font-bold">
              {isLightingEnabled ? 'LIGHTS ON' : 'LIGHTS OFF'}
            </span>
          </button>
          
          {/* All Rounds Button - Right */}
          <button className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-150 shadow-lg hover:shadow-xl active:scale-95 group ${
            isLightingEnabled
              ? 'bg-purple-500 hover:bg-purple-600 active:bg-purple-700 text-white'
              : 'bg-gray-200 hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-600/70 dark:hover:bg-gray-600 dark:active:bg-gray-500 text-gray-600 dark:text-gray-400 shadow-gray-500/15'
          }`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>All Rounds</span>
          </button>
        </div>
        
        {/* Enhanced Status Bar */}
        {isLightingEnabled && (
          <div className="absolute bottom-0 left-1 right-1 h-1 bg-gradient-to-r from-purple-400 via-amber-400 to-orange-400 opacity-60 rounded-b-2xl"></div>
        )}
      </div>


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
                                          onClick={() => onConfigureLight?.({ roundId: round.id, phaseType: 'work', isDetailedView: true })}
                                          className={`relative w-20 h-20 rounded-full border-4 shadow-lg active:scale-95 transition-all duration-150 active:shadow-xl ${
                                            item.workPhase.config?.isMixed ? 'border-yellow-400' : 'border-white'
                                          }`}
                                          style={{ 
                                            backgroundColor: item.workPhase.config?.color || '#6B7280',
                                            opacity: item.workPhase.config?.active ? Math.max(0.9, item.workPhase.config?.brightness / 100) : 0.5,
                                            boxShadow: isLightingEnabled && item.workPhase.config?.active 
                                              ? `0 0 32px ${item.workPhase.config?.color}40, 0 8px 25px rgba(0,0,0,0.15), 0 0 8px ${item.workPhase.config?.color}60` 
                                              : item.workPhase.config?.active 
                                              ? `0 0 16px ${item.workPhase.config?.color}30, 0 8px 25px rgba(0,0,0,0.15)` 
                                              : '0 8px 25px rgba(0,0,0,0.15)'
                                          }}
                                        >
                                          {/* Mixed state indicator */}
                                          {item.workPhase.config?.isMixed && (
                                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white"></div>
                                          )}
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
                                          onClick={() => onConfigureLight?.({ roundId: round.id, phaseType: 'rest', isDetailedView: true })}
                                          className="relative w-20 h-20 rounded-full border-4 border-white shadow-lg active:scale-95 transition-all duration-150 active:shadow-xl"
                                          style={{ 
                                            backgroundColor: item.restPhase.config?.color || '#6B7280',
                                            opacity: item.restPhase.config?.active ? Math.max(0.9, item.restPhase.config?.brightness / 100) : 0.5,
                                            boxShadow: isLightingEnabled && item.restPhase.config?.active 
                                              ? `0 0 32px ${item.restPhase.config?.color}40, 0 8px 25px rgba(0,0,0,0.15), 0 0 8px ${item.restPhase.config?.color}60` 
                                              : item.restPhase.config?.active 
                                              ? `0 0 16px ${item.restPhase.config?.color}30, 0 8px 25px rgba(0,0,0,0.15)` 
                                              : '0 8px 25px rgba(0,0,0,0.15)'
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
                                          onClick={() => onConfigureLight?.({ roundId: round.id, phaseType: item.phase.type, isDetailedView: true })}
                                          className="relative w-20 h-20 rounded-full border-4 border-white shadow-lg active:scale-95 transition-all duration-150 active:shadow-xl"
                                          style={{ 
                                            backgroundColor: item.phase.config?.color || '#6B7280',
                                            opacity: item.phase.config?.active ? Math.max(0.9, item.phase.config?.brightness / 100) : 0.5,
                                            boxShadow: isLightingEnabled && item.phase.config?.active 
                                              ? `0 0 32px ${item.phase.config?.color}40, 0 8px 25px rgba(0,0,0,0.15), 0 0 8px ${item.phase.config?.color}60` 
                                              : item.phase.config?.active 
                                              ? `0 0 16px ${item.phase.config?.color}30, 0 8px 25px rgba(0,0,0,0.15)` 
                                              : '0 8px 25px rgba(0,0,0,0.15)'
                                          }}
                                        >
                                          <div className="text-xs font-black uppercase tracking-wider text-center leading-tight text-white drop-shadow-lg">
                                            {item.phase.type === 'setBreak' ? 'SET' : 
                                             item.phase.type === 'work' ? 'WORK' :
                                             item.phase.type === 'preview' ? 'PRE' :
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
                                    onClick={() => onConfigureLight?.({ roundId: round.id, phaseType: phase.type, isDetailedView: false })}
                                    className="relative w-20 h-20 rounded-full flex items-center justify-center border-4 border-white shadow-lg active:scale-95 transition-all duration-150 active:shadow-xl"
                                    style={{ 
                                      backgroundColor: phase.config?.color || '#6B7280',
                                      opacity: phase.config?.active ? Math.max(0.85, phase.config?.brightness / 100) : 0.4,
                                      boxShadow: isLightingEnabled && phase.config?.active 
                                        ? `0 0 24px ${phase.config?.color}50, 0 8px 25px rgba(0,0,0,0.15), 0 0 6px ${phase.config?.color}70` 
                                        : phase.config?.active 
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
            </div>
          </div>
        ))}
      </div>
      
    </div>
  );
}


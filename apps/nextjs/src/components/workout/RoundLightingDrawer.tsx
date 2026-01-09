"use client";

import React from "react";
import { api } from "~/trpc/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface RoundLightingDrawerProps {
  sessionId?: string | null;
  roundId: number;
  roundType?: string;
  onClose?: () => void;
  onSave?: () => void;
}

interface SceneItem {
  id: string;
  name: string;
  type: string;
  color?: string;
  isSpecialEffect?: boolean;
  category?: string;
  lightstates?: Record<string, any>;
  transitiontime?: number;
}

interface RoundConfigState {
  preview: { sceneId: string; sceneName: string } | null;
  work: { sceneId: string; sceneName: string } | null;
  rest: { sceneId: string; sceneName: string } | null;
}

export function RoundLightingDrawer({
  sessionId,
  roundId,
  roundType,
  onClose,
  onSave,
}: RoundLightingDrawerProps) {
  const [roundConfig, setRoundConfig] = React.useState<RoundConfigState>({
    preview: null,
    work: null,
    rest: null,
  });

  const [expandedPhases, setExpandedPhases] = React.useState<Record<string, boolean>>({});

  const trpc = api();
  const queryClient = useQueryClient();

  // Color utility functions (same as AllRoundsLightingDrawer)
  const hexToHSL = (hex: string): { h: number; s: number; l: number } => {
    const cleanHex = hex.replace('#', '');
    
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    
    if (max === min) {
      return { h: 0, s: 0, l };
    }
    
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    let h = 0;
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
    
    return { h: h * 360, s: s * 100, l: l * 100 };
  };
  
  const categorizeByColor = (hex: string): string => {
    const { h, s, l } = hexToHSL(hex);
    
    if (s < 15) {
      if (l < 20) return 'Dark & Moody';
      if (l > 80) return 'Bright & Clean';
      return 'Neutral';
    }
    
    if (h >= 0 && h < 15) return 'Warm Reds';
    if (h >= 15 && h < 45) return 'Oranges & Ambers';
    if (h >= 45 && h < 70) return 'Yellows & Golds';
    if (h >= 70 && h < 150) return 'Greens & Nature';
    if (h >= 150 && h < 200) return 'Cool Blues';
    if (h >= 200 && h < 260) return 'Deep Blues & Purples';
    if (h >= 260 && h < 330) return 'Purples & Magentas';
    if (h >= 330 && h <= 360) return 'Warm Reds';
    
    return 'Other';
  };

  const { data: rawScenes, isLoading, error } = useQuery({
    ...trpc.lighting.getScenes.queryOptions(),
  });

  // Get current lighting configuration
  const { data: lightingConfig } = useQuery({
    ...trpc.lightingConfig.get.queryOptions({ sessionId: sessionId! }),
    enabled: !!sessionId
  });

  // Update round lighting configuration mutation (batch)
  const updateRoundConfig = useMutation({
    ...trpc.lightingConfig.updateRoundConfig.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.lightingConfig.get.queryOptions({ sessionId: sessionId! }).queryKey,
      });
      onSave?.();
    },
    onError: (error) => {
      console.error('Failed to save round lighting configuration:', error);
    },
  });

  // Process and categorize scenes by color (same logic as AllRoundsLightingDrawer)
  const processedScenes = React.useMemo(() => {
    if (!rawScenes) return { categorized: {}, all: [] };
    
    const scenes: SceneItem[] = rawScenes.map(scene => {
      const colorMatch = scene.name.match(/#([a-fA-F0-9]{6})/);
      const color = colorMatch ? `#${colorMatch[1]}` : undefined;
      const isSpecialEffect = scene.name.toLowerCase().includes('special effect');
      
      let category = 'Uncategorized';
      if (color) {
        category = categorizeByColor(color);
      } else if (isSpecialEffect) {
        category = 'Special Effects';
      } else {
        const nameLower = scene.name.toLowerCase();
        if (nameLower.includes('concentrate') || nameLower.includes('energize') || nameLower.includes('focus')) {
          category = 'Focus & Energy';
        } else if (nameLower.includes('relax') || nameLower.includes('calm') || nameLower.includes('sleep')) {
          category = 'Relax & Calm';
        } else if (nameLower.includes('party') || nameLower.includes('dynamic')) {
          category = 'Party & Dynamic';
        }
      }
      
      return {
        id: scene.id,
        name: scene.name.replace(/ \(#[a-fA-F0-9]{6}\)/, ''),
        type: scene.type || 'LightScene',
        color,
        isSpecialEffect,
        category,
        lightstates: scene.lightstates,
        transitiontime: scene.transitiontime
      };
    });
    
    const sortedScenes = scenes.sort((a, b) => {
      if (!a.color && !b.color) return 0;
      if (!a.color) return 1;
      if (!b.color) return -1;
      
      const aHSL = hexToHSL(a.color);
      const bHSL = hexToHSL(b.color);
      
      return bHSL.l - aHSL.l;
    });
    
    return { categorized: {}, all: sortedScenes };
  }, [rawScenes]);

  // Note: No pre-population from saved config to avoid unintended overwrites
  // Users must explicitly select scenes they want to configure

  // Configuration phase data - dynamically based on round type
  const configPhases = React.useMemo(() => {
    const basePhases = [
      {
        key: 'preview' as keyof RoundConfigState,
        title: 'Round Preview',
        description: 'Setup & preparation lighting',
        shortName: 'Preview',
      },
      {
        key: 'work' as keyof RoundConfigState,
        title: roundType === 'amrap_round' ? 'AMRAP Work' : 'Exercise Work',
        description: roundType === 'amrap_round' ? 'Continuous AMRAP workout lighting' : 'High-intensity workout lighting',
        shortName: 'Work',
      },
    ];

    // Add rest phase only for non-AMRAP rounds
    if (roundType !== 'amrap_round') {
      basePhases.push({
        key: 'rest' as keyof RoundConfigState,
        title: 'Exercise Rest',
        description: 'Recovery & break lighting',
        shortName: 'Rest',
      });
    }

    return basePhases;
  }, [roundType]);

  const handleSceneSelect = (phaseKey: keyof RoundConfigState, scene: SceneItem) => {
    const newSelection = { sceneId: scene.id, sceneName: scene.name };
    setRoundConfig(prev => ({
      ...prev,
      [phaseKey]: newSelection
    }));
  };

  const clearPhaseConfig = (phaseKey: keyof RoundConfigState) => {
    setRoundConfig(prev => ({
      ...prev,
      [phaseKey]: null
    }));
  };

  const handleClearAllPhases = async () => {
    if (!sessionId) return;

    // Build master config with all phases set to null
    const masterConfig = {
      preview: null,
      work: null,
      rest: null,
    };

    try {
      await updateRoundConfig.mutateAsync({
        sessionId,
        roundId,
        masterConfig,
      });
      
      // Close drawer after successful clear
      onSave?.();
    } catch (error) {
      console.error('Failed to clear round configuration:', error);
    }
  };

  const handleApplyRoundConfig = async () => {
    if (!sessionId) return;

    // Filter out null values and build master config
    const masterConfig = Object.fromEntries(
      Object.entries(roundConfig).filter(([, value]) => value !== null)
    ) as {
      preview?: { sceneId: string; sceneName: string };
      work?: { sceneId: string; sceneName: string };
      rest?: { sceneId: string; sceneName: string };
    };

    // Don't proceed if no configuration selected
    if (Object.keys(masterConfig).length === 0) return;

    try {
      await updateRoundConfig.mutateAsync({
        sessionId,
        roundId,
        masterConfig,
      });
    } catch (error) {
      console.error('Failed to save round configuration:', error);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">Failed to load scenes</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Round Header */}
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Round {roundId} Settings
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Configure lighting for all phases in this round
              </p>
            </div>

            {/* Three Phase Configuration Sections */}
            {configPhases.map((phase) => {
              const currentConfig = roundConfig[phase.key];
              
              return (
                <div key={phase.key} className="space-y-4">
                  {/* Phase Header */}
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {phase.title}
                    </h4>
                    
                    {currentConfig && (
                      <button
                        onClick={() => clearPhaseConfig(phase.key)}
                        className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-medium"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Scene Grid - Always Show with Selection Highlighting */}
                  <div className="space-y-4">
                    {/* Scene Grid - Expandable */}
                    <div className="grid grid-cols-5 gap-3">
                      {(expandedPhases[phase.key] 
                        ? processedScenes.all 
                        : processedScenes.all.slice(0, 10)
                      ).map((scene) => {
                        const isSelected = currentConfig?.sceneId === scene.id;
                        return (
                          <button
                            key={`${phase.key}-${scene.id}`}
                            onClick={() => handleSceneSelect(phase.key, scene)}
                            className={`group p-3 rounded-xl border-2 transition-all duration-200 text-center ${
                              isSelected
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-lg'
                                : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600'
                            }`}
                          >
                            {scene.color ? (
                              <div 
                                className="w-8 h-8 rounded-full mx-auto mb-2 border border-white shadow-sm relative"
                                style={{ 
                                  backgroundColor: scene.color,
                                  boxShadow: `0 0 6px ${scene.color}40`
                                }}
                              >
                                {isSelected && (
                                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                            ) : scene.isSpecialEffect ? (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 via-pink-400 to-blue-400 mx-auto mb-2 flex items-center justify-center relative">
                                <span className="text-white text-[8px] font-bold">FX</span>
                                {isSelected && (
                                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 mx-auto mb-2 relative">
                                {isSelected && (
                                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                            )}
                            <p className={`text-[10px] font-medium leading-tight h-6 line-clamp-2 ${
                              isSelected 
                                ? 'text-purple-900 dark:text-purple-100' 
                                : 'text-gray-700 dark:text-gray-300'
                            }`}>
                              {scene.name}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    {/* Expand/Collapse Button */}
                    {processedScenes.all.length > 10 && (
                      <div className="flex justify-center">
                        <button
                          onClick={() => setExpandedPhases(prev => ({
                            ...prev,
                            [phase.key]: !prev[phase.key]
                          }))}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                        >
                          {expandedPhases[phase.key] ? (
                            <>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                              </svg>
                              Show less
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01" />
                              </svg>
                              See all {processedScenes.all.length} scenes
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fixed Footer */}
      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleClearAllPhases}
            className="flex-1 px-4 py-2.5 border border-red-300 dark:border-red-600 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium"
          >
            Clear All
          </button>
          <button
            onClick={handleApplyRoundConfig}
            disabled={Object.values(roundConfig).every(config => config === null) || updateRoundConfig.isPending}
            className={`
              flex-1 px-4 py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-2
              ${Object.values(roundConfig).some(config => config !== null) && !updateRoundConfig.isPending
                ? 'bg-purple-500 text-white hover:bg-purple-600 shadow-lg hover:shadow-xl active:scale-[0.98]' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {updateRoundConfig.isPending && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            {updateRoundConfig.isPending ? 'Applying...' : 'Apply Round Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
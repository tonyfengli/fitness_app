"use client";

import React from "react";
import { api } from "~/trpc/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface LightingConfigDrawerProps {
  sessionId?: string | null;
  roundId?: number;
  phaseType?: string;
  phaseLabel?: string;
  currentConfig?: any;
  isDetailedView?: boolean;
  onSave?: () => void;
  onClose?: () => void;
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

export function LightingConfigDrawer({
  sessionId,
  roundId,
  phaseType,
  phaseLabel,
  currentConfig,
  isDetailedView,
  onSave,
  onClose,
}: LightingConfigDrawerProps) {
  const [selectedSceneId, setSelectedSceneId] = React.useState<string | null>(null);
  const [selectedSceneName, setSelectedSceneName] = React.useState<string>("");
  
  const trpc = api();
  const queryClient = useQueryClient();
  
  // Color utility functions
  const hexToHSL = (hex: string): { h: number; s: number; l: number } => {
    // Remove # if present
    const cleanHex = hex.replace('#', '');
    
    // Convert to RGB
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
    
    // Handle grayscale/white/black
    if (s < 15) {
      if (l < 20) return 'Dark & Moody';
      if (l > 80) return 'Bright & Clean';
      return 'Neutral';
    }
    
    // Categorize by hue ranges
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
  
  // Debug logging
  React.useEffect(() => {
    console.log('[LightingConfigDrawer] Scenes query state:', {
      isLoading,
      error,
      scenesCount: rawScenes?.length,
      rawScenes
    });
  }, [isLoading, error, rawScenes]);

  // Get current lighting configuration
  const { data: lightingConfig } = useQuery({
    ...trpc.lightingConfig.get.queryOptions({ sessionId: sessionId! }),
    enabled: !!sessionId
  });

  // Update lighting configuration mutation
  const updateLightingConfig = useMutation({
    ...trpc.lightingConfig.update.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.lightingConfig.get.queryOptions({ sessionId: sessionId! }).queryKey,
      });
      onSave?.();
    },
    onError: (error) => {
      console.error('Failed to save lighting configuration:', error);
    },
  });

  // Process and categorize scenes by color
  const processedScenes = React.useMemo(() => {
    if (!rawScenes) return { categorized: {}, all: [] };
    
    const scenes: SceneItem[] = rawScenes.map(scene => {
      // Extract color from name if present (e.g., "Pink Special Effects 1 (#d36972)")
      const colorMatch = scene.name.match(/#([a-fA-F0-9]{6})/);
      const color = colorMatch ? `#${colorMatch[1]}` : undefined;
      
      // Determine if it's a special effect based on name patterns
      const isSpecialEffect = scene.name.toLowerCase().includes('special effect');
      
      // Use color-based categorization if hex code exists
      let category = 'Uncategorized';
      if (color) {
        category = categorizeByColor(color);
      } else if (isSpecialEffect) {
        category = 'Special Effects';
      } else {
        // Fallback to name analysis for scenes without hex codes
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
        name: scene.name.replace(/ \(#[a-fA-F0-9]{6}\)/, ''), // Remove hex from name
        type: scene.type || 'LightScene',
        color,
        isSpecialEffect,
        category,
        lightstates: scene.lightstates,
        transitiontime: scene.transitiontime
      };
    });
    
    // Sort scenes within categories by lightness (light to dark)
    const sortedScenes = scenes.sort((a, b) => {
      if (!a.color && !b.color) return 0;
      if (!a.color) return 1;
      if (!b.color) return -1;
      
      const aHSL = hexToHSL(a.color);
      const bHSL = hexToHSL(b.color);
      
      // Sort by lightness descending (light to dark)
      return bHSL.l - aHSL.l;
    });
    
    // Group by category with custom order
    const categoryOrder = [
      'Warm Reds',
      'Oranges & Ambers', 
      'Yellows & Golds',
      'Greens & Nature',
      'Cool Blues',
      'Deep Blues & Purples',
      'Purples & Magentas',
      'Bright & Clean',
      'Neutral',
      'Dark & Moody',
      'Special Effects',
      'Focus & Energy',
      'Relax & Calm',
      'Party & Dynamic',
      'Uncategorized'
    ];
    
    const categorized: Record<string, SceneItem[]> = {};
    
    // Initialize categories in order
    categoryOrder.forEach(cat => {
      const scenesInCat = sortedScenes.filter(s => s.category === cat);
      if (scenesInCat.length > 0) {
        categorized[cat] = scenesInCat;
      }
    });
    
    return { categorized, all: sortedScenes };
  }, [rawScenes, categorizeByColor, hexToHSL]);


  // Set initial selection from saved config
  React.useEffect(() => {
    if (lightingConfig && roundId && phaseType) {
      // Check for round-specific override or global default
      const savedScene = isDetailedView
        ? lightingConfig.roundOverrides?.[`round-${roundId}`]?.[phaseType]
        : lightingConfig.globalDefaults[phaseType as keyof typeof lightingConfig.globalDefaults];
      
      if (savedScene) {
        setSelectedSceneId(savedScene.sceneId);
        setSelectedSceneName(savedScene.sceneName);
      }
    }
  }, [lightingConfig, roundId, phaseType, isDetailedView]);

  const handleApply = async () => {
    if (!selectedSceneId || !selectedSceneName || !sessionId) return;

    const currentConfig = lightingConfig || {
      enabled: true,
      globalDefaults: {},
      roundOverrides: {},
      targetGroup: "0"
    };

    let updatedConfig = { ...currentConfig };

    if (roundId) {
      // Save as round override (since we're configuring a specific round)
      if (!updatedConfig.roundOverrides) {
        updatedConfig.roundOverrides = {};
      }
      const roundKey = `round-${roundId}`;
      if (!updatedConfig.roundOverrides[roundKey]) {
        updatedConfig.roundOverrides[roundKey] = {};
      }
      updatedConfig.roundOverrides[roundKey][phaseType!] = {
        sceneId: selectedSceneId,
        sceneName: selectedSceneName,
      };
    } else {
      // Save as global default (only when no specific round is provided)
      updatedConfig.globalDefaults[phaseType as keyof typeof updatedConfig.globalDefaults] = {
        sceneId: selectedSceneId,
        sceneName: selectedSceneName,
      };
    }

    try {
      await updateLightingConfig.mutateAsync({
        sessionId,
        lighting: updatedConfig
      });
    } catch (error) {
      console.error('Failed to save scene configuration:', error);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      {/* Fixed Header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Select Lighting Scene
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {phaseLabel && `${phaseLabel} • `}Round {roundId}
        </p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        )}
        
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">Failed to load scenes</p>
          </div>
        )}
        
        {!isLoading && !error && (
          <div className="grid grid-cols-4 gap-3">
            {processedScenes.all.map((scene) => (
                    <button
                      key={scene.id}
                      onClick={() => {
                        setSelectedSceneId(scene.id);
                        setSelectedSceneName(scene.name);
                      }}
                      className={`
                        relative group p-3 rounded-xl border-2 transition-all duration-200 text-center
                        ${selectedSceneId === scene.id 
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-lg' 
                          : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600'
                        }
                      `}
                    >
                      {/* Color preview centered */}
                      {scene.color ? (
                        <div 
                          className="w-8 h-8 rounded-full mx-auto mb-2 border border-white shadow-sm relative"
                          style={{ 
                            backgroundColor: scene.color,
                            boxShadow: `0 0 6px ${scene.color}40`
                          }}
                        >
                          {selectedSceneId === scene.id && (
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
                          {selectedSceneId === scene.id && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 mx-auto mb-2 relative">
                          {selectedSceneId === scene.id && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Scene name with two lines */}
                      <p className={`text-[10px] font-medium leading-tight h-6 line-clamp-2 ${
                        selectedSceneId === scene.id 
                          ? 'text-purple-900 dark:text-purple-100' 
                          : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {scene.name}
                      </p>
                    </button>
            ))}
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
            onClick={handleApply}
            disabled={!selectedSceneId}
            className={`
              flex-1 px-4 py-2.5 rounded-lg font-medium transition-all
              ${selectedSceneId 
                ? 'bg-purple-500 text-white hover:bg-purple-600 shadow-lg hover:shadow-xl active:scale-[0.98]' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              }
            `}
          >
            Apply Scene
          </button>
        </div>
      </div>
    </div>
  );
}
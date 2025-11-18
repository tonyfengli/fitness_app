"use client";

import React from "react";
import { api } from "~/trpc/react";
import { useQuery } from "@tanstack/react-query";

interface AllRoundsLightingDrawerProps {
  sessionId?: string | null;
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

interface GlobalConfigState {
  preview: { sceneId: string; sceneName: string } | null;
  work: { sceneId: string; sceneName: string } | null;
  rest: { sceneId: string; sceneName: string } | null;
}

export function AllRoundsLightingDrawer({
  sessionId,
  onClose,
  onSave,
}: AllRoundsLightingDrawerProps) {
  const [globalConfig, setGlobalConfig] = React.useState<GlobalConfigState>({
    preview: null,
    work: null,
    rest: null,
  });

  const [selectedPhase, setSelectedPhase] = React.useState<keyof GlobalConfigState | null>(null);
  const [expandedPhases, setExpandedPhases] = React.useState<Record<string, boolean>>({});

  const trpc = api();

  // Color utility functions (same as LightingConfigDrawer)
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
    ...trpc.lighting.getRemoteScenes.queryOptions(),
  });

  // Get current lighting configuration
  const { data: lightingConfig } = useQuery({
    ...trpc.lightingConfig.get.queryOptions({ sessionId: sessionId! }),
    enabled: !!sessionId
  });

  // Process and categorize scenes by color (same logic as LightingConfigDrawer)
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
    
    categoryOrder.forEach(cat => {
      const scenesInCat = sortedScenes.filter(s => s.category === cat);
      if (scenesInCat.length > 0) {
        categorized[cat] = scenesInCat;
      }
    });
    
    return { categorized, all: sortedScenes };
  }, [rawScenes]);

  // Initialize global config from saved configuration
  React.useEffect(() => {
    if (lightingConfig?.globalDefaults) {
      setGlobalConfig({
        preview: lightingConfig.globalDefaults.preview || null,
        work: lightingConfig.globalDefaults.work || null,
        rest: lightingConfig.globalDefaults.rest || null,
      });
    }
  }, [lightingConfig]);

  // Configuration phase data
  const configPhases = [
    {
      key: 'preview' as keyof GlobalConfigState,
      title: 'Round Previews',
      description: 'Setup & preparation lighting',
      icon: '👁️',
      color: '#4F46E5',
      shortName: 'Preview',
    },
    {
      key: 'work' as keyof GlobalConfigState,
      title: 'Exercise Work',
      description: 'High-intensity workout lighting',
      icon: '💪',
      color: '#EF4444',
      shortName: 'Work',
    },
    {
      key: 'rest' as keyof GlobalConfigState,
      title: 'Exercise Rest',
      description: 'Recovery & break lighting',
      icon: '🧘',
      color: '#5DE1FF',
      shortName: 'Rest',
    },
  ];

  const handleSceneSelect = (phaseKey: keyof GlobalConfigState, scene: SceneItem) => {
    const newSelection = { sceneId: scene.id, sceneName: scene.name };
    setGlobalConfig(prev => ({
      ...prev,
      [phaseKey]: newSelection
    }));
  };

  const clearPhaseConfig = (phaseKey: keyof GlobalConfigState) => {
    setGlobalConfig(prev => ({
      ...prev,
      [phaseKey]: null
    }));
  };

  const handleApplyGlobalConfig = async () => {
    // Frontend-only for now - no actual mutation
    console.log('Would apply global config:', globalConfig);
    onSave?.();
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
            {/* Three Phase Configuration Sections */}
            {configPhases.map((phase) => {
              const currentConfig = globalConfig[phase.key];
              
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
            onClick={handleApplyGlobalConfig}
            disabled={!selectedPhase && Object.values(globalConfig).every(config => config === null)}
            className={`
              flex-1 px-4 py-2.5 rounded-lg font-medium transition-all
              ${(!selectedPhase && Object.values(globalConfig).some(config => config !== null)) || selectedPhase
                ? 'bg-purple-500 text-white hover:bg-purple-600 shadow-lg hover:shadow-xl active:scale-[0.98]' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {selectedPhase ? `Apply to ${configPhases.find(p => p.key === selectedPhase)?.title}` : 'Apply Global Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
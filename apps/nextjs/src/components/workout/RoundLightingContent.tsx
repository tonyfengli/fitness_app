"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn, ChevronLeftIcon } from "@acme/ui-shared";
import type { RoundData } from "@acme/ui-shared";

interface RoundLightingContentProps {
  sessionId?: string | null;
  roundId: number;
  roundName: string;
  roundType: "circuit_round" | "stations_round" | "amrap_round";
  roundData?: RoundData;
  onBack: () => void;
  onClose: () => void;
  onTitleChange?: (title: string) => void;
}

interface SceneItem {
  id: string;
  name: string;
  type: string;
  color?: string;
  isSpecialEffect?: boolean;
}

type ViewState =
  | { type: "phases" }
  | { type: "scene-picker"; phaseType: string; phaseLabel: string };

// localStorage helpers for scenes caching
const SCENES_CACHE_KEY = "hue_scenes_cache";
const SCENES_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCachedScenes(): any[] | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(SCENES_CACHE_KEY);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    // Return cached data even if stale (we'll refresh in background)
    if (Date.now() - timestamp < SCENES_CACHE_TTL) {
      return data;
    }
    return data; // Return stale data, will be refreshed
  } catch {
    return null;
  }
}

function setCachedScenes(scenes: any[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SCENES_CACHE_KEY, JSON.stringify({
      data: scenes,
      timestamp: Date.now(),
    }));
  } catch {
    // localStorage might be full or disabled
  }
}

export function RoundLightingContent({
  sessionId,
  roundId,
  roundName,
  roundType,
  roundData,
  onBack,
  onClose,
  onTitleChange,
}: RoundLightingContentProps) {
  const [viewState, setViewState] = useState<ViewState>({ type: "phases" });
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedSceneName, setSelectedSceneName] = useState<string>("");
  const [originalSceneId, setOriginalSceneId] = useState<string | null>(null);

  // Track pending navigation after mutation
  const [pendingNavBack, setPendingNavBack] = useState(false);
  const configVersionRef = useRef(0);

  const trpc = api();
  const queryClient = useQueryClient();

  // Update parent title based on view
  useEffect(() => {
    if (viewState.type === "phases") {
      onTitleChange?.(`${roundName} · Lighting`);
    } else {
      onTitleChange?.(`${roundName} · ${viewState.phaseLabel}`);
    }
  }, [viewState, roundName, onTitleChange]);

  // Get lighting config with version tracking for updates
  const { data: lightingConfig, dataUpdatedAt } = useQuery({
    ...trpc.lightingConfig.get.queryOptions({ sessionId: sessionId! }),
    enabled: !!sessionId,
  });

  // Get circuit config to check for repeatTimes (set breaks)
  const { data: circuitConfig } = useQuery({
    ...trpc.circuitConfig.getBySession.queryOptions({ sessionId: sessionId! }),
    enabled: !!sessionId,
  });

  // Get scenes with localStorage caching (stale-while-revalidate pattern)
  const { data: rawScenes, isLoading: scenesLoading } = useQuery({
    ...trpc.lighting.getScenes.queryOptions(),
    // placeholderData shows cache immediately BUT still fetches fresh data
    placeholderData: getCachedScenes() ?? undefined,
    staleTime: 0, // Always consider stale so it refetches
    gcTime: 30 * 60 * 1000, // Keep in memory for 30 minutes
  });

  // Cache scenes to localStorage when fresh data arrives
  useEffect(() => {
    if (rawScenes && Array.isArray(rawScenes) && rawScenes.length > 0) {
      setCachedScenes(rawScenes);
    }
  }, [rawScenes]);

  // Update lighting config mutation
  const updateLightingConfig = useMutation({
    ...trpc.lightingConfig.update.mutationOptions(),
    onSuccess: () => {
      configVersionRef.current += 1;
      queryClient.invalidateQueries({
        queryKey: trpc.lightingConfig.get.queryOptions({ sessionId: sessionId! }).queryKey,
      });
    },
  });

  // Listen for lightingConfig updates and navigate back when pending
  useEffect(() => {
    if (pendingNavBack && lightingConfig) {
      // Data has updated, safe to navigate back
      setPendingNavBack(false);
      setViewState({ type: "phases" });
      setSelectedSceneId(null);
      setSelectedSceneName("");
      setOriginalSceneId(null);
    }
  }, [pendingNavBack, dataUpdatedAt]);

  // Color utilities
  const hexToHSL = useCallback((hex: string): { h: number; s: number; l: number } => {
    const cleanHex = hex.replace("#", "");
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;

    if (max === min) return { h: 0, s: 0, l };

    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    let h = 0;
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
  }, []);

  // Get scene color from ID
  const getSceneColor = useCallback((sceneId: string): string | null => {
    if (!rawScenes) return null;
    const scene = rawScenes.find((s: any) => s.id === sceneId);
    if (!scene) return null;
    const colorMatch = scene.name.match(/#([a-fA-F0-9]{6})/);
    return colorMatch ? `#${colorMatch[1]}` : null;
  }, [rawScenes]);

  // Get effective scene for a phase
  const getEffectiveScene = useCallback((phaseType: string) => {
    if (!lightingConfig) return null;
    const roundKey = `round-${roundId}`;

    // Check specific override
    const customOverride = (lightingConfig as any).roundOverrides?.[roundKey]?.[phaseType];
    if (customOverride) return customOverride;

    // Check round master default
    const basePhaseType = phaseType.split("-")[0];
    const roundMaster = (lightingConfig as any).roundOverrides?.[roundKey]?.[basePhaseType];
    if (roundMaster) return roundMaster;

    // Fallback to global
    return (lightingConfig as any).globalDefaults?.[basePhaseType] || null;
  }, [lightingConfig, roundId]);

  // Generate phase config
  const generatePhaseConfig = useCallback((phaseType: string, fallbackColor?: string) => {
    if (!lightingConfig || !rawScenes) {
      return { color: "#E5E7EB", brightness: 30, active: false };
    }

    const effectiveScene = getEffectiveScene(phaseType);
    if (effectiveScene) {
      const sceneColor = getSceneColor(effectiveScene.sceneId);
      return {
        color: sceneColor || fallbackColor || "#6B7280",
        brightness: 90,
        active: true,
      };
    }

    return { color: "#E5E7EB", brightness: 30, active: false };
  }, [lightingConfig, rawScenes, getEffectiveScene, getSceneColor]);

  // Get scene name
  const getSceneName = useCallback((phaseType: string): string => {
    const effectiveScene = getEffectiveScene(phaseType);
    return effectiveScene?.sceneName || "No scene selected";
  }, [getEffectiveScene]);

  // Get repeatTimes from round template (for set break support)
  const repeatTimes = useMemo(() => {
    if (!circuitConfig?.config?.roundTemplates) return 1;
    const template = circuitConfig.config.roundTemplates.find(
      (rt: any) => rt.roundNumber === roundId
    );
    return template?.template?.repeatTimes ?? 1;
  }, [circuitConfig, roundId]);

  // Generate phases based on round type
  const phases = useMemo(() => {
    const result: Array<{ type: string; label: string; config: any }> = [];

    if (roundType === "stations_round" && roundData?.exercises) {
      const stations = Array.from(
        new Set(roundData.exercises.map((ex: any) => ex.orderIndex))
      ).sort();

      result.push({
        type: "preview",
        label: "Round Preview",
        config: generatePhaseConfig("preview", "#4F46E5"),
      });

      stations.forEach((stationOrderIndex, sequentialIndex) => {
        const stationExercises = roundData.exercises?.filter(
          (ex: any) => ex.orderIndex === stationOrderIndex
        ) || [];
        const exerciseNames = stationExercises.map((ex: any) => ex.exerciseName).join(", ");

        result.push({
          type: `work-station-${sequentialIndex}`,
          label: `Station: ${exerciseNames}`,
          config: generatePhaseConfig(`work-station-${sequentialIndex}`, `hsl(${(sequentialIndex * 60) % 360}, 70%, 55%)`),
        });

        if (sequentialIndex < stations.length - 1) {
          result.push({
            type: `rest-after-station-${sequentialIndex}`,
            label: "Rest",
            config: generatePhaseConfig(`rest-after-station-${sequentialIndex}`, "#5DE1FF"),
          });
        }
      });

      // Add set break phase if round has multiple sets
      if (repeatTimes > 1) {
        result.push({
          type: "roundBreak",
          label: "Set Break",
          config: generatePhaseConfig("roundBreak", "#8B5CF6"),
        });
      }
    } else if (roundType === "circuit_round" && roundData?.exercises) {
      result.push({
        type: "preview",
        label: "Round Preview",
        config: generatePhaseConfig("preview", "#4F46E5"),
      });

      roundData.exercises.forEach((exercise: any, exerciseIndex: number) => {
        result.push({
          type: `work-exercise-${exerciseIndex}`,
          label: exercise.exerciseName,
          config: generatePhaseConfig(`work-exercise-${exerciseIndex}`, `hsl(${(exerciseIndex * 45) % 360}, 75%, 60%)`),
        });

        if (exerciseIndex < (roundData.exercises?.length || 0) - 1) {
          result.push({
            type: `rest-after-exercise-${exerciseIndex}`,
            label: "Rest",
            config: generatePhaseConfig(`rest-after-exercise-${exerciseIndex}`, "#5DE1FF"),
          });
        }
      });

      // Add set break phase if round has multiple sets
      if (repeatTimes > 1) {
        result.push({
          type: "roundBreak",
          label: "Set Break",
          config: generatePhaseConfig("roundBreak", "#8B5CF6"),
        });
      }
    } else if (roundType === "amrap_round") {
      result.push({
        type: "preview",
        label: "Round Preview",
        config: generatePhaseConfig("preview", "#4F46E5"),
      });
      result.push({
        type: "work",
        label: "AMRAP Work",
        config: generatePhaseConfig("work", "#EF4444"),
      });
      // AMRAP doesn't have repeatTimes/sets
    }

    return result;
  }, [roundType, roundData, generatePhaseConfig, repeatTimes, dataUpdatedAt]); // dataUpdatedAt ensures recalc on config update

  // Process scenes for picker
  const processedScenes = useMemo(() => {
    if (!rawScenes) return [];

    return (rawScenes as any[]).map((scene) => {
      const colorMatch = scene.name.match(/#([a-fA-F0-9]{6})/);
      const color = colorMatch ? `#${colorMatch[1]}` : undefined;
      const isSpecialEffect = scene.name.toLowerCase().includes("special effect");

      return {
        id: scene.id,
        name: scene.name.replace(/ \(#[a-fA-F0-9]{6}\)/, ""),
        type: scene.type || "LightScene",
        color,
        isSpecialEffect,
      };
    }).sort((a: SceneItem, b: SceneItem) => {
      if (!a.color && !b.color) return 0;
      if (!a.color) return 1;
      if (!b.color) return -1;
      const aHSL = hexToHSL(a.color);
      const bHSL = hexToHSL(b.color);
      return bHSL.l - aHSL.l;
    });
  }, [rawScenes, hexToHSL]);

  // Handle phase click
  const handlePhaseClick = (phaseType: string, phaseLabel: string) => {
    const effectiveScene = getEffectiveScene(phaseType);
    if (effectiveScene) {
      setSelectedSceneId(effectiveScene.sceneId);
      setSelectedSceneName(effectiveScene.sceneName);
      setOriginalSceneId(effectiveScene.sceneId);
    } else {
      setSelectedSceneId(null);
      setSelectedSceneName("");
      setOriginalSceneId(null);
    }
    setViewState({ type: "scene-picker", phaseType, phaseLabel });
  };

  // Handle back from scene picker
  const handleBackFromPicker = () => {
    setViewState({ type: "phases" });
    setSelectedSceneId(null);
    setSelectedSceneName("");
    setOriginalSceneId(null);
  };

  // Handle back button (context-aware)
  const handleBack = () => {
    if (viewState.type === "scene-picker") {
      handleBackFromPicker();
    } else {
      onBack();
    }
  };

  // Handle apply scene
  const handleApplyScene = async () => {
    if (!selectedSceneId || !selectedSceneName || !sessionId || viewState.type !== "scene-picker") return;

    const currentConfig = lightingConfig || {
      enabled: true,
      globalDefaults: {},
      roundOverrides: {},
      targetGroup: "0",
    };

    const updatedConfig = { ...currentConfig } as any;
    if (!updatedConfig.roundOverrides) {
      updatedConfig.roundOverrides = {};
    }
    const roundKey = `round-${roundId}`;
    if (!updatedConfig.roundOverrides[roundKey]) {
      updatedConfig.roundOverrides[roundKey] = {};
    }
    updatedConfig.roundOverrides[roundKey][viewState.phaseType] = {
      sceneId: selectedSceneId,
      sceneName: selectedSceneName,
    };

    try {
      await updateLightingConfig.mutateAsync({
        sessionId,
        lighting: updatedConfig,
      });
      // Set pending flag - useEffect will navigate when data updates
      setPendingNavBack(true);
    } catch (error) {
      console.error("Failed to save scene:", error);
    }
  };

  // Handle clear scene
  const handleClearScene = async () => {
    if (!sessionId || viewState.type !== "scene-picker") return;

    const currentConfig = lightingConfig || {
      enabled: true,
      globalDefaults: {},
      roundOverrides: {},
      targetGroup: "0",
    };

    const updatedConfig = { ...currentConfig } as any;
    const roundKey = `round-${roundId}`;

    if (updatedConfig.roundOverrides?.[roundKey]?.[viewState.phaseType]) {
      updatedConfig.roundOverrides[roundKey][viewState.phaseType] = null;

      const hasAnyConfig = Object.values(updatedConfig.roundOverrides[roundKey]).some((v) => v !== null);
      if (!hasAnyConfig) {
        delete updatedConfig.roundOverrides[roundKey];
      }
    }

    try {
      await updateLightingConfig.mutateAsync({
        sessionId,
        lighting: updatedConfig,
      });
      // Set pending flag - useEffect will navigate when data updates
      setPendingNavBack(true);
    } catch (error) {
      console.error("Failed to clear scene:", error);
    }
  };

  // Current step for progress indicator (1 = phases, 2 = scene picker)
  const currentStep = viewState.type === "phases" ? 1 : 2;

  return (
    <div className="flex flex-col h-full min-h-[60vh]">
      {/* Header - matching AddRoundDrawer pattern */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <button
              onClick={handleBack}
              className="flex-shrink-0 p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Go back"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                {roundName} Lighting
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                {viewState.type === "phases"
                  ? "Select a phase to configure lighting"
                  : `Choose scene for ${viewState.phaseLabel}`}
              </p>
            </div>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="mt-3">
          <div className="flex gap-1">
            {[1, 2].map((step) => (
              <div
                key={step}
                className={cn(
                  "h-1 flex-1 rounded-full transition-all duration-300",
                  currentStep >= step
                    ? "bg-purple-500 dark:bg-purple-400"
                    : "bg-gray-200 dark:bg-gray-700"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Content - scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          {/* Step 1: Phases View */}
          {viewState.type === "phases" && (
            <div className="space-y-4">
              {phases.map((phase, i) => (
                <button
                  key={i}
                  onClick={() => handlePhaseClick(phase.type, phase.label)}
                  className={cn(
                    "w-full p-4 rounded-lg border-2 text-left transition-all duration-200",
                    phase.config?.active
                      ? "border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                  )}
                >
                  <div className="flex items-center gap-4">
                    {/* Phase number */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <span className="text-sm font-bold text-gray-600 dark:text-gray-300">
                        {i + 1}
                      </span>
                    </div>

                    {/* Light circle preview */}
                    <div
                      className="flex-shrink-0 w-12 h-12 rounded-full border-2 border-white dark:border-gray-800 shadow-md"
                      style={{
                        backgroundColor: phase.config?.color || "#6B7280",
                        opacity: phase.config?.active ? 0.9 : 0.4,
                        boxShadow: phase.config?.active
                          ? `0 0 12px ${phase.config?.color}40`
                          : undefined,
                      }}
                    />

                    {/* Phase details */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {phase.label}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {getSceneName(phase.type)}
                      </p>
                    </div>

                    {/* Chevron */}
                    <svg
                      className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Scene Picker */}
          {viewState.type === "scene-picker" && (
            <>
              {scenesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {processedScenes.map((scene) => (
                    <button
                      key={scene.id}
                      onClick={() => {
                        // Toggle: deselect if already selected
                        if (selectedSceneId === scene.id) {
                          setSelectedSceneId(null);
                          setSelectedSceneName("");
                        } else {
                          setSelectedSceneId(scene.id);
                          setSelectedSceneName(scene.name);
                        }
                      }}
                      className={cn(
                        "relative p-3 rounded-xl border-2 transition-all duration-200 text-center",
                        selectedSceneId === scene.id
                          ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-lg"
                          : "border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600"
                      )}
                    >
                      {scene.color ? (
                        <div
                          className="w-8 h-8 rounded-full mx-auto mb-2 border border-white shadow-sm relative"
                          style={{
                            backgroundColor: scene.color,
                            boxShadow: `0 0 6px ${scene.color}40`,
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

                      <p className={cn(
                        "text-[10px] font-medium leading-tight h-6 line-clamp-2",
                        selectedSceneId === scene.id
                          ? "text-purple-900 dark:text-purple-100"
                          : "text-gray-700 dark:text-gray-300"
                      )}>
                        {scene.name}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer - sticky buttons */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
        {viewState.type === "phases" ? (
          <div className="flex gap-3">
            <button
              onClick={onBack}
              className="flex-1 p-3 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors font-medium"
            >
              Back
            </button>
            <button
              onClick={onClose}
              className="flex-1 p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={handleBackFromPicker}
              className="flex-1 p-3 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors font-medium"
            >
              Back
            </button>
            {(() => {
              // Determine button state
              const hasChange = selectedSceneId !== originalSceneId;
              const isClearing = !selectedSceneId && !!originalSceneId;

              return (
                <button
                  onClick={isClearing ? handleClearScene : handleApplyScene}
                  disabled={!hasChange}
                  className={cn(
                    "flex-1 p-3 rounded-lg transition-colors font-medium",
                    !hasChange
                      ? "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                      : isClearing
                        ? "bg-red-600 hover:bg-red-700 text-white"
                        : "bg-purple-600 hover:bg-purple-700 text-white"
                  )}
                >
                  {isClearing ? "Clear Scene" : "Apply Scene"}
                </button>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

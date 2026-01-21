"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@acme/ui-shared";
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
    if (Date.now() - timestamp < SCENES_CACHE_TTL) {
      return data;
    }
    return data;
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
  const [sceneSearchQuery, setSceneSearchQuery] = useState("");

  const [pendingNavBack, setPendingNavBack] = useState(false);
  const configVersionRef = useRef(0);

  const trpc = api();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (viewState.type === "phases") {
      onTitleChange?.(`${roundName} · Lighting`);
    } else {
      onTitleChange?.(`${roundName} · ${viewState.phaseLabel}`);
    }
  }, [viewState, roundName, onTitleChange]);

  const { data: lightingConfig, dataUpdatedAt } = useQuery({
    ...trpc.lightingConfig.get.queryOptions({ sessionId: sessionId! }),
    enabled: !!sessionId,
  });

  const { data: circuitConfig } = useQuery({
    ...trpc.circuitConfig.getBySession.queryOptions({ sessionId: sessionId! }),
    enabled: !!sessionId,
  });

  const { data: rawScenes, isLoading: scenesLoading } = useQuery({
    ...trpc.lighting.getScenes.queryOptions(),
    placeholderData: getCachedScenes() ?? undefined,
    staleTime: 0,
    gcTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    if (rawScenes && Array.isArray(rawScenes) && rawScenes.length > 0) {
      setCachedScenes(rawScenes);
    }
  }, [rawScenes]);

  const updateLightingConfig = useMutation({
    ...trpc.lightingConfig.update.mutationOptions(),
    onSuccess: () => {
      configVersionRef.current += 1;
      queryClient.invalidateQueries({
        queryKey: trpc.lightingConfig.get.queryOptions({ sessionId: sessionId! }).queryKey,
      });
    },
  });

  useEffect(() => {
    if (pendingNavBack && lightingConfig) {
      setPendingNavBack(false);
      setViewState({ type: "phases" });
      setSelectedSceneId(null);
      setSelectedSceneName("");
      setOriginalSceneId(null);
    }
  }, [pendingNavBack, dataUpdatedAt]);

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

  const getSceneColor = useCallback((sceneId: string): string | null => {
    if (!rawScenes) return null;
    const scene = rawScenes.find((s: any) => s.id === sceneId);
    if (!scene) return null;
    const colorMatch = scene.name.match(/#([a-fA-F0-9]{6})/);
    return colorMatch ? `#${colorMatch[1]}` : null;
  }, [rawScenes]);

  const getEffectiveScene = useCallback((phaseType: string) => {
    if (!lightingConfig) return null;
    const roundKey = `round-${roundId}`;

    const customOverride = (lightingConfig as any).roundOverrides?.[roundKey]?.[phaseType];
    if (customOverride) return customOverride;

    const basePhaseType = phaseType.split("-")[0];
    const roundMaster = (lightingConfig as any).roundOverrides?.[roundKey]?.[basePhaseType];
    if (roundMaster) return roundMaster;

    return (lightingConfig as any).globalDefaults?.[basePhaseType] || null;
  }, [lightingConfig, roundId]);

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

  const getSceneName = useCallback((phaseType: string): string => {
    const effectiveScene = getEffectiveScene(phaseType);
    return effectiveScene?.sceneName || "No scene";
  }, [getEffectiveScene]);

  const repeatTimes = useMemo(() => {
    if (!circuitConfig?.config?.roundTemplates) return 1;
    const template = circuitConfig.config.roundTemplates.find(
      (rt: any) => rt.roundNumber === roundId
    );
    return template?.template?.repeatTimes ?? 1;
  }, [circuitConfig, roundId]);

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
    }

    return result;
  }, [roundType, roundData, generatePhaseConfig, repeatTimes, dataUpdatedAt]);

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

  // Filtered scenes based on search
  const filteredScenes = useMemo(() => {
    if (!sceneSearchQuery.trim()) return processedScenes;
    const query = sceneSearchQuery.toLowerCase().trim();
    return processedScenes.filter((scene) =>
      scene.name.toLowerCase().includes(query)
    );
  }, [processedScenes, sceneSearchQuery]);

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
    setSceneSearchQuery("");
    setViewState({ type: "scene-picker", phaseType, phaseLabel });
  };

  const handleBackFromPicker = () => {
    setViewState({ type: "phases" });
    setSelectedSceneId(null);
    setSelectedSceneName("");
    setOriginalSceneId(null);
  };

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
      setPendingNavBack(true);
    } catch (error) {
      console.error("Failed to save scene:", error);
    }
  };

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
      setPendingNavBack(true);
    } catch (error) {
      console.error("Failed to clear scene:", error);
    }
  };

  // Phases View
  const renderPhasesView = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          {roundName}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Lighting Configuration
        </p>
      </div>

      {/* Phase List */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6">
        <div className="space-y-1">
          {phases.map((phase) => {
            const isActive = phase.config?.active;
            const sceneNameText = getSceneName(phase.type);

            return (
              <div key={phase.type}>
                <button
                  onClick={() => handlePhaseClick(phase.type, phase.label)}
                  className="w-full py-4 flex items-center gap-4 group"
                >
                  {/* Color indicator */}
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex-shrink-0 transition-all",
                      isActive ? "shadow-lg" : "opacity-40"
                    )}
                    style={{
                      backgroundColor: phase.config?.color || "#6B7280",
                      boxShadow: isActive
                        ? `0 0 16px ${phase.config?.color}50`
                        : undefined,
                    }}
                  />

                  {/* Phase details */}
                  <div className="flex-1 min-w-0 text-left">
                    <p
                      className={cn(
                        "font-medium transition-colors",
                        isActive
                          ? "text-gray-900 dark:text-white"
                          : "text-gray-500 dark:text-gray-400"
                      )}
                    >
                      {phase.label}
                    </p>
                    <p
                      className={cn(
                        "text-sm mt-0.5 transition-colors",
                        isActive
                          ? "text-purple-600 dark:text-purple-400"
                          : "text-gray-400 dark:text-gray-500"
                      )}
                    >
                      {sceneNameText}
                    </p>
                  </div>

                  {/* Chevron */}
                  <svg
                    className="w-5 h-5 text-gray-400 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Subtle separator */}
                <div className="border-b border-dashed border-gray-200 dark:border-gray-700" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800">
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 py-3 text-gray-600 dark:text-gray-400 font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Back
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-purple-500 text-white font-medium rounded-xl hover:bg-purple-600 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  // Scene Picker View
  const renderScenePicker = () => {
    if (viewState.type !== "scene-picker") return null;

    const hasChange = selectedSceneId !== originalSceneId;
    const isClearing = !selectedSceneId && !!originalSceneId;

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-6 pt-4 pb-4">
          <button
            onClick={handleBackFromPicker}
            className="flex items-center gap-1 -ml-2 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {viewState.phaseLabel}
            </h2>
          </button>
        </div>

        {/* Search Input */}
        <div className="px-6 pb-4">
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={sceneSearchQuery}
              onChange={(e) => setSceneSearchQuery(e.target.value)}
              placeholder="Search scenes..."
              className="w-full pl-12 pr-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              autoFocus
            />
            {sceneSearchQuery && (
              <button
                onClick={() => setSceneSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Scene List */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6">
          {scenesLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredScenes.length === 0 && sceneSearchQuery ? (
            <div className="py-8 text-center text-gray-400">
              No scenes found for "{sceneSearchQuery}"
            </div>
          ) : (
            <div className="space-y-2 pt-2 pb-4">
              {/* No Scene Option */}
              <button
                onClick={() => {
                  setSelectedSceneId(null);
                  setSelectedSceneName("");
                }}
                className={cn(
                  "w-full p-4 rounded-xl text-left transition-all",
                  selectedSceneId === null
                    ? "bg-purple-50 dark:bg-purple-900/20 ring-2 ring-purple-500"
                    : "bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white">No Scene</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Keep lights unchanged
                    </p>
                  </div>
                  {selectedSceneId === null && (
                    <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>

              {/* Scene Items */}
              {filteredScenes.map((scene) => (
                <button
                  key={scene.id}
                  onClick={() => {
                    setSelectedSceneId(scene.id);
                    setSelectedSceneName(scene.name);
                  }}
                  className={cn(
                    "w-full p-4 rounded-xl text-left transition-all",
                    selectedSceneId === scene.id
                      ? "bg-purple-50 dark:bg-purple-900/20 ring-2 ring-purple-500"
                      : "bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* Color indicator */}
                    {scene.color ? (
                      <div
                        className="w-10 h-10 rounded-full flex-shrink-0 shadow-sm"
                        style={{
                          backgroundColor: scene.color,
                          boxShadow: `0 0 12px ${scene.color}40`,
                        }}
                      />
                    ) : scene.isSpecialEffect ? (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 via-pink-400 to-blue-400 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">FX</span>
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {scene.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {scene.isSpecialEffect ? "Special Effect" : "Light Scene"}
                      </p>
                    </div>

                    {selectedSceneId === scene.id && (
                      <svg className="w-5 h-5 text-purple-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800">
          <div className="flex gap-3">
            <button
              onClick={handleBackFromPicker}
              className="flex-1 py-3 text-gray-600 dark:text-gray-400 font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={isClearing ? handleClearScene : handleApplyScene}
              disabled={!hasChange || updateLightingConfig.isPending}
              className={cn(
                "flex-1 py-3 rounded-xl font-medium transition-all",
                !hasChange || updateLightingConfig.isPending
                  ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500"
                  : isClearing
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-purple-500 text-white hover:bg-purple-600"
              )}
            >
              {updateLightingConfig.isPending
                ? "Saving..."
                : isClearing
                ? "Clear Scene"
                : "Apply Scene"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[80vh]">
      {viewState.type === "phases" && renderPhasesView()}
      {viewState.type === "scene-picker" && renderScenePicker()}
    </div>
  );
}

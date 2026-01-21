"use client";

import React, { useMemo, useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@acme/ui-shared";
import type { RoundData } from "@acme/ui-shared";

interface RoundMusicDrawerProps {
  sessionId?: string | null;
  roundNumber: number;
  roundName: string;
  roundType: "circuit_round" | "stations_round" | "amrap_round";
  roundData?: RoundData;
  onClose?: () => void;
}

// Energy levels - Rise maps to 'medium' in the schema
type EnergyLevel = "low" | "medium" | "high";
const ENERGY_DISPLAY: Record<EnergyLevel, string> = {
  low: "Low",
  medium: "Rise",
  high: "High",
};

interface MusicTrigger {
  enabled: boolean;
  trackId?: string;
  trackName?: string;
  useBuildup?: boolean; // Start at buildup point before the drop
  energy?: EnergyLevel;
  repeatOnAllSets?: boolean; // If true, trigger fires on every set (not just first)
}

interface RoundMusicConfig {
  roundPreview?: MusicTrigger;
  exercises?: MusicTrigger[];
  rests?: MusicTrigger[];
  setBreaks?: MusicTrigger[];
}

interface Phase {
  key: string;
  label: string;
  phaseType: "preview" | "exercise" | "rest" | "setBreak";
  index: number;
}

type ViewState =
  | { type: "phases" }
  | { type: "phase-detail"; phase: Phase }
  | { type: "track-picker"; phase: Phase };

interface MusicTrack {
  id: string;
  filename: string;
  name: string;
  artist: string;
  durationMs: number;
  segments: Array<{ timestamp: number; energy: string; buildupDuration?: number }>;
}

export function RoundMusicDrawer({
  sessionId,
  roundNumber,
  roundName,
  roundType,
  roundData,
  onClose,
}: RoundMusicDrawerProps) {
  const trpc = api();
  const queryClient = useQueryClient();

  const [viewState, setViewState] = useState<ViewState>({ type: "phases" });
  const [localConfig, setLocalConfig] = useState<RoundMusicConfig | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Phase detail state
  const [detailEnabled, setDetailEnabled] = useState(false);
  const [detailTrackId, setDetailTrackId] = useState<string | null>(null);
  const [detailTrackName, setDetailTrackName] = useState<string>("");
  const [detailEnergy, setDetailEnergy] = useState<EnergyLevel>("high");
  const [detailRepeatOnAllSets, setDetailRepeatOnAllSets] = useState(false);

  // Track picker state
  const [trackSearchQuery, setTrackSearchQuery] = useState("");

  const { data: circuitConfig, isLoading } = useQuery({
    ...trpc.circuitConfig.getBySession.queryOptions({ sessionId: sessionId! }),
    enabled: !!sessionId,
  });

  // Fetch tracks
  const { data: tracks, isLoading: tracksLoading } = useQuery({
    ...trpc.music.list.queryOptions({}),
    enabled: viewState.type === "phase-detail" || viewState.type === "track-picker",
  });

  // Filtered tracks based on search
  const filteredTracks = useMemo(() => {
    if (!tracks) return [];
    if (!trackSearchQuery.trim()) return tracks as MusicTrack[];
    const query = trackSearchQuery.toLowerCase().trim();
    return (tracks as MusicTrack[]).filter(
      (track) =>
        track.name.toLowerCase().includes(query) ||
        track.artist.toLowerCase().includes(query)
    );
  }, [tracks, trackSearchQuery]);

  // Get repeatTimes from round template
  const repeatTimes = useMemo(() => {
    if (!circuitConfig?.config?.roundTemplates) return 1;
    const template = (circuitConfig.config.roundTemplates as any[]).find(
      (rt) => rt.roundNumber === roundNumber
    );
    return template?.template?.repeatTimes ?? 1;
  }, [circuitConfig, roundNumber]);

  // Generate phases
  const phases = useMemo((): Phase[] => {
    const result: Phase[] = [];

    result.push({
      key: "preview",
      label: "Round Preview",
      phaseType: "preview",
      index: 0,
    });

    if (roundType === "stations_round" && roundData?.exercises) {
      const stations = Array.from(
        new Set(roundData.exercises.map((ex) => ex.orderIndex))
      ).sort((a, b) => a - b);

      stations.forEach((stationOrderIndex, sequentialIndex) => {
        const stationExercises =
          roundData.exercises?.filter((ex) => ex.orderIndex === stationOrderIndex) || [];
        const exerciseNames = stationExercises.map((ex) => ex.exerciseName).join(", ");

        result.push({
          key: `work-station-${sequentialIndex}`,
          label: `Station: ${exerciseNames}`,
          phaseType: "exercise",
          index: sequentialIndex,
        });

        if (sequentialIndex < stations.length - 1) {
          result.push({
            key: `rest-after-station-${sequentialIndex}`,
            label: "Rest",
            phaseType: "rest",
            index: sequentialIndex,
          });
        }
      });

      if (repeatTimes > 1) {
        result.push({
          key: "roundBreak",
          label: "Set Break",
          phaseType: "setBreak",
          index: 0,
        });
      }
    } else if (roundType === "circuit_round" && roundData?.exercises) {
      roundData.exercises.forEach((exercise, exerciseIndex) => {
        result.push({
          key: `work-exercise-${exerciseIndex}`,
          label: exercise.exerciseName,
          phaseType: "exercise",
          index: exerciseIndex,
        });

        if (exerciseIndex < (roundData.exercises?.length || 0) - 1) {
          result.push({
            key: `rest-after-exercise-${exerciseIndex}`,
            label: "Rest",
            phaseType: "rest",
            index: exerciseIndex,
          });
        }
      });

      if (repeatTimes > 1) {
        result.push({
          key: "roundBreak",
          label: "Set Break",
          phaseType: "setBreak",
          index: 0,
        });
      }
    } else if (roundType === "amrap_round") {
      result.push({
        key: "work",
        label: "AMRAP Work",
        phaseType: "exercise",
        index: 0,
      });
    }

    return result;
  }, [roundType, roundData, repeatTimes]);

  // Extract music config
  const serverMusicConfig: RoundMusicConfig | null = useMemo(() => {
    if (!circuitConfig?.config?.roundTemplates) return null;
    const roundTemplate = (circuitConfig.config.roundTemplates as any[]).find(
      (rt) => rt.roundNumber === roundNumber
    );
    return roundTemplate?.music ?? null;
  }, [circuitConfig, roundNumber]);

  useEffect(() => {
    if (!localConfig) {
      if (serverMusicConfig) {
        setLocalConfig(JSON.parse(JSON.stringify(serverMusicConfig)));
      } else {
        // Initialize with empty config if none exists
        setLocalConfig({
          roundPreview: { enabled: false },
          exercises: [],
          rests: [],
          setBreaks: [],
        });
      }
    }
  }, [serverMusicConfig, localConfig]);

  const updateMusicConfig = useMutation({
    ...trpc.circuitConfig.updateRoundMusicConfig.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.circuitConfig.getBySession.queryOptions({ sessionId: sessionId! }).queryKey,
      });
      setHasChanges(false);
    },
  });

  const musicConfig = localConfig || serverMusicConfig;

  const getTriggerForPhase = (phase: Phase): MusicTrigger | undefined => {
    if (!musicConfig) return undefined;
    if (phase.phaseType === "preview") return musicConfig.roundPreview;
    if (phase.phaseType === "exercise") return musicConfig.exercises?.[phase.index];
    if (phase.phaseType === "rest") return musicConfig.rests?.[phase.index];
    if (phase.phaseType === "setBreak") return musicConfig.setBreaks?.[phase.index];
    return undefined;
  };

  const updateTriggerForPhase = (phase: Phase, updates: Partial<MusicTrigger>) => {
    if (!localConfig) return;

    const newConfig = { ...localConfig };

    // Default trigger structure
    const defaultTrigger: MusicTrigger = { enabled: false };

    if (phase.phaseType === "preview") {
      newConfig.roundPreview = { ...(newConfig.roundPreview || defaultTrigger), ...updates };
    } else if (phase.phaseType === "exercise") {
      const arr = [...(newConfig.exercises || [])];
      // Ensure array has enough slots
      while (arr.length <= phase.index) {
        arr.push({ ...defaultTrigger });
      }
      arr[phase.index] = { ...arr[phase.index], ...updates };
      newConfig.exercises = arr;
    } else if (phase.phaseType === "rest") {
      const arr = [...(newConfig.rests || [])];
      // Ensure array has enough slots
      while (arr.length <= phase.index) {
        arr.push({ ...defaultTrigger });
      }
      arr[phase.index] = { ...arr[phase.index], ...updates };
      newConfig.rests = arr;
    } else if (phase.phaseType === "setBreak") {
      const arr = [...(newConfig.setBreaks || [])];
      // Ensure array has enough slots
      while (arr.length <= phase.index) {
        arr.push({ ...defaultTrigger });
      }
      arr[phase.index] = { ...arr[phase.index], ...updates };
      newConfig.setBreaks = arr;
    }

    setLocalConfig(newConfig);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!sessionId || !localConfig) return;
    await updateMusicConfig.mutateAsync({
      sessionId,
      roundNumber,
      musicConfig: localConfig,
    });
    onClose?.();
  };

  const getTrackEnergyLevels = (track: MusicTrack): EnergyLevel[] => {
    if (!track.segments || track.segments.length === 0) return [];
    const energies = new Set(track.segments.map((s) => s.energy as EnergyLevel));
    return ["low", "medium", "high"].filter((e) => energies.has(e as EnergyLevel)) as EnergyLevel[];
  };

  // Open phase detail
  const handleOpenPhaseDetail = (phase: Phase) => {
    const trigger = getTriggerForPhase(phase);
    setDetailEnabled(trigger?.enabled ?? false);
    setDetailTrackId(trigger?.trackId || null);
    setDetailTrackName(trigger?.trackName || "");
    setDetailEnergy((trigger?.energy as EnergyLevel) || (phase.phaseType === "rest" ? "low" : "high"));
    setDetailRepeatOnAllSets(trigger?.repeatOnAllSets ?? false);
    setViewState({ type: "phase-detail", phase });
  };

  // Apply phase detail changes
  const handleApplyPhaseDetail = () => {
    if (viewState.type !== "phase-detail") return;

    const phase = viewState.phase;
    const showRepeatOption = repeatTimes > 1 && (phase.phaseType === "exercise" || phase.phaseType === "rest");

    updateTriggerForPhase(phase, {
      enabled: detailEnabled,
      trackId: detailTrackId || undefined,
      trackName: detailTrackId ? detailTrackName : undefined,
      energy: detailEnergy,
      ...(showRepeatOption ? { repeatOnAllSets: detailRepeatOnAllSets } : {}),
    });

    setViewState({ type: "phases" });
  };

  // Toggle component
  const Toggle = ({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "relative w-12 h-7 rounded-full transition-all duration-200 flex-shrink-0",
        enabled ? "bg-purple-500" : "bg-gray-200 dark:bg-gray-700"
      )}
    >
      <div
        className={cn(
          "absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200",
          enabled ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );

  // Get status text for a phase
  const getPhaseStatus = (phase: Phase): string => {
    const trigger = getTriggerForPhase(phase);
    if (!trigger?.enabled) return "No music";

    const trackPart = trigger.trackName || "Random";
    const energyPart = ENERGY_DISPLAY[trigger.energy || "high"];

    // Show repeat indicator for exercise/rest phases in multi-set rounds
    const showRepeat = repeatTimes > 1 &&
      (phase.phaseType === "exercise" || phase.phaseType === "rest") &&
      trigger.repeatOnAllSets;

    const repeatPart = showRepeat ? ` · ${repeatTimes}x` : "";
    return `${trackPart} · ${energyPart}${repeatPart}`;
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
          Music Configuration
        </p>
      </div>

      {/* Phase List */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !musicConfig ? (
          <div className="text-center py-16 text-gray-400">
            No music configuration available
          </div>
        ) : (
          <div className="space-y-1">
            {phases.map((phase) => {
              const trigger = getTriggerForPhase(phase);
              const isEnabled = trigger?.enabled ?? false;

              return (
                <div key={phase.key}>
                  <button
                    onClick={() => handleOpenPhaseDetail(phase)}
                    className={cn(
                      "w-full py-4 px-3 -mx-3 rounded-xl flex items-center justify-between group transition-colors",
                      isEnabled
                        ? "bg-purple-50 dark:bg-purple-900/20"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    )}
                  >
                    <div className="flex-1 min-w-0 text-left">
                      <p
                        className={cn(
                          "font-medium transition-colors",
                          isEnabled
                            ? "text-gray-900 dark:text-white"
                            : "text-gray-500 dark:text-gray-400"
                        )}
                      >
                        {phase.label}
                      </p>
                      <p
                        className={cn(
                          "text-sm mt-0.5 transition-colors",
                          isEnabled
                            ? "text-purple-600 dark:text-purple-400"
                            : "text-gray-400 dark:text-gray-500"
                        )}
                      >
                        {getPhaseStatus(phase)}
                      </p>
                    </div>

                    {/* Chevron - indicates drill-in */}
                    <svg
                      className={cn(
                        "w-5 h-5 transition-colors",
                        isEnabled
                          ? "text-purple-400 dark:text-purple-500"
                          : "text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400"
                      )}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Subtle separator */}
                  <div className="border-b border-dashed border-gray-200 dark:border-gray-700" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800">
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-gray-600 dark:text-gray-400 font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || updateMusicConfig.isPending}
            className={cn(
              "flex-1 py-3 rounded-xl font-medium transition-all",
              hasChanges && !updateMusicConfig.isPending
                ? "bg-purple-500 text-white hover:bg-purple-600"
                : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500"
            )}
          >
            {updateMusicConfig.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );

  // Phase Detail View
  const renderPhaseDetail = () => {
    if (viewState.type !== "phase-detail") return null;

    const selectedTrack = detailTrackId && tracks
      ? (tracks as MusicTrack[]).find((t) => t.id === detailTrackId)
      : null;
    const availableEnergies = selectedTrack ? getTrackEnergyLevels(selectedTrack) : undefined;

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-6 pt-4 pb-4">
          <button
            onClick={() => setViewState({ type: "phases" })}
            className="flex items-center gap-1 -ml-2 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {viewState.phase.label}
            </h2>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6">
          {/* Primary Toggle - Top of hierarchy */}
          <div
            onClick={() => setDetailEnabled(!detailEnabled)}
            className={cn(
              "w-full p-4 rounded-2xl mt-4 mb-6 flex items-center justify-between transition-all cursor-pointer",
              detailEnabled
                ? "bg-purple-50 dark:bg-purple-900/20 ring-2 ring-purple-500"
                : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                detailEnabled
                  ? "bg-purple-500 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-400"
              )}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <span className={cn(
                "font-semibold text-lg",
                detailEnabled
                  ? "text-purple-700 dark:text-purple-300"
                  : "text-gray-500 dark:text-gray-400"
              )}>
                Change Music Track
              </span>
            </div>
            <Toggle
              enabled={detailEnabled}
              onToggle={() => setDetailEnabled(!detailEnabled)}
            />
          </div>

          {/* Configuration - dimmed when disabled */}
          <div className={cn(
            "transition-opacity",
            !detailEnabled && "opacity-40 pointer-events-none"
          )}>
          {/* Energy Selection - Primary */}
          <div className="mb-8">
            <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
              Energy Level
            </h3>

            <div className="flex gap-2">
              {(["low", "medium", "high"] as EnergyLevel[]).map((energy) => {
                const isAvailable = !availableEnergies || availableEnergies.includes(energy);
                const isSelected = detailEnergy === energy;

                return (
                  <button
                    key={energy}
                    onClick={() => isAvailable && setDetailEnergy(energy)}
                    disabled={!isAvailable}
                    className={cn(
                      "flex-1 py-3 rounded-xl font-medium transition-all",
                      !isAvailable && "opacity-30 cursor-not-allowed",
                      isSelected
                        ? energy === "low"
                          ? "bg-blue-500 text-white"
                          : energy === "medium"
                          ? "bg-amber-500 text-white"
                          : "bg-orange-500 text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                    )}
                  >
                    {ENERGY_DISPLAY[energy]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Track Selection - Secondary */}
          <div className="mb-8">
            <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
              Track
            </h3>

            <button
              onClick={() => {
                setTrackSearchQuery("");
                setViewState({ type: "track-picker", phase: viewState.phase });
              }}
              className="w-full p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                {detailTrackId === null ? (
                  <>
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white">Random</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Auto-select based on energy
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {detailTrackName || selectedTrack?.name || "Selected track"}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Specific track
                      </p>
                    </div>
                  </>
                )}
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          </div>

          {/* Repeat on All Sets - Only show for exercise/rest phases in rounds with 2+ sets */}
          {repeatTimes > 1 && (viewState.phase.phaseType === "exercise" || viewState.phase.phaseType === "rest") && (
            <div className="mb-8">
              <button
                onClick={() => setDetailRepeatOnAllSets(!detailRepeatOnAllSets)}
                className="w-full p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-medium text-gray-900 dark:text-white">
                      Play every set
                    </p>
                    {detailRepeatOnAllSets && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        Triggers on all {repeatTimes} sets
                      </p>
                    )}
                  </div>
                  <div
                    className={cn(
                      "relative w-12 h-7 rounded-full transition-all duration-200 flex-shrink-0 ml-4",
                      detailRepeatOnAllSets ? "bg-purple-500" : "bg-gray-200 dark:bg-gray-700"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200",
                        detailRepeatOnAllSets ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </div>
                </div>
              </button>
            </div>
          )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800">
          <div className="flex gap-3">
            <button
              onClick={() => setViewState({ type: "phases" })}
              className="flex-1 py-3 text-gray-600 dark:text-gray-400 font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyPhaseDetail}
              className="flex-1 py-3 bg-purple-500 text-white font-medium rounded-xl hover:bg-purple-600 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Track Picker View
  const renderTrackPicker = () => {
    if (viewState.type !== "track-picker") return null;

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-6 pt-4 pb-4">
          <button
            onClick={() => setViewState({ type: "phase-detail", phase: viewState.phase })}
            className="flex items-center gap-1 -ml-2 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Choose Track
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
              value={trackSearchQuery}
              onChange={(e) => setTrackSearchQuery(e.target.value)}
              placeholder="Search tracks..."
              className="w-full pl-12 pr-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              autoFocus
            />
            {trackSearchQuery && (
              <button
                onClick={() => setTrackSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Track List */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6">
          <div className="space-y-2 pt-2 pb-4">
            {/* Random Option */}
            <button
              onClick={() => {
                setDetailTrackId(null);
                setDetailTrackName("");
                setViewState({ type: "phase-detail", phase: viewState.phase });
              }}
              className={cn(
                "w-full p-4 rounded-xl text-left transition-all",
                detailTrackId === null
                  ? "bg-purple-50 dark:bg-purple-900/20 ring-2 ring-purple-500"
                  : "bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white">Random</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Auto-select based on energy
                  </p>
                </div>
                {detailTrackId === null && (
                  <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </button>

            {/* Track List */}
            {tracksLoading ? (
              <div className="py-8 flex justify-center">
                <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredTracks.length === 0 && trackSearchQuery ? (
              <div className="py-8 text-center text-gray-400">
                No tracks found for "{trackSearchQuery}"
              </div>
            ) : (
              filteredTracks.map((track) => {
                const energyLevels = getTrackEnergyLevels(track);

                return (
                  <button
                    key={track.id}
                    onClick={() => {
                      setDetailTrackId(track.id);
                      setDetailTrackName(track.name);
                      // Auto-select first available energy if current isn't available
                      if (energyLevels.length > 0 && !energyLevels.includes(detailEnergy)) {
                        setDetailEnergy(energyLevels[0]!);
                      }
                      setViewState({ type: "phase-detail", phase: viewState.phase });
                    }}
                    className={cn(
                      "w-full p-4 rounded-xl text-left transition-all",
                      detailTrackId === track.id
                        ? "bg-purple-50 dark:bg-purple-900/20 ring-2 ring-purple-500"
                        : "bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {track.name}
                        </p>
                        {energyLevels.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {energyLevels.map((e) => (
                              <span
                                key={e}
                                className={cn(
                                  "text-xs font-medium",
                                  e === "low" && "text-blue-500",
                                  e === "medium" && "text-amber-500",
                                  e === "high" && "text-orange-500"
                                )}
                              >
                                {ENERGY_DISPLAY[e]}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {detailTrackId === track.id && (
                        <svg className="w-5 h-5 text-purple-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => setViewState({ type: "phase-detail", phase: viewState.phase })}
            className="w-full py-3 text-gray-600 dark:text-gray-400 font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[80vh]">
      {viewState.type === "phases" && renderPhasesView()}
      {viewState.type === "phase-detail" && renderPhaseDetail()}
      {viewState.type === "track-picker" && renderTrackPicker()}
    </div>
  );
}

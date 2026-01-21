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
  naturalEnding?: boolean; // If true, seek so music ends naturally with round end
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

  // Phase detail state
  const [detailEnabled, setDetailEnabled] = useState(false);
  const [detailTrackId, setDetailTrackId] = useState<string | null>(null);
  const [detailTrackName, setDetailTrackName] = useState<string>("");
  const [detailEnergy, setDetailEnergy] = useState<EnergyLevel>("high");
  const [detailRepeatOnAllSets, setDetailRepeatOnAllSets] = useState(false);
  const [detailNaturalEnding, setDetailNaturalEnding] = useState(false);

  // Track picker state
  const [trackSearchQuery, setTrackSearchQuery] = useState("");

  // Alert state for auto-enabled next round preview
  const [showNextRoundAlert, setShowNextRoundAlert] = useState(false);

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

  // Get total number of rounds
  const totalRounds = useMemo(() => {
    return circuitConfig?.config?.rounds ?? 0;
  }, [circuitConfig]);

  // Check if next round's preview is enabled
  const isNextRoundPreviewEnabled = useMemo(() => {
    if (!circuitConfig?.config?.roundTemplates || roundNumber >= totalRounds) return true; // No next round
    const nextRoundTemplate = (circuitConfig.config.roundTemplates as any[]).find(
      (rt) => rt.roundNumber === roundNumber + 1
    );
    return nextRoundTemplate?.music?.roundPreview?.enabled ?? false;
  }, [circuitConfig, roundNumber, totalRounds]);

  // Calculate total round duration (in seconds)
  const roundDuration = useMemo(() => {
    if (!circuitConfig?.config?.roundTemplates) return 0;
    const roundConfig = (circuitConfig.config.roundTemplates as any[]).find(
      (rt) => rt.roundNumber === roundNumber
    );
    if (!roundConfig?.template) return 0;

    const template = roundConfig.template;
    const exerciseCount = roundData?.exercises?.length || template.exercisesPerRound || 0;
    const sets = template.repeatTimes || 1;

    if (template.type === "circuit_round" || template.type === "stations_round") {
      const workDuration = template.workDuration || 0;
      const restDuration = template.restDuration || 0;
      const restBetweenSets = template.restBetweenSets || 0;

      // One set = (work * exercises) + (rest * (exercises - 1))
      const oneSet = (workDuration * exerciseCount) + (restDuration * Math.max(0, exerciseCount - 1));
      // Total = sets * oneSet + (sets - 1) * restBetweenSets
      return (oneSet * sets) + (restBetweenSets * Math.max(0, sets - 1));
    } else if (template.type === "amrap_round") {
      return template.totalDuration || 0;
    }

    return 0;
  }, [circuitConfig, roundNumber, roundData]);

  /**
   * Check if a track is compatible with natural ending for the current round duration.
   * For natural ending, we calculate: seekPoint = trackDuration - roundDuration
   * The seekPoint must land in a medium or high segment (never low).
   */
  const getTrackNaturalEndingCompatibility = (track: MusicTrack): { compatible: boolean; reason?: string } => {
    if (!track.segments || track.segments.length === 0) {
      return { compatible: false, reason: "No segments" };
    }

    const trackDurationSec = track.durationMs / 1000;
    const seekPoint = trackDurationSec - roundDuration;

    if (seekPoint < 0) {
      return { compatible: false, reason: "Track too short" };
    }

    // Find the segment at the seek point (highest timestamp <= seekPoint)
    const sortedSegments = [...track.segments].sort((a, b) => a.timestamp - b.timestamp);
    let segmentAtSeek = sortedSegments[0];
    for (const segment of sortedSegments) {
      if (segment.timestamp <= seekPoint) {
        segmentAtSeek = segment;
      } else {
        break;
      }
    }

    if (segmentAtSeek?.energy === "low") {
      return { compatible: false, reason: "Starts in low energy" };
    }

    return { compatible: true };
  };

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
    setDetailNaturalEnding(trigger?.naturalEnding ?? false);
    setViewState({ type: "phase-detail", phase });
  };

  // Apply phase detail changes and save immediately
  const handleApplyPhaseDetail = async () => {
    if (viewState.type !== "phase-detail" || !localConfig || !sessionId) return;

    const phase = viewState.phase;
    const showRepeatOption = repeatTimes > 1 && (phase.phaseType === "exercise" || phase.phaseType === "rest");

    // Build updated config
    const newConfig = { ...localConfig };
    const defaultTrigger: MusicTrigger = { enabled: false };
    const updates = {
      enabled: detailEnabled,
      trackId: detailTrackId || undefined,
      trackName: detailTrackId ? detailTrackName : undefined,
      energy: detailEnergy,
      naturalEnding: detailNaturalEnding,
      ...(showRepeatOption ? { repeatOnAllSets: detailRepeatOnAllSets } : {}),
    };

    if (phase.phaseType === "preview") {
      newConfig.roundPreview = { ...(newConfig.roundPreview || defaultTrigger), ...updates };
    } else if (phase.phaseType === "exercise") {
      const arr = [...(newConfig.exercises || [])];
      while (arr.length <= phase.index) arr.push({ ...defaultTrigger });
      arr[phase.index] = { ...arr[phase.index], ...updates };
      newConfig.exercises = arr;
    } else if (phase.phaseType === "rest") {
      const arr = [...(newConfig.rests || [])];
      while (arr.length <= phase.index) arr.push({ ...defaultTrigger });
      arr[phase.index] = { ...arr[phase.index], ...updates };
      newConfig.rests = arr;
    } else if (phase.phaseType === "setBreak") {
      const arr = [...(newConfig.setBreaks || [])];
      while (arr.length <= phase.index) arr.push({ ...defaultTrigger });
      arr[phase.index] = { ...arr[phase.index], ...updates };
      newConfig.setBreaks = arr;
    }

    setLocalConfig(newConfig);
    setViewState({ type: "phases" });

    // Save current round config
    await updateMusicConfig.mutateAsync({
      sessionId,
      roundNumber,
      musicConfig: newConfig,
    });

    // If natural ending is enabled and there's a next round without preview enabled,
    // automatically enable the next round's preview
    if (detailNaturalEnding && detailEnabled && roundNumber < totalRounds && !isNextRoundPreviewEnabled) {
      // Enable next round's preview with default settings
      await updateMusicConfig.mutateAsync({
        sessionId,
        roundNumber: roundNumber + 1,
        musicConfig: {
          roundPreview: {
            enabled: true,
            energy: "high", // Default to high energy for preview
          },
        },
      });
      // Show alert to inform user
      setShowNextRoundAlert(true);
    }
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

  // Auto-dismiss alert after 4 seconds
  useEffect(() => {
    if (showNextRoundAlert) {
      const timer = setTimeout(() => setShowNextRoundAlert(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [showNextRoundAlert]);

  // Phases View
  const renderPhasesView = () => (
    <div className="flex flex-col h-full">
      {/* Alert for auto-enabled next round preview */}
      {showNextRoundAlert && (
        <div className="mx-6 mt-4 p-4 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium text-purple-900 dark:text-purple-100">
                Round {roundNumber + 1} preview enabled
              </p>
              <p className="text-sm text-purple-700 dark:text-purple-300 mt-0.5">
                Music will continue after natural ending
              </p>
            </div>
            <button
              onClick={() => setShowNextRoundAlert(false)}
              className="p-1 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-800/50 transition-colors"
            >
              <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

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
        <button
          onClick={onClose}
          className="w-full py-3 text-gray-600 dark:text-gray-400 font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          Done
        </button>
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

          {/* Natural Ending - Available for all phases, but requires specific track */}
          <div className="mb-8">
            <button
              onClick={() => {
                const newValue = !detailNaturalEnding;
                setDetailNaturalEnding(newValue);
                // If enabling natural ending and no track selected, user will need to pick one
              }}
              className="w-full p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-medium text-gray-900 dark:text-white">
                    Natural ending
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {detailNaturalEnding
                      ? detailTrackId
                        ? "Music ends naturally with the round"
                        : "Select a compatible track below"
                      : "Time music to end with round completion"}
                  </p>
                </div>
                <div
                  className={cn(
                    "relative w-12 h-7 rounded-full transition-all duration-200 flex-shrink-0 ml-4",
                    detailNaturalEnding ? "bg-purple-500" : "bg-gray-200 dark:bg-gray-700"
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200",
                      detailNaturalEnding ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </div>
              </div>
            </button>
          </div>
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
            {/* Random Option - disabled when natural ending is enabled */}
            <button
              onClick={() => {
                if (detailNaturalEnding) return;
                setDetailTrackId(null);
                setDetailTrackName("");
                setViewState({ type: "phase-detail", phase: viewState.phase });
              }}
              disabled={detailNaturalEnding}
              className={cn(
                "w-full p-4 rounded-xl text-left transition-all",
                detailNaturalEnding && "opacity-50 cursor-not-allowed",
                !detailNaturalEnding && detailTrackId === null
                  ? "bg-purple-50 dark:bg-purple-900/20 ring-2 ring-purple-500"
                  : "bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                  detailNaturalEnding
                    ? "bg-gray-300 dark:bg-gray-600"
                    : "bg-gradient-to-br from-purple-400 to-pink-400"
                )}>
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "font-medium",
                    detailNaturalEnding
                      ? "text-gray-400 dark:text-gray-500"
                      : "text-gray-900 dark:text-white"
                  )}>Random</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {detailNaturalEnding
                      ? "Not available with natural ending"
                      : "Auto-select based on energy"}
                  </p>
                </div>
                {!detailNaturalEnding && detailTrackId === null && (
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
                const compatibility = detailNaturalEnding
                  ? getTrackNaturalEndingCompatibility(track)
                  : { compatible: true };
                const isDisabled = detailNaturalEnding && !compatibility.compatible;

                return (
                  <button
                    key={track.id}
                    onClick={() => {
                      if (isDisabled) return;
                      setDetailTrackId(track.id);
                      setDetailTrackName(track.name);
                      // Auto-select first available energy if current isn't available
                      if (energyLevels.length > 0 && !energyLevels.includes(detailEnergy)) {
                        setDetailEnergy(energyLevels[0]!);
                      }
                      setViewState({ type: "phase-detail", phase: viewState.phase });
                    }}
                    disabled={isDisabled}
                    className={cn(
                      "w-full p-4 rounded-xl text-left transition-all",
                      isDisabled && "opacity-50 cursor-not-allowed",
                      !isDisabled && detailTrackId === track.id
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
                        <p className={cn(
                          "font-medium truncate",
                          isDisabled
                            ? "text-gray-400 dark:text-gray-500"
                            : "text-gray-900 dark:text-white"
                        )}>
                          {track.name}
                        </p>
                        {isDisabled && compatibility.reason ? (
                          <p className="text-xs text-red-400 mt-1">
                            {compatibility.reason}
                          </p>
                        ) : energyLevels.length > 0 ? (
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
                        ) : null}
                      </div>
                      {!isDisabled && detailTrackId === track.id && (
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
